import OpenAI from 'openai'
import { config } from '../config.js'
import type { CompletionRequest, ProviderResult } from '../types.js'
import { ProviderAdapter, ProviderCallContext, ProviderError, withTimeout } from './base.js'

/**
 * LM Studio exposes an OpenAI-compatible server (default http://localhost:1234/v1).
 * No API key required for local installs; we pass a dummy key.
 */
export class LMStudioProvider implements ProviderAdapter {
  id = 'lmstudio' as const
  private client: OpenAI | null

  constructor() {
    this.client = config.providers.lmstudio.enabled
      ? new OpenAI({ baseURL: config.providers.lmstudio.baseUrl, apiKey: 'lm-studio' })
      : null
  }

  isConfigured(): boolean {
    return Boolean(this.client)
  }

  async isReachable(): Promise<boolean> {
    if (!this.isConfigured()) return false
    try {
      const r = await fetch(`${config.providers.lmstudio.baseUrl}/models`, {
        signal: AbortSignal.timeout(2000),
      })
      return r.ok
    } catch {
      return false
    }
  }

  async complete(req: CompletionRequest, ctx: ProviderCallContext): Promise<ProviderResult> {
    if (!this.client) throw new ProviderError('lmstudio', 'transport', 'disabled', false)

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
        }),
        ctx.timeoutMs,
        'lmstudio',
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
      if (err.status && err.status >= 500) throw new ProviderError('lmstudio', 'server', err.message ?? 'server', true)
      throw new ProviderError('lmstudio', 'transport', err.message ?? 'unknown', true)
    }
  }
}
