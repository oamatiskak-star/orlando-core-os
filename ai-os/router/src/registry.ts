import { db } from './db.js'
import type { ModelRecord, ProviderId, Tier } from './types.js'

interface Cached {
  data: ModelRecord[]
  loadedAt: number
}

let cache: Cached | null = null
const TTL_MS = 30_000

export async function loadModels(force = false): Promise<ModelRecord[]> {
  if (!force && cache && Date.now() - cache.loadedAt < TTL_MS) return cache.data
  const { data, error } = await db()
    .from('ai_models')
    .select('*')
    .eq('is_available', true)
    .order('priority', { ascending: false })
  if (error) throw error
  const rows = (data ?? []) as unknown as ModelRecord[]
  cache = { data: rows, loadedAt: Date.now() }
  return rows
}

export function invalidateRegistry(): void {
  cache = null
}

export async function markHealth(
  modelId: string,
  status: 'healthy' | 'degraded' | 'down' | 'unknown',
): Promise<void> {
  await db()
    .from('ai_models')
    .update({ health_status: status, last_check_at: new Date().toISOString() })
    .eq('id', modelId)
  invalidateRegistry()
}

export async function upsertModel(rec: {
  provider: ProviderId
  modelId: string
  displayName: string
  tier: Tier
  contextWindow?: number
  costIn?: number
  costOut?: number
  isLocal: boolean
  endpointUrl?: string
  nodeId?: string
  priority?: number
  capabilities?: string[]
}): Promise<void> {
  await db().from('ai_models').upsert(
    {
      provider: rec.provider,
      model_id: rec.modelId,
      display_name: rec.displayName,
      tier: rec.tier,
      context_window: rec.contextWindow ?? 8192,
      cost_in_per_mtok: rec.costIn ?? 0,
      cost_out_per_mtok: rec.costOut ?? 0,
      is_local: rec.isLocal,
      endpoint_url: rec.endpointUrl ?? null,
      node_id: rec.nodeId ?? null,
      priority: rec.priority ?? 50,
      capabilities: rec.capabilities ?? [],
      is_available: true,
    },
    { onConflict: 'provider,model_id,node_id' },
  )
  invalidateRegistry()
}
