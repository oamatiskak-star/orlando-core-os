import { createHash } from 'node:crypto'
import { db } from './db.js'
import { config } from './config.js'
import type { CompletionRequest, CompletionResponse } from './types.js'

export function deriveCacheKey(req: CompletionRequest): string {
  if (req.cacheKey) return req.cacheKey
  const h = createHash('sha256')
  h.update(req.tier ?? 'general')
  h.update('|')
  h.update(req.system ?? '')
  h.update('|')
  for (const m of req.messages) {
    h.update(m.role)
    h.update(':')
    h.update(m.content)
    h.update('\n')
  }
  h.update(`|t=${req.temperature ?? 0}|mt=${req.maxTokens ?? 0}|j=${req.jsonMode ? 1 : 0}`)
  return `c_${h.digest('hex').slice(0, 40)}`
}

export async function cacheGet(key: string): Promise<CompletionResponse | null> {
  if (!config.cache.enabled) return null
  const { data, error } = await db()
    .from('ai_cache')
    .select('response, expires_at')
    .eq('cache_key', key)
    .maybeSingle()
  if (error || !data) return null
  if (data.expires_at && new Date(data.expires_at).getTime() < Date.now()) return null

  // bump hit count (best-effort, not awaited critically)
  await db().rpc('noop').catch(() => {})
  await db()
    .from('ai_cache')
    .update({ hits: (data as any).hits ? (data as any).hits + 1 : 1 })
    .eq('cache_key', key)
    .then(() => {}, () => {})

  return data.response as CompletionResponse
}

export async function cachePut(
  key: string,
  tier: string | undefined,
  modelName: string,
  response: CompletionResponse,
): Promise<void> {
  if (!config.cache.enabled) return
  const payload = {
    cache_key: key,
    tier: tier ?? null,
    model_name: modelName,
    response,
    bytes: JSON.stringify(response).length,
    expires_at: new Date(Date.now() + config.cache.ttlSeconds * 1000).toISOString(),
  }
  await db().from('ai_cache').upsert(payload, { onConflict: 'cache_key' })
}
