import { db } from './db.js'
import type { ProviderId, Tier } from './types.js'

export interface UsageRecord {
  modelId?: string | null
  provider: ProviderId
  modelName: string
  tier?: Tier
  caller?: string
  taskId?: string
  workflowRunId?: string
  inputTokens: number
  outputTokens: number
  latencyMs: number
  costUsd: number
  cacheHit: boolean
  status: 'ok' | 'error' | 'timeout' | 'rate_limited'
  error?: string
}

export async function recordUsage(rec: UsageRecord): Promise<void> {
  await db()
    .from('ai_usage')
    .insert({
      model_id: rec.modelId ?? null,
      provider: rec.provider,
      model_name: rec.modelName,
      tier: rec.tier ?? null,
      caller: rec.caller ?? null,
      task_id: rec.taskId ?? null,
      workflow_run_id: rec.workflowRunId ?? null,
      input_tokens: rec.inputTokens,
      output_tokens: rec.outputTokens,
      latency_ms: rec.latencyMs,
      cost_usd: rec.costUsd,
      cache_hit: rec.cacheHit,
      status: rec.status,
      error: rec.error ?? null,
    })
    .then(() => {}, () => {})
}

export function computeCost(model: { cost_in_per_mtok: number; cost_out_per_mtok: number }, inT: number, outT: number): number {
  return (inT * model.cost_in_per_mtok) / 1_000_000 + (outT * model.cost_out_per_mtok) / 1_000_000
}
