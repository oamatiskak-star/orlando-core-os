import { createClient, SupabaseClient } from '@supabase/supabase-js'

let client: SupabaseClient | null = null

function getClient(): SupabaseClient | null {
  if (client) return client
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.warn('[watchdog/supabase] no credentials — running in stateless mode')
    return null
  }
  client = createClient(url, key, { auth: { persistSession: false } })
  return client
}

export type EventKind =
  | 'fail_detected'
  | 'restart_triggered'
  | 'redeploy_triggered'
  | 'recovered'
  | 'escalated'
  | 'check_error'
  | 'cleanup_candidate'
  | 'cleanup_deleted'
  | 'cleanup_skipped'
  | 'cleanup_error'

export interface WatchdogEvent {
  service_id: string
  service_name: string
  service_type: string
  kind: EventKind
  deploy_id?: string | null
  deploy_status?: string | null
  attempt?: number | null
  message?: string | null
  logs_tail?: string | null
  metadata?: Record<string, unknown> | null
}

export async function recordEvent(ev: WatchdogEvent): Promise<void> {
  const c = getClient()
  if (!c) return
  try {
    const { error } = await c.from('infra_watchdog_events').insert({
      host_id: 'render',
      service_id: ev.service_id,
      service_name: ev.service_name,
      service_type: ev.service_type,
      kind: ev.kind,
      deploy_id: ev.deploy_id ?? null,
      deploy_status: ev.deploy_status ?? null,
      attempt: ev.attempt ?? null,
      message: ev.message ?? null,
      logs_tail: ev.logs_tail ?? null,
      metadata: ev.metadata ?? null
    })
    if (error) console.error('[watchdog/supabase] insert event error:', error.message)
  } catch (err) {
    console.error('[watchdog/supabase] insert event throw:', err instanceof Error ? err.message : err)
  }
}

export interface IncidentInput {
  service_id: string
  service_name: string
  service_type: string
  deploy_id: string
  failure_kind: string
  failure_summary: string
  logs_tail: string
  commit_sha?: string
  commit_message?: string
  attempts_made: number
  proposed_actions: string[]
}

export async function openIncident(input: IncidentInput): Promise<void> {
  const c = getClient()
  if (!c) return
  try {
    const { error } = await c.from('infra_watchdog_incidents').upsert(
      {
        host_id: 'render',
        service_id: input.service_id,
        deploy_id: input.deploy_id,
        service_name: input.service_name,
        service_type: input.service_type,
        failure_kind: input.failure_kind,
        failure_summary: input.failure_summary,
        logs_tail: input.logs_tail,
        commit_sha: input.commit_sha ?? null,
        commit_message: input.commit_message ?? null,
        attempts_made: input.attempts_made,
        proposed_actions: input.proposed_actions,
        status: 'open',
        opened_at: new Date().toISOString()
      },
      { onConflict: 'host_id,deploy_id' }
    )
    if (error) console.error('[watchdog/supabase] upsert incident error:', error.message)
  } catch (err) {
    console.error('[watchdog/supabase] upsert incident throw:', err instanceof Error ? err.message : err)
  }
}

export async function resolveIncident(deployId: string): Promise<void> {
  const c = getClient()
  if (!c) return
  try {
    await c
      .from('infra_watchdog_incidents')
      .update({ status: 'resolved', resolved_at: new Date().toISOString() })
      .eq('host_id', 'render')
      .eq('deploy_id', deployId)
      .eq('status', 'open')
  } catch (err) {
    console.error('[watchdog/supabase] resolve incident throw:', err instanceof Error ? err.message : err)
  }
}
