import { createClient, SupabaseClient } from '@supabase/supabase-js'

let client: SupabaseClient | null = null

export function getClient(): SupabaseClient | null {
  if (client) return client
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.warn('[local-watchdog/supabase] no credentials — stateless mode')
    return null
  }
  client = createClient(url, key, { auth: { persistSession: false } })
  return client
}

export type EventKind =
  | 'fail_detected'
  | 'restart_triggered'
  | 'rebuild_triggered'
  | 'recovered'
  | 'escalated'
  | 'check_error'

export interface WatchdogEvent {
  host_id: string
  service_id: string
  service_name: string
  service_type: string
  kind: EventKind
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
      host_id: ev.host_id,
      service_id: ev.service_id,
      service_name: ev.service_name,
      service_type: ev.service_type,
      kind: ev.kind,
      attempt: ev.attempt ?? null,
      message: ev.message ?? null,
      logs_tail: ev.logs_tail ?? null,
      metadata: ev.metadata ?? null
    })
    if (error) console.error('[local-watchdog/supabase] insert event error:', error.message)
  } catch (err) {
    console.error('[local-watchdog/supabase] insert event throw:', err instanceof Error ? err.message : err)
  }
}

export interface IncidentInput {
  host_id: string
  service_id: string
  service_name: string
  service_type: string
  incident_key: string
  failure_kind: string
  failure_summary: string
  logs_tail: string
  attempts_made: number
  proposed_actions: string[]
}

export async function openIncident(input: IncidentInput): Promise<void> {
  const c = getClient()
  if (!c) return
  try {
    const { error } = await c.from('infra_watchdog_incidents').upsert(
      {
        host_id: input.host_id,
        deploy_id: input.incident_key,
        service_id: input.service_id,
        service_name: input.service_name,
        service_type: input.service_type,
        failure_kind: input.failure_kind,
        failure_summary: input.failure_summary,
        logs_tail: input.logs_tail,
        attempts_made: input.attempts_made,
        proposed_actions: input.proposed_actions,
        status: 'open',
        opened_at: new Date().toISOString()
      },
      { onConflict: 'host_id,deploy_id' }
    )
    if (error) console.error('[local-watchdog/supabase] upsert incident error:', error.message)
  } catch (err) {
    console.error('[local-watchdog/supabase] upsert incident throw:', err instanceof Error ? err.message : err)
  }
}

export async function resolveIncident(hostId: string, incidentKey: string): Promise<void> {
  const c = getClient()
  if (!c) return
  try {
    await c
      .from('infra_watchdog_incidents')
      .update({ status: 'resolved', resolved_at: new Date().toISOString() })
      .eq('host_id', hostId)
      .eq('deploy_id', incidentKey)
      .eq('status', 'open')
  } catch (err) {
    console.error('[local-watchdog/supabase] resolve incident throw:', err instanceof Error ? err.message : err)
  }
}
