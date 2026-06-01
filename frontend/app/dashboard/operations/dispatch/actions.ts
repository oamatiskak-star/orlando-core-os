'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'

const PATH = '/dashboard/operations/dispatch'

export type EnqueueInput = {
  title: string
  workstream?: string | null
  repo?: string | null
  target_host: 'cli-l' | 'cli-r' | 'any'
  priority: number
}

export async function enqueueTask(input: EnqueueInput) {
  if (!input.title?.trim()) return { ok: false, error: 'Titel vereist' }
  const db = createAdminClient()
  const { error } = await db.schema('hermes').from('dispatch_queue').insert({
    title: input.title.trim(),
    workstream: input.workstream || null,
    repo: input.repo || null,
    target_host: input.target_host,
    priority: Number.isFinite(input.priority) ? input.priority : 5,
  })
  if (error) return { ok: false, error: error.message }
  revalidatePath(PATH)
  return { ok: true }
}

export async function claimForHost(host: 'cli-l' | 'cli-r', limit = 5) {
  const db = createAdminClient()
  const { data, error } = await db.schema('hermes').rpc('dispatch_claim', { p_host: host, p_limit: limit })
  if (error) return { ok: false, error: error.message }
  revalidatePath(PATH)
  return { ok: true, claimed: Array.isArray(data) ? data.length : 0 }
}

export async function setTaskStatus(
  id: string,
  status: 'queued' | 'claimed' | 'running' | 'done' | 'failed' | 'blocked',
) {
  const db = createAdminClient()
  const patch: Record<string, unknown> = { status }
  if (status === 'queued') { patch.claimed_by = null; patch.claimed_at = null }
  if (status === 'running') patch.heartbeat_at = new Date().toISOString()
  const { error } = await db.schema('hermes').from('dispatch_queue').update(patch).eq('id', id)
  if (error) return { ok: false, error: error.message }
  revalidatePath(PATH)
  return { ok: true }
}

export async function releaseTask(id: string) {
  return setTaskStatus(id, 'queued')
}
