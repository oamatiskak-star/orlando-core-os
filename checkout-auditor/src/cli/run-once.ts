#!/usr/bin/env node
/**
 * CLI runner for manual invocation:
 *   npm run cli:discover -- --country=NL
 *   npm run cli:scenario -- --tier=explorer --country=NL --device=desktop_chrome --cycle=monthly
 *   npm run cli:analyze -- --run-id=<uuid>
 *   npm run cli:audit -- --max=5
 */
import 'dotenv/config'
import { runAudit } from '../runner/audit-runner'
import { runDiscovery } from '../discovery'
import { runScenario } from '../runner/scenario-runner'
import { supabase } from '../lib/supabase'
import { closeBrowsers } from '../playwright/browser-pool'
import { logger } from '../lib/logger'
import { loadCountries, loadTiers } from '../specs'
import type { Device, BillingCycle, Scenario } from '../types'

function arg(name: string): string | undefined {
  const a = process.argv.find(a => a.startsWith(`--${name}=`))
  return a?.slice(name.length + 3)
}

async function main(): Promise<void> {
  const subcommand = process.argv[2]
  if (!subcommand) {
    console.error('Usage: cli:<discover|scenario|analyze|audit> -- --options')
    process.exit(1)
  }

  switch (subcommand) {
    case 'discover': {
      const country = arg('country')
      const countries = country ? [country.toUpperCase()] : undefined
      const { data: run } = await supabase
        .from('aquier_audit_runs')
        .insert({ status: 'running', triggered_by: 'cli_discovery', scope_filter: { country_codes: countries, discovery_only: true } })
        .select('id')
        .single()
      if (!run) throw new Error('run insert failed')
      const snaps = await runDiscovery(run.id as string, countries)
      await supabase.from('aquier_audit_runs')
        .update({ status: 'completed', completed_at: new Date().toISOString(), totals: { discovery_snapshots: snaps.length } })
        .eq('id', run.id as string)
      console.log(JSON.stringify({ run_id: run.id, snapshots: snaps }, null, 2))
      break
    }
    case 'scenario': {
      const tierCode = arg('tier') ?? 'explorer'
      const country = (arg('country') ?? 'NL').toUpperCase()
      const device = (arg('device') ?? 'desktop_chrome') as Device
      const cycle = (arg('cycle') ?? 'monthly') as BillingCycle
      const tier = loadTiers().find(t => t.code === tierCode)
      const ctry = loadCountries().find(c => c.code === country)
      if (!tier || !ctry) throw new Error(`Unknown tier ${tierCode} or country ${country}`)

      const { data: run } = await supabase
        .from('aquier_audit_runs')
        .insert({ status: 'running', triggered_by: 'cli_scenario', scope_filter: { tier_codes: [tierCode], country_codes: [country], devices: [device], billing_cycles: [cycle] } })
        .select('id')
        .single()
      if (!run) throw new Error('run insert failed')

      const scenario: Scenario = {
        scenario_code: `${tierCode}--${cycle}--${country}--${device}`,
        tier_code: tierCode,
        billing_cycle: cycle,
        country_code: country,
        device,
        negative_case: null,
        is_discovery_only: tier.flow_type !== 'self_serve_stripe',
      }
      const outcome = await runScenario(run.id as string, scenario)
      await supabase.from('aquier_audit_runs')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('id', run.id as string)
      console.log(JSON.stringify({ run_id: run.id, scenario: outcome }, null, 2))
      break
    }
    case 'audit': {
      const max = Number(arg('max') ?? 20)
      const result = await runAudit({ max_scenarios: max }, 'cli')
      console.log(JSON.stringify(result, null, 2))
      break
    }
    case 'analyze': {
      console.error('analyze: stand-alone analyze of an existing run is not supported in v1; use audit command end-to-end')
      process.exit(1)
      break
    }
    default:
      console.error(`Unknown subcommand: ${subcommand}`)
      process.exit(1)
  }
}

main()
  .then(async () => {
    await closeBrowsers()
    process.exit(0)
  })
  .catch(async err => {
    logger.error({ err: String(err) }, 'cli failed')
    await closeBrowsers().catch(() => {})
    process.exit(1)
  })
