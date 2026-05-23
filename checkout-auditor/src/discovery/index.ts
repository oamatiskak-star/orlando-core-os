import { loadCountries, loadDevices, loadTiers } from '../specs'
import { detectRouteStrategy } from './route-prober'
import { detectTiersInHtml } from './tier-availability'
import { supabase } from '../lib/supabase'
import { uploadArtifact, buildArtifactPath } from '../lib/storage'
import { logger } from '../lib/logger'
import { env } from '../lib/secrets'
import { newContextForDevice } from '../playwright/browser-pool'
import type { DiscoverySnapshot, CountrySpec, TierSpec } from '../types'

/**
 * Runs discovery for one country: detects routing strategy, probes /membership
 * via HTTP + Playwright (for SPA-rendered content), extracts visible tiers + pricing,
 * stores snapshot + HTML artifact in DB.
 */
export async function discoverCountry(runId: string, countryCode: string): Promise<DiscoverySnapshot> {
  const country = loadCountries().find(c => c.code === countryCode)
  if (!country) throw new Error(`Unknown country code: ${countryCode}`)

  const tiers = loadTiers()

  // Phase 1: HTTP probe to detect routing strategy + accessibility
  const detection = await detectRouteStrategy(country)
  let html = detection.best_probe.body_excerpt
  let tier_codes_visible: string[] = []
  let pricing_observed: Record<string, unknown> = {}

  // Phase 2: if HTTP-only parse found no tiers AND status is 200, retry via Playwright
  //   (Next.js / SPA needs JS execution to render content)
  if (detection.best_probe.status === 200) {
    const httpParse = detectTiersInHtml(html, tiers)
    if (httpParse.tier_codes_visible.length === 0) {
      logger.info({ country: countryCode }, 'HTTP parse found 0 tiers — falling back to Playwright')
      const renderedHtml = await renderWithPlaywright(country, detection.best_route_path)
      if (renderedHtml && renderedHtml.length > html.length) {
        html = renderedHtml
        const pwParse = detectTiersInHtml(html, tiers)
        tier_codes_visible = pwParse.tier_codes_visible
        pricing_observed = pwParse.pricing_observed
      }
    } else {
      tier_codes_visible = httpParse.tier_codes_visible
      pricing_observed = httpParse.pricing_observed
    }
  }

  // Store HTML snapshot
  let snapshotArtifactId: string | null = null
  if (html.length > 0) {
    const path = buildArtifactPath(runId, null, `discovery-html-${countryCode}`, 'html')
    try {
      await uploadArtifact(path, html, 'text/html')
      const { data: artifactRow } = await supabase
        .from('aquier_audit_artifacts')
        .insert({
          run_id: runId,
          kind: 'dom_snapshot',
          storage_path: path,
          size_bytes: Buffer.byteLength(html),
          mime_type: 'text/html',
        })
        .select('id')
        .single()
      snapshotArtifactId = artifactRow?.id ?? null
    } catch (err) {
      logger.warn({ err: String(err), country: countryCode }, 'snapshot upload failed')
    }
  }

  const snapshot: DiscoverySnapshot = {
    country_code: countryCode,
    locale_resolved: country.locale_default,
    routing_strategy: detection.routing_strategy,
    route_path: detection.best_route_path,
    http_status: detection.best_probe.status,
    accessibility: detection.best_probe.accessibility,
    tier_codes_visible,
    pricing_observed,
    snapshot_html_artifact_id: snapshotArtifactId,
    notes: detection.best_probe.notes,
  }

  // Persist
  await supabase.from('aquier_audit_discovery_snapshots').insert({
    run_id: runId,
    country_code: snapshot.country_code,
    locale_resolved: snapshot.locale_resolved,
    routing_strategy: snapshot.routing_strategy,
    route_path: snapshot.route_path,
    http_status: snapshot.http_status,
    accessibility: snapshot.accessibility,
    tier_codes_visible: snapshot.tier_codes_visible,
    pricing_observed: snapshot.pricing_observed,
    snapshot_html_artifact_id: snapshot.snapshot_html_artifact_id,
    notes: snapshot.notes,
  })

  logger.info({
    country: countryCode,
    routing: snapshot.routing_strategy,
    route: snapshot.route_path,
    status: snapshot.http_status,
    accessibility: snapshot.accessibility,
    tiers_seen: tier_codes_visible.length,
  }, 'discovery completed for country')

  return snapshot
}

/**
 * Render a page via Playwright Chromium with full JS execution, return the post-hydration HTML.
 * Used as fallback when HTTP-only parse finds nothing (Next.js / React SPA).
 */
async function renderWithPlaywright(country: CountrySpec, routePath: string): Promise<string | null> {
  const desktopChrome = loadDevices().find(d => d.id === 'desktop_chrome')
  if (!desktopChrome) return null

  let context
  try {
    context = await newContextForDevice(desktopChrome)
    await context.setExtraHTTPHeaders({ 'Accept-Language': country.locale_default })
    const page = await context.newPage()
    const url = new URL(routePath, env.AQUIER_BASE_URL).toString()
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25_000 })
    // Wait for SPA hydration: either a tier card-like text appears, or 5s networkidle, whichever first
    await Promise.race([
      page.waitForSelector('text=/Aquier (Scout|Developer|Institutional|Black|Private)/i', { timeout: 12_000 }).catch(() => null),
      page.waitForLoadState('networkidle', { timeout: 12_000 }).catch(() => null),
    ])
    const html = await page.content()
    return html
  } catch (err) {
    logger.warn({ err: String(err), country: country.code }, 'Playwright discovery render failed')
    return null
  } finally {
    await context?.close().catch(() => {})
  }
}

/**
 * Run discovery across all countries (or scope subset). Sequential to be polite to aquier.com.
 */
export async function runDiscovery(runId: string, countryCodes?: string[]): Promise<DiscoverySnapshot[]> {
  const allCountries = loadCountries()
  const targets = countryCodes?.length
    ? allCountries.filter(c => countryCodes.includes(c.code))
    : allCountries
  const results: DiscoverySnapshot[] = []
  for (const country of targets) {
    try {
      const snap = await discoverCountry(runId, country.code)
      results.push(snap)
    } catch (err) {
      logger.error({ err: String(err), country: country.code }, 'discovery failed for country')
    }
  }
  return results
}
