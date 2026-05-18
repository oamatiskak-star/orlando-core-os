import { db } from './db.js'

export interface QueuedTask {
  id: string
  kind: string
  tier: string
  priority: number
  payload: Record<string, unknown>
  retry_count: number
  max_retries: number
  workflow_run_id: string | null
  parent_task_id: string | null
}

export async function enqueueTask(input: {
  kind: string
  tier?: string
  priority?: number
  payload?: Record<string, unknown>
  workflowRunId?: string
  parentTaskId?: string
  cacheKey?: string
  visibleAt?: Date
  maxRetries?: number
}): Promise<string> {
  const { data, error } = await db()
    .from('ai_tasks')
    .insert({
      kind: input.kind,
      tier: input.tier ?? 'general',
      priority: input.priority ?? 50,
      payload: input.payload ?? {},
      workflow_run_id: input.workflowRunId ?? null,
      parent_task_id: input.parentTaskId ?? null,
      cache_key: input.cacheKey ?? null,
      visible_at: (input.visibleAt ?? new Date()).toISOString(),
      max_retries: input.maxRetries ?? 3,
    })
    .select('id')
    .single()
  if (error) throw error
  return data.id as string
}

export async function claimTask(nodeId: string, kinds?: string[], leaseSeconds = 120): Promise<QueuedTask | null> {
  const { data, error } = await db().rpc('ai_tasks_claim', {
    p_node_id: nodeId,
    p_kinds: kinds ?? null,
    p_lease_seconds: leaseSeconds,
  })
  if (error) throw error
  const row = Array.isArray(data) ? data[0] : data
  return row ?? null
}

export async function completeTask(id: string, result: Record<string, unknown>): Promise<void> {
  await db()
    .from('ai_tasks')
    .update({
      status: 'completed',
      result,
      completed_at: new Date().toISOString(),
      claim_expires_at: null,
    })
    .eq('id', id)
}

export async function failTask(id: string, error: string, retry = true): Promise<void> {
  const { data: row } = await db()
    .from('ai_tasks')
    .select('retry_count, max_retries')
    .eq('id', id)
    .single()
  const rc = row?.retry_count ?? 0
  const mr = row?.max_retries ?? 3
  if (retry && rc < mr) {
    await db()
      .from('ai_tasks')
      .update({
        status: 'queued',
        retry_count: rc + 1,
        claimed_by: null,
        claim_expires_at: null,
        visible_at: new Date(Date.now() + Math.min(30 * (rc + 1), 300) * 1000).toISOString(),
        error,
      })
      .eq('id', id)
  } else {
    await db()
      .from('ai_tasks')
      .update({
        status: 'failed',
        error,
        completed_at: new Date().toISOString(),
        claim_expires_at: null,
      })
      .eq('id', id)
  }
}

export async function reapStuckTasks(): Promise<number> {
  const { data, error } = await db().rpc('ai_tasks_reap')
  if (error) throw error
  return (data as number) ?? 0
}

export async function heartbeatNode(nodeId: string, hostname: string, role: 'brain' | 'worker' | 'gpu' | 'cloud', capabilities: string[] = []): Promise<void> {
  await db()
    .from('ai_nodes')
    .upsert(
      {
        id: nodeId,
        hostname,
        role,
        capabilities,
        status: 'online',
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: 'id' },
    )
}
