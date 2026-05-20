import { getSupabase } from './supabase'

// ─────────────────────────────────────────────────────────────────────────────
// media_holding_workers status helper. Worker schrijft naar zijn eigen rij:
// {idle | running | paused | offline | error}.
// last_seen, last_error, queue_depth worden bij elke heartbeat bijgewerkt.
// ─────────────────────────────────────────────────────────────────────────────

export type WorkerStatus = 'idle' | 'running' | 'paused' | 'offline' | 'error'

export async function getWorkerConfig(name: string): Promise<Record<string, unknown>> {
  const db = getSupabase()
  const { data } = await db.from('media_holding_workers').select('config').eq('name', name).single()
  return (data?.config as Record<string, unknown>) ?? {}
}

export async function setWorkerStatus(
  name: string,
  status: WorkerStatus,
  extra: { last_error?: string | null; queue_depth?: number } = {},
): Promise<void> {
  const db = getSupabase()
  await db.from('media_holding_workers').update({
    status,
    last_seen:   new Date().toISOString(),
    last_error:  extra.last_error ?? null,
    queue_depth: extra.queue_depth ?? 0,
    updated_at:  new Date().toISOString(),
  }).eq('name', name)
}

export async function workerExists(name: string): Promise<boolean> {
  const db = getSupabase()
  const { data } = await db.from('media_holding_workers').select('id').eq('name', name).maybeSingle()
  return !!data
}
