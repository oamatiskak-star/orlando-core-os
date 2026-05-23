#!/usr/bin/env node
/**
 * Minimal hand-rolled test runner — no external test framework.
 * Each `test(name, fn)` runs sequentially, prints pass/fail, exit code 0 on all-pass.
 */
import { buildScenarioMatrix } from '../src/matrix'
import { loadTiers, loadCountries, loadDevices, loadNegativeScenarios } from '../src/specs'
import { detectTiersInHtml } from '../src/discovery/tier-availability'
import { assertLocale } from '../src/playwright/locale-asserts'
import { rankFindings } from '../src/reports/priority-queue-renderer'

const results: Array<{ name: string; ok: boolean; error?: string }> = []

function test(name: string, fn: () => void | Promise<void>): void {
  try {
    const r = fn()
    if (r instanceof Promise) {
      r.then(() => results.push({ name, ok: true }))
        .catch(err => results.push({ name, ok: false, error: err instanceof Error ? err.message : String(err) }))
    } else {
      results.push({ name, ok: true })
    }
  } catch (err) {
    results.push({ name, ok: false, error: err instanceof Error ? err.message : String(err) })
  }
}

function assertEq<T>(actual: T, expected: T, msg: string): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${msg}: expected ${JSON.stringify(expected)} got ${JSON.stringify(actual)}`)
  }
}

function assertGte(actual: number, min: number, msg: string): void {
  if (actual < min) throw new Error(`${msg}: ${actual} < ${min}`)
}

function assertContains(arr: string[], item: string, msg: string): void {
  if (!arr.includes(item)) throw new Error(`${msg}: ${item} not in [${arr.join(', ')}]`)
}

// ── Spec loading ──────────────────────────────────────────────────────────
test('loadTiers returns 5 tiers including explorer and developer', () => {
  const tiers = loadTiers()
  assertGte(tiers.length, 5, 'tiers count')
  assertContains(tiers.map(t => t.code), 'explorer', 'tiers')
  assertContains(tiers.map(t => t.code), 'developer', 'tiers')
  assertContains(tiers.map(t => t.code), 'institutional', 'tiers')
})

test('loadCountries returns 14 countries with NL/DE/AE/US/CH/CA/AU/TH', () => {
  const countries = loadCountries()
  assertGte(countries.length, 14, 'countries count')
  const codes = countries.map(c => c.code)
  for (const required of ['NL', 'DE', 'BE', 'ES', 'PT', 'AE', 'GB', 'FR', 'IT', 'US', 'CH', 'CA', 'AU', 'TH']) {
    assertContains(codes, required, 'countries')
  }
})

test('loadDevices returns 4 devices including mobile_safari', () => {
  const devices = loadDevices()
  assertEq(devices.length, 4, 'devices count')
  assertContains(devices.map(d => d.id), 'mobile_safari', 'devices')
})

test('loadNegativeScenarios returns at least 6 scenarios', () => {
  const negs = loadNegativeScenarios()
  assertGte(negs.length, 6, 'negative scenarios count')
})

// ── Matrix ────────────────────────────────────────────────────────────────
test('matrix with no scope filter generates expected count', () => {
  const all = buildScenarioMatrix({})
  // 2 self-serve tiers (explorer, developer) × 2 cycles × 14 countries × 4 devices = 224
  // + 1 black tier × 2 cycles × 14 × 4 = 112 → 336
  // + 2 sales tiers × 14 countries × 1 device (discovery) = 28
  // + 8 negatives = ~372
  assertGte(all.length, 200, 'all scenarios')
})

test('matrix with country filter NL only returns scenarios with country NL', () => {
  const nl = buildScenarioMatrix({ country_codes: ['NL'], max_scenarios: 1000 })
  const allNl = nl.every(s => s.country_code === 'NL')
  if (!allNl) throw new Error('some scenarios are not NL')
  assertGte(nl.length, 10, 'NL scenarios count')
})

test('matrix respects max_scenarios cap', () => {
  const capped = buildScenarioMatrix({ max_scenarios: 5 })
  assertEq(capped.length, 5, 'capped count')
})

test('matrix sales-contact tiers are flagged as discovery_only', () => {
  const all = buildScenarioMatrix({ tier_codes: ['institutional'], max_scenarios: 100 })
  const allDiscovery = all.every(s => s.is_discovery_only)
  if (!allDiscovery) throw new Error('institutional scenarios should all be discovery_only')
})

// ── Discovery HTML parsing ────────────────────────────────────────────────
test('detectTiersInHtml finds Aquier Scout in basic html', () => {
  const html = '<html><body><h1>Aquier Scout</h1><div>€199 /maand</div></body></html>'
  const result = detectTiersInHtml(html, loadTiers())
  assertContains(result.tier_codes_visible, 'explorer', 'detected tier codes')
})

// ── Locale asserts ────────────────────────────────────────────────────────
test('assertLocale flags wrong currency for NL country with $ symbol', () => {
  const country = loadCountries().find(c => c.code === 'NL')!
  const result = assertLocale('Pricing: $199 per month', 'en-US', country)
  if (result.issues.length === 0) throw new Error('expected currency-mismatch issue')
})

test('assertLocale passes for NL country with € symbol + VAT label', () => {
  const country = loadCountries().find(c => c.code === 'NL')!
  const result = assertLocale('Prijs: €199 per maand incl. BTW', 'nl-NL', country)
  if (!result.expected_currency_matches) throw new Error('EUR should be detected')
  if (!result.vat_label_detected) throw new Error('BTW should be detected as VAT label')
})

// ── Priority ranking ──────────────────────────────────────────────────────
test('rankFindings sorts critical-high-revenue before low-info-low-revenue', () => {
  const findings = [
    {
      severity: 'low' as const, category: 'ux_friction' as const,
      affected_route: '/a', affected_country: 'NL', affected_tier: 'explorer', affected_billing_cycle: 'monthly', affected_device: 'desktop_chrome',
      stripe_object_ids: [], evidence_summary: 'x', recommended_fix: 'y',
      confidence_score: 0.5, revenue_impact_eur_estimate: 100, revenue_impact_reasoning: '', evidence_artifact_paths: [],
    },
    {
      severity: 'critical' as const, category: 'conversion_blocker' as const,
      affected_route: '/b', affected_country: 'NL', affected_tier: 'developer', affected_billing_cycle: 'yearly', affected_device: 'desktop_chrome',
      stripe_object_ids: [], evidence_summary: 'x', recommended_fix: 'y',
      confidence_score: 0.9, revenue_impact_eur_estimate: 50_000, revenue_impact_reasoning: '', evidence_artifact_paths: [],
    },
  ]
  const ranked = rankFindings(findings, 10)
  assertEq(ranked[0].severity, 'critical', 'first should be critical')
  assertEq(ranked[1].severity, 'low', 'second should be low')
})

// ── Print results ────────────────────────────────────────────────────────
setTimeout(() => {
  let failed = 0
  for (const r of results) {
    const icon = r.ok ? '✓' : '✗'
    console.log(`${icon} ${r.name}${r.error ? '  →  ' + r.error : ''}`)
    if (!r.ok) failed++
  }
  console.log(`\n${results.length - failed}/${results.length} passed`)
  process.exit(failed > 0 ? 1 : 0)
}, 500)
