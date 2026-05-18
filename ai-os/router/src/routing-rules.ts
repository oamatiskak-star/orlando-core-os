import { config } from './config.js'
import type { CompletionRequest, ModelRecord, ProviderId, Tier } from './types.js'

/**
 * Tier preference map — what *kind* of model is preferred for each tier.
 * The router will walk this in order, filtering models that satisfy the rule,
 * and try the highest-priority available one first.
 *
 *   reasoning      → Claude (Opus/Sonnet) first, then OpenAI, then DeepSeek-R1 local
 *   general        → balanced: Sonnet, GPT-4o, local Llama/Mistral
 *   coding         → DeepSeek-R1 local first (cost-free, bulk), then Claude Sonnet
 *   classification → Qwen3 local first, then Haiku, then GPT-4o-mini
 *   vision         → Claude (vision-capable) → GPT-4o
 *   embedding      → local nomic-embed first, then OpenAI embeddings
 */
const TIER_PREFERENCE: Record<Tier, ProviderId[]> = {
  reasoning: ['anthropic', 'openai', 'ollama', 'openrouter'],
  general: ['anthropic', 'openai', 'ollama', 'openrouter', 'lmstudio'],
  coding: ['ollama', 'anthropic', 'openrouter', 'openai'],
  classification: ['ollama', 'openai', 'anthropic', 'lmstudio'],
  vision: ['anthropic', 'openai'],
  embedding: ['ollama', 'openai'],
}

/**
 * If local-first is enabled, push the local providers (ollama, lmstudio) to the
 * front of every chain.
 */
function applyLocalFirst(chain: ProviderId[]): ProviderId[] {
  if (!config.routing.localFirst) return chain
  const locals = chain.filter(p => p === 'ollama' || p === 'lmstudio')
  const remote = chain.filter(p => p !== 'ollama' && p !== 'lmstudio')
  return [...locals, ...remote]
}

export interface RankedCandidate {
  model: ModelRecord
  rank: number
}

export function pickCandidates(req: CompletionRequest, models: ModelRecord[]): ModelRecord[] {
  const tier: Tier = req.tier ?? 'general'

  // Explicit model override.
  if (req.model) {
    const exact = models.filter(m => m.model_id === req.model && (!req.provider || m.provider === req.provider))
    if (exact.length) return exact
  }

  let chain = TIER_PREFERENCE[tier] ?? TIER_PREFERENCE.general
  chain = applyLocalFirst(chain)

  if (req.localOnly) chain = chain.filter(p => p === 'ollama' || p === 'lmstudio')
  if (req.provider) chain = chain.filter(p => p === req.provider)

  const result: ModelRecord[] = []
  const seen = new Set<string>()
  for (const provider of chain) {
    const tierMatches = models
      .filter(m => m.provider === provider && m.tier === tier && m.is_available)
      .sort((a, b) => b.priority - a.priority)
    for (const m of tierMatches) {
      if (seen.has(m.id)) continue
      seen.add(m.id)
      result.push(m)
    }
  }
  // Fallback: same provider, *any* tier, if tier was very narrow.
  if (result.length === 0) {
    for (const provider of chain) {
      const any = models
        .filter(m => m.provider === provider && m.is_available)
        .sort((a, b) => b.priority - a.priority)
      for (const m of any) {
        if (seen.has(m.id)) continue
        seen.add(m.id)
        result.push(m)
      }
    }
  }
  return result
}
