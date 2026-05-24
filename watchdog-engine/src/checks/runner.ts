import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { CheckResult, CheckRow, CheckType } from './types'
import { runHttpPing } from './runners/http-ping'
import { runHeartbeat } from './runners/heartbeat'
import { runQueueDepth } from './runners/queue-depth'
import { runDataFreshness } from './runners/data-freshness'
import { runCronLateness } from './runners/cron-lateness'
import { sendTelegram } from '../telegram'

interface CheckState {
  consecutiveFailures: number
  lastRunAt: number
  escalated: boolean
  lastIncidentKey: string | null
  wasFailing: boolean
}

const stateByCheckId = new Map<string, CheckState>()

function defaultState(): CheckState {
  return { consecutiveFailures: 0, lastRunAt: 0, escalated: false, lastIncidentKey: null, wasFailing: false }
}

function dispatch(type: CheckType, check: CheckRow, url: string, key: string): Promise<CheckResult> {
  switch (type) {
    case 'http_ping': return runHttpPing(check)
    case 'heartbeat': return runHeartbeat(check, url, key)
    case 'queue_depth': return runQueueDepth(check, url, key)
    case 'data_freshness': return runDataFreshness(check, url, key)
    case 'cron_lateness': return runCronLateness(check, url, key)
    default:
      return Promise.resolve({ ok: false, message: `unknown check_type ${type}` })
  }
}

export async function runOrganizationChecks(supabaseUrl: string, supabaseKey: string): Promise<void> {
  const client = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } })
  const { data: checks, error } = await client
    .from('infra_watchdog_checks')
    .select('id,slug,display_name,check_type,layer,category,config,threshold,interval_seconds,consecutive_failures_to_escalate,enabled,severity,notes')
    .eq('enabled', true)
  if (error) {
    console.error('[watchdog/checks] list checks failed:', error.message)
    return
  }
  if (!checks || checks.length === 0) return

  const now = Date.now()
  for (const raw of checks as CheckRow[]) {
    const state = stateByCheckId.get(raw.id) ?? defaultState()
    if (state.lastRunAt > 0 && now - state.lastRunAt < raw.interval_seconds * 1000) {
      continue
    }
    state.lastRunAt = now
    stateByCheckId.set(raw.id, state)

    let result: CheckResult
    try {
      result = await dispatch(raw.check_type, raw, supabaseUrl, supabaseKey)
    } catch (err) {
      result = { ok: false, message: `runner threw: ${err instanceof Error ? err.message : err}` }
    }

    await recordCheckRun(client, raw.id, result)

    if (result.ok) {
      if (state.wasFailing) {
        await sendTelegram(
          'info',
          `✅ ${raw.display_name} recovered`,
          `Check '${raw.slug}' is healthy again.`
        )
        if (state.lastIncidentKey) {
          await resolveCheckIncident(client, state.lastIncidentKey)
        }
      }
      state.consecutiveFailures = 0
      state.escalated = false
      state.wasFailing = false
      state.lastIncidentKey = null
      stateByCheckId.set(raw.id, state)
      continue
    }

    state.consecutiveFailures += 1
    state.wasFailing = true
    stateByCheckId.set(raw.id, state)

    if (state.consecutiveFailures === 1) {
      await sendTelegram(
        raw.severity,
        `${severityIcon(raw.severity)} ${raw.display_name}`,
        [
          `Check: ${raw.slug}`,
          `Type: ${raw.check_type} (${raw.layer}/${raw.category ?? '-'})`,
          `Result: ${result.message ?? 'failed'}`,
          `Will escalate after ${raw.consecutive_failures_to_escalate} consecutive failures.`
        ].join('\n')
      )
    }

    if (!state.escalated && state.consecutiveFailures >= raw.consecutive_failures_to_escalate) {
      const incidentKey = `check:${raw.slug}:${now}`
      await openCheckIncident(client, raw, result, incidentKey, state.consecutiveFailures)
      state.escalated = true
      state.lastIncidentKey = incidentKey
      stateByCheckId.set(raw.id, state)
      await sendTelegram(
        'critical',
        `🚨 ${raw.display_name} failed ${state.consecutiveFailures}× — escalated`,
        [
          `Check: ${raw.slug}`,
          `Type: ${raw.check_type}`,
          `Reason: ${result.message ?? 'failed'}`,
          raw.notes ? `Notes: ${raw.notes}` : '',
          '',
          `Incident opened: infra_watchdog_incidents.deploy_id='${incidentKey}'`
        ].filter(Boolean).join('\n')
      )
    }
  }
}

function severityIcon(s: string): string {
  if (s === 'critical') return '🚨'
  if (s === 'error') return '🔴'
  if (s === 'warning') return '⚠️'
  return 'ℹ️'
}

async function recordCheckRun(client: SupabaseClient, checkId: string, r: CheckResult): Promise<void> {
  try {
    await client.from('infra_watchdog_check_runs').insert({
      check_id: checkId,
      ok: r.ok,
      latency_ms: r.latency_ms ?? null,
      value: r.value ?? null,
      message: r.message ?? null,
      metadata: r.metadata ?? null
    })
  } catch (err) {
    console.error('[watchdog/checks] insert run failed:', err instanceof Error ? err.message : err)
  }
}

async function openCheckIncident(
  client: SupabaseClient,
  check: CheckRow,
  result: CheckResult,
  incidentKey: string,
  attempts: number
): Promise<void> {
  try {
    await client.from('infra_watchdog_incidents').upsert(
      {
        host_id: 'organization',
        deploy_id: incidentKey,
        service_id: check.id,
        service_name: check.display_name,
        service_type: check.check_type,
        failure_kind: check.check_type,
        failure_summary: result.message ?? 'check failed',
        logs_tail: JSON.stringify(result.metadata ?? {}, null, 2).slice(0, 6000),
        attempts_made: attempts,
        proposed_actions: proposedActions(check, result),
        status: 'open',
        opened_at: new Date().toISOString(),
        check_slug: check.slug,
        incident_kind: 'check_failure'
      },
      { onConflict: 'host_id,deploy_id' }
    )
  } catch (err) {
    console.error('[watchdog/checks] open incident failed:', err instanceof Error ? err.message : err)
  }
}

async function resolveCheckIncident(client: SupabaseClient, incidentKey: string): Promise<void> {
  try {
    await client
      .from('infra_watchdog_incidents')
      .update({ status: 'resolved', resolved_at: new Date().toISOString() })
      .eq('host_id', 'organization')
      .eq('deploy_id', incidentKey)
      .eq('status', 'open')
  } catch (err) {
    console.error('[watchdog/checks] resolve incident failed:', err instanceof Error ? err.message : err)
  }
}

function proposedActions(check: CheckRow, result: CheckResult): string[] {
  const actions: string[] = []
  switch (check.check_type) {
    case 'http_ping':
      actions.push(`Open URL in browser: ${String(check.config.url ?? '')}`)
      actions.push('Inspect Render dashboard for the matching service and check recent deploys/logs.')
      break
    case 'heartbeat':
      actions.push(`Check that the engine for slug '${check.config.slug ?? check.slug}' is running and writing heartbeats.`)
      actions.push('PM2 status / Render dashboard for the worker.')
      break
    case 'queue_depth':
      actions.push(`Inspect table '${check.config.table}' for stuck rows.`)
      actions.push('Restart the responsible executor(s); check for stuck claimed rows in claim_task RPC.')
      break
    case 'data_freshness':
      actions.push(`Check the cron/worker that inserts into '${check.config.table}' is running.`)
      actions.push('Trigger the relevant ingest job manually.')
      break
    case 'cron_lateness':
      actions.push(`Verify Vercel cron '${check.config.slug ?? check.slug}' fired (Vercel dashboard → cron logs).`)
      actions.push('Manually invoke the cron URL with CRON_SECRET if the route exists.')
      break
  }
  if (result.metadata) {
    actions.push(`Last metadata: ${JSON.stringify(result.metadata).slice(0, 300)}`)
  }
  return actions
}
