import Anthropic from '@anthropic-ai/sdk'
import { config } from '../config.js'
import type { CompletionRequest, ProviderResult } from '../types.js'
import { ProviderAdapter, ProviderCallContext, ProviderError, withTimeout } from './base.js'

export class AnthropicProvider implements ProviderAdapter {
  id = 'anthropic' as const
  private client: Anthropic | null

  constructor() {
    this.client = config.providers.anthropic.apiKey
      ? new Anthropic({ apiKey: config.providers.anthropic.apiKey })
      : null
  }

  isConfigured(): boolean {
    return Boolean(this.client) && config.providers.anthropic.enabled
  }

  async isReachable(): Promise<boolean> {
    return this.isConfigured()
  }

  async complete(req: CompletionRequest, ctx: ProviderCallContext): Promise<ProviderResult> {
    if (!this.client) throw new ProviderError('anthropic', 'auth', 'no api key', false)

    const system = req.system ?? req.messages.find(m => m.role === 'system')?.content
    const messages = req.messages
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }))

    try {
      const res = await withTimeout(
        this.client.messages.create({
          model: ctx.modelId,
          max_tokens: req.maxTokens ?? config.routing.defaultMaxTokens,
          temperature: req.temperature,
          system: system ?? undefined,
          messages,
        }),
        ctx.timeoutMs,
        'anthropic',
      )
      const text = res.content
        .map(block => (block.type === 'text' ? block.text : ''))
        .join('')
      return {
        text,
        inputTokens: res.usage.input_tokens,
        outputTokens: res.usage.output_tokens,
        finishReason: res.stop_reason ?? undefined,
      }
    } catch (e: unknown) {
      if (e instanceof ProviderError) throw e
      const err = e as { status?: number; message?: string }
      if (err.status === 429) throw new ProviderError('anthropic', 'rate_limit', err.message ?? 'rate limit', true)
      if (err.status === 401 || err.status === 403) throw new ProviderError('anthropic', 'auth', err.message ?? 'auth', false)
      if (err.status && err.status >= 500) throw new ProviderError('anthropic', 'server', err.message ?? 'server', true)
      throw new ProviderError('anthropic', 'transport', err.message ?? 'unknown', true)
    }
  }
}
