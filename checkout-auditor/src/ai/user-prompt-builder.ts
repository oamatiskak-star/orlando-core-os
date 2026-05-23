import type { Scenario, Observations } from '../types'
import type { TierSpec, CountrySpec } from '../types'

export type ScenarioWithObservations = {
  scenario: Scenario
  observations: Observations
  tier_spec: TierSpec
  country_spec: CountrySpec
  scenario_db_id: string
  scenario_status: 'passed' | 'failed' | 'skipped' | 'blocked'
  error_message: string | null
}

export function buildUserPrompt(items: ScenarioWithObservations[], runMeta: { run_id: string; total: number; subset_offset: number }): string {
  const lines: string[] = []
  lines.push(`# Audit Run ${runMeta.run_id} — batch ${runMeta.subset_offset + 1} of ${Math.ceil(runMeta.total / Math.max(1, items.length))}`)
  lines.push(`Scenarios in this batch: ${items.length}`)
  lines.push('')
  lines.push('## Scenarios + Observations')
  for (const item of items) {
    lines.push('')
    lines.push(`### scenario: ${item.scenario.scenario_code} [db_id ${item.scenario_db_id}]`)
    lines.push(`- intended: tier=${item.scenario.tier_code} (${item.tier_spec.display_name}); billing=${item.scenario.billing_cycle}; country=${item.scenario.country_code} (${item.country_spec.name}); device=${item.scenario.device}; negative=${item.scenario.negative_case ?? 'none'}`)
    lines.push(`- status: ${item.scenario_status}${item.error_message ? ` (error: ${item.error_message})` : ''}`)
    lines.push(`- tier spec (DB source of truth):`)
    lines.push(`    expected_prices_eur: ${JSON.stringify(item.tier_spec.expected_prices_eur)}`)
    lines.push(`    flow_type: ${item.tier_spec.flow_type}`)
    lines.push(`- country spec:`)
    lines.push(`    locale: ${item.country_spec.locale_default}; currency: ${item.country_spec.currency_expected}; vat_rate_b2c: ${item.country_spec.vat_rate_b2c_standard}`)
    lines.push(`    launch_status: ${item.country_spec.launch_status_in_plan}`)
    lines.push(`- page observations:`)
    lines.push('```json')
    lines.push(JSON.stringify(item.observations.page_observations, null, 2))
    lines.push('```')
    if (item.observations.stripe_session) {
      lines.push(`- stripe session observation:`)
      lines.push('```json')
      lines.push(JSON.stringify(item.observations.stripe_session, null, 2))
      lines.push('```')
    } else {
      lines.push(`- stripe session: (not reached or discovery-only)`)
    }
    lines.push(`- webhook observation:`)
    lines.push('```json')
    lines.push(JSON.stringify(item.observations.webhooks, null, 2))
    lines.push('```')
    lines.push(`- database sync:`)
    lines.push('```json')
    lines.push(JSON.stringify(item.observations.database_sync, null, 2))
    lines.push('```')
    if (item.observations.artifacts.length > 0) {
      lines.push(`- artifacts captured: ${item.observations.artifacts.length}`)
      lines.push(`  paths: ${item.observations.artifacts.slice(0, 3).map(a => a.storage_path).join(', ')}${item.observations.artifacts.length > 3 ? ', ...' : ''}`)
    }
  }
  lines.push('')
  lines.push('## Required output')
  lines.push('Return one JSON object matching AuditorOutputSchema. Findings array may be empty if nothing wrong. Summary fields must be filled even if zero findings.')
  return lines.join('\n')
}
