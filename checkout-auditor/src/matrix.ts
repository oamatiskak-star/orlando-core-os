import { loadTiers, loadCountries, loadDevices, loadNegativeScenarios } from './specs'
import type { Scenario, ScopeFilter, BillingCycle, Device } from './types'

/**
 * Build the full scenario matrix.
 *
 * Defaults (no scope filter):
 *   - All tiers × supported cycles × all countries × all devices
 *   - Institutional/Private tiers (sales_contact_form) become discovery-only scenarios
 *   - Negative scenarios appended once per "core" combo (1 tier × 1 country × 1 device × 1 cycle)
 *
 * Output is deterministically sorted for reproducible runs.
 */
export function buildScenarioMatrix(scope: Partial<ScopeFilter> = {}): Scenario[] {
  const tiers = loadTiers()
  const countries = loadCountries()
  const devices = loadDevices()
  const negatives = loadNegativeScenarios()

  const filteredTiers = scope.tier_codes?.length
    ? tiers.filter(t => scope.tier_codes!.includes(t.code))
    : tiers
  const filteredCountries = scope.country_codes?.length
    ? countries.filter(c => scope.country_codes!.includes(c.code))
    : countries
  const filteredDevices: Device[] = scope.devices?.length ? scope.devices : devices.map(d => d.id)

  const scenarios: Scenario[] = []

  for (const tier of filteredTiers) {
    const isSelfServe = tier.flow_type === 'self_serve_stripe'
    const tierCycles: BillingCycle[] = scope.billing_cycles?.length
      ? scope.billing_cycles.filter(c => tier.billing_cycles_supported.includes(c))
      : tier.billing_cycles_supported

    for (const country of filteredCountries) {
      for (const device of filteredDevices) {
        // For sales-contact-form tiers we only test ONE device + ONE cycle as discovery
        if (!isSelfServe) {
          scenarios.push({
            scenario_code: code(tier.code, 'n/a', country.code, device, null),
            tier_code: tier.code,
            billing_cycle: 'n/a',
            country_code: country.code,
            device,
            negative_case: null,
            is_discovery_only: true,
          })
          break // one device only for institutional/private
        }
        for (const cycle of tierCycles) {
          scenarios.push({
            scenario_code: code(tier.code, cycle, country.code, device, null),
            tier_code: tier.code,
            billing_cycle: cycle,
            country_code: country.code,
            device,
            negative_case: null,
            is_discovery_only: false,
          })
        }
      }
    }
  }

  // Negative scenarios — only against a self-serve tier (skipped if scope has no self-serve)
  if (scope.include_negative_cases !== false) {
    const coreTier = filteredTiers.find(t => t.flow_type === 'self_serve_stripe')
    const coreCountry = filteredCountries.find(c => c.code === 'NL') ?? filteredCountries[0]
    const coreDevice: Device = 'desktop_chrome'
    if (coreTier && coreCountry) {
      for (const neg of negatives) {
        scenarios.push({
          scenario_code: code(coreTier.code, 'monthly', coreCountry.code, coreDevice, neg.id),
          tier_code: coreTier.code,
          billing_cycle: 'monthly',
          country_code: coreCountry.code,
          device: coreDevice,
          negative_case: neg.id,
          is_discovery_only: false,
        })
      }
    }
  }

  // Deduplicate + deterministic sort
  const seen = new Set<string>()
  const unique = scenarios.filter(s => {
    if (seen.has(s.scenario_code)) return false
    seen.add(s.scenario_code)
    return true
  })
  unique.sort((a, b) => a.scenario_code.localeCompare(b.scenario_code))

  // Cap on max_scenarios
  const max = scope.max_scenarios ?? unique.length
  return unique.slice(0, max)
}

function code(tier: string, cycle: BillingCycle, country: string, device: Device, negative: string | null): string {
  const neg = negative ? `--neg-${negative}` : ''
  return `${tier}--${cycle}--${country}--${device}${neg}`
}
