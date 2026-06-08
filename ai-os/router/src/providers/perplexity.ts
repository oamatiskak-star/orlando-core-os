import OpenAI from 'openai'
import { config } from '../config.js'
import type { CompletionRequest, ProviderResult } from '../types.js'
import { ProviderAdapter, ProviderCallContext, ProviderError, withTimeout } from './base.js'

/**
 * Perplexity exposes een OpenAI-compatibele /chat/completions met de Sonar-modellen
 * (sonar, sonar-pro, sonar-reasoning). We hergebruiken de OpenAI SDK met een andere
 * baseURL — net als OpenRouter. Bedoeld als VANGNET: het neemt kleine taken over
 * wanneer Claude/de hoofdketen tegen rate-limits aanloopt.
 */
export class PerplexityProvider implements ProviderAdapter {
  id = 'perplexity' as const
  private client: OpenAI | null

  constructor() {
    this.client = config.providers.perplexity.apiKey
      ? new OpenAI({
          apiKey: config.providers.perplexity.apiKey,
          baseURL: config.providers.perplexity.baseUrl,
        })
      : null
  }

  isConfigured(): boolean {
    return Boolean(this.client) && config.providers.perplexity.enabled
  }

  async isReachable(): Promise<boolean> {
    return this.isConfigured()
  }

  async complete(req: CompletionRequest, ctx: ProviderCallContext): Promise<ProviderResult> {
    if (!this.client) throw new ProviderError('perplexity', 'auth', 'no api key', false)

    const messages = req.messages.map(m => ({ role: m.role as 'system' | 'user' | 'assistant', content: m.content }))
    if (req.system && !messages.some(m => m.role === 'system')) {
      messages.unshift({ role: 'system', content: req.system })
    }

    try {
      const res = await withTimeout(
        this.client.chat.completions.create({
          model: ctx.modelId || config.providers.perplexity.fallbackModel,
          messages,
          max_tokens: req.maxTokens ?? config.routing.defaultMaxTokens,
          temperature: req.temperature,
        }),
        ctx.timeoutMs,
        'perplexity',
      )
      const choice = res.choices[0]
      return {
        text: choice?.message?.content ?? '',
        inputTokens: res.usage?.prompt_tokens ?? 0,
        outputTokens: res.usage?.completion_tokens ?? 0,
        finishReason: choice?.finish_reason ?? undefined,
      }
    } catch (e: unknown) {
      if (e instanceof ProviderError) throw e
      const err = e as { status?: number; message?: string }
      if (err.status === 429) throw new ProviderError('perplexity', 'rate_limit', err.message ?? 'rate limit', true)
      if (err.status === 401 || err.status === 403) throw new ProviderError('perplexity', 'auth', err.message ?? 'auth', false)
      if (err.status && err.status >= 500) throw new ProviderError('perplexity', 'server', err.message ?? 'server', true)
      throw new ProviderError('perplexity', 'transport', err.message ?? 'unknown', true)
    }
  }
}
