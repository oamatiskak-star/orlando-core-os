import OpenAI from 'openai'
import { config } from '../config.js'
import type { CompletionRequest, ProviderResult } from '../types.js'
import { ProviderAdapter, ProviderCallContext, ProviderError, withTimeout } from './base.js'

/**
 * OpenRouter exposes an OpenAI-compatible /chat/completions endpoint.
 * We reuse the OpenAI SDK with a different baseURL.
 */
export class OpenRouterProvider implements ProviderAdapter {
  id = 'openrouter' as const
  private client: OpenAI | null

  constructor() {
    this.client = config.providers.openrouter.apiKey
      ? new OpenAI({
          apiKey: config.providers.openrouter.apiKey,
          baseURL: 'https://openrouter.ai/api/v1',
          defaultHeaders: {
            'HTTP-Referer': 'https://orlando-core-os',
            'X-Title': 'Orlando Core AI OS',
          },
        })
      : null
  }

  isConfigured(): boolean {
    return Boolean(this.client) && config.providers.openrouter.enabled
  }

  async isReachable(): Promise<boolean> {
    return this.isConfigured()
  }

  async complete(req: CompletionRequest, ctx: ProviderCallContext): Promise<ProviderResult> {
    if (!this.client) throw new ProviderError('openrouter', 'auth', 'no api key', false)

    const messages = req.messages.map(m => ({ role: m.role as 'system' | 'user' | 'assistant', content: m.content }))
    if (req.system && !messages.some(m => m.role === 'system')) {
      messages.unshift({ role: 'system', content: req.system })
    }

    try {
      const res = await withTimeout(
        this.client.chat.completions.create({
          model: ctx.modelId,
          messages,
          max_tokens: req.maxTokens ?? config.routing.defaultMaxTokens,
          temperature: req.temperature,
          response_format: req.jsonMode ? { type: 'json_object' } : undefined,
        }),
        ctx.timeoutMs,
        'openrouter',
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
      if (err.status === 429) throw new ProviderError('openrouter', 'rate_limit', err.message ?? 'rate limit', true)
      if (err.status === 401 || err.status === 403) throw new ProviderError('openrouter', 'auth', err.message ?? 'auth', false)
      if (err.status && err.status >= 500) throw new ProviderError('openrouter', 'server', err.message ?? 'server', true)
      throw new ProviderError('openrouter', 'transport', err.message ?? 'unknown', true)
    }
  }
}
