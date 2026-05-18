import { config } from './config.js'
import { cacheGet, cachePut, deriveCacheKey } from './cache.js'
import { loadModels, markHealth } from './registry.js'
import { pickCandidates } from './routing-rules.js'
import { computeCost, recordUsage } from './usage.js'
import { logRouter } from './db.js'
import type {
  CompletionRequest,
  CompletionResponse,
  EmbeddingRequest,
  EmbeddingResponse,
  ProviderId,
} from './types.js'
import { AnthropicProvider } from './providers/anthropic.js'
import { OpenAIProvider } from './providers/openai.js'
import { OpenRouterProvider } from './providers/openrouter.js'
import { OllamaProvider } from './providers/ollama.js'
import { LMStudioProvider } from './providers/lmstudio.js'
import { ProviderError, type ProviderAdapter } from './providers/base.js'

export class AIRouter {
  private providers: Record<ProviderId, ProviderAdapter>

  constructor() {
    this.providers = {
      anthropic: new AnthropicProvider(),
      openai: new OpenAIProvider(),
      openrouter: new OpenRouterProvider(),
      ollama: new OllamaProvider(),
      lmstudio: new LMStudioProvider(),
      custom: new OpenAIProvider(), // placeholder for custom OpenAI-compatible endpoints
    }
  }

  /** Single inference call with multi-provider failover. */
  async complete(req: CompletionRequest): Promise<CompletionResponse> {
    const start = Date.now()
    const cacheKey = req.cacheKey ?? deriveCacheKey(req)

    if (config.cache.enabled) {
      const hit = await cacheGet(cacheKey)
      if (hit) {
        await recordUsage({
          provider: hit.provider,
          modelName: hit.model,
          tier: req.tier,
          caller: req.caller,
          inputTokens: 0,
          outputTokens: 0,
          latencyMs: Date.now() - start,
          costUsd: 0,
          cacheHit: true,
          status: 'ok',
        })
        return { ...hit, cacheHit: true, latencyMs: Date.now() - start }
      }
    }

    const models = await loadModels()
    const candidates = pickCandidates(req, models)
    if (candidates.length === 0) {
      throw new Error('No available model for tier=' + (req.tier ?? 'general'))
    }

    const maxAttempts = req.maxAttempts ?? config.routing.defaultMaxAttempts
    const timeoutMs = req.timeoutMs ?? config.routing.defaultTimeoutMs
    const tried: string[] = []
    let lastError: unknown = null

    for (const candidate of candidates.slice(0, maxAttempts)) {
      const provider = this.providers[candidate.provider]
      if (!provider || !provider.isConfigured()) {
        tried.push(`${candidate.provider}:${candidate.model_id}:not_configured`)
        continue
      }

      const attemptStart = Date.now()
      try {
        const r = await provider.complete(req, {
          modelId: candidate.model_id,
          timeoutMs,
        })
        const latency = Date.now() - attemptStart
        const cost = computeCost(candidate, r.inputTokens, r.outputTokens)
        const resp: CompletionResponse = {
          text: r.text,
          model: candidate.model_id,
          provider: candidate.provider,
          inputTokens: r.inputTokens,
          outputTokens: r.outputTokens,
          latencyMs: latency,
          cacheHit: false,
          cost,
          fallbacksTried: tried,
          finishReason: r.finishReason,
        }
        await markHealth(candidate.id, 'healthy')
        await cachePut(cacheKey, req.tier, candidate.model_id, resp)
        await recordUsage({
          modelId: candidate.id,
          provider: candidate.provider,
          modelName: candidate.model_id,
          tier: req.tier,
          caller: req.caller,
          inputTokens: r.inputTokens,
          outputTokens: r.outputTokens,
          latencyMs: latency,
          costUsd: cost,
          cacheHit: false,
          status: 'ok',
        })
        return resp
      } catch (e: unknown) {
        lastError = e
        const reason = e instanceof ProviderError ? e.reason : 'transport'
        tried.push(`${candidate.provider}:${candidate.model_id}:${reason}`)
        await markHealth(
          candidate.id,
          reason === 'rate_limit' || reason === 'timeout' ? 'degraded' : 'down',
        )
        await recordUsage({
          modelId: candidate.id,
          provider: candidate.provider,
          modelName: candidate.model_id,
          tier: req.tier,
          caller: req.caller,
          inputTokens: 0,
          outputTokens: 0,
          latencyMs: Date.now() - attemptStart,
          costUsd: 0,
          cacheHit: false,
          status: reason === 'rate_limit' ? 'rate_limited' : reason === 'timeout' ? 'timeout' : 'error',
          error: (e as Error).message,
        })
        await logRouter('warn', 'provider_attempt_failed', {
          provider: candidate.provider,
          model: candidate.model_id,
          reason,
          message: (e as Error).message,
        })
        // hard failures stop the chain on auth — no point retrying same key
        if (e instanceof ProviderError && !e.retryable && e.reason === 'auth') continue
      }
    }

    throw new Error(
      `All providers exhausted. Tried: ${tried.join(', ')}. Last: ${(lastError as Error | undefined)?.message ?? 'unknown'}`,
    )
  }

  /** Compute embeddings via local-first (or explicit provider). */
  async embed(req: EmbeddingRequest): Promise<EmbeddingResponse> {
    const inputs = Array.isArray(req.input) ? req.input : [req.input]
    const provider = req.provider ?? config.embeddings.defaultProvider
    const modelId = req.model ?? config.embeddings.defaultModel
    const adapter = this.providers[provider]
    if (!adapter || !adapter.embed) throw new Error(`Provider ${provider} does not support embeddings`)
    const vectors = await adapter.embed(inputs, modelId)
    return {
      vectors,
      model: modelId,
      provider,
      inputTokens: inputs.reduce((s, t) => s + Math.ceil(t.length / 4), 0),
    }
  }

  /** Health summary across all providers. */
  async healthCheck(): Promise<Record<ProviderId, { configured: boolean; reachable: boolean }>> {
    const out = {} as Record<ProviderId, { configured: boolean; reachable: boolean }>
    for (const [id, p] of Object.entries(this.providers) as [ProviderId, ProviderAdapter][]) {
      const configured = p.isConfigured()
      const reachable = configured ? await p.isReachable().catch(() => false) : false
      out[id] = { configured, reachable }
    }
    return out
  }

  /** Discover models actually loaded on every Ollama node and register them. */
  async discoverLocalModels(): Promise<{ ollama: Record<string, string[]> }> {
    const ollama = this.providers.ollama as OllamaProvider
    const result: Record<string, string[]> = {}
    for (const node of config.providers.ollama.nodes) {
      result[node] = await ollama.listModelsOnNode(node)
    }
    return { ollama: result }
  }
}

export const router = new AIRouter()
