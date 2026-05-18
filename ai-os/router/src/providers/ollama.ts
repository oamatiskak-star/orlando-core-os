import { config } from '../config.js'
import type { CompletionRequest, ProviderResult } from '../types.js'
import { ProviderAdapter, ProviderCallContext, ProviderError, withTimeout } from './base.js'

interface OllamaChatRes {
  message?: { content?: string }
  prompt_eval_count?: number
  eval_count?: number
  done_reason?: string
}

interface OllamaTagsRes {
  models?: Array<{ name: string }>
}

interface OllamaEmbedRes {
  embeddings?: number[][]
  embedding?: number[]
}

/**
 * Ollama provider. Supports multiple nodes (load-balances round-robin) so a
 * single router can fan out across multiple Mac Minis.
 */
export class OllamaProvider implements ProviderAdapter {
  id = 'ollama' as const
  private nodeIdx = 0

  isConfigured(): boolean {
    return config.providers.ollama.enabled && config.providers.ollama.nodes.length > 0
  }

  private nextNode(): string {
    const nodes = config.providers.ollama.nodes
    const node = nodes[this.nodeIdx % nodes.length]!
    this.nodeIdx = (this.nodeIdx + 1) % nodes.length
    return node
  }

  async isReachable(): Promise<boolean> {
    if (!this.isConfigured()) return false
    for (const node of config.providers.ollama.nodes) {
      try {
        const r = await fetch(`${node}/api/tags`, { signal: AbortSignal.timeout(2000) })
        if (r.ok) return true
      } catch {
        // try next
      }
    }
    return false
  }

  async listModelsOnNode(node: string): Promise<string[]> {
    try {
      const r = await fetch(`${node}/api/tags`, { signal: AbortSignal.timeout(3000) })
      if (!r.ok) return []
      const j = (await r.json()) as OllamaTagsRes
      return (j.models ?? []).map(m => m.name)
    } catch {
      return []
    }
  }

  async complete(req: CompletionRequest, ctx: ProviderCallContext): Promise<ProviderResult> {
    const node = this.nextNode()
    const messages = req.messages.map(m => ({ role: m.role, content: m.content }))
    if (req.system && !messages.some(m => m.role === 'system')) {
      messages.unshift({ role: 'system', content: req.system })
    }

    const body: Record<string, unknown> = {
      model: ctx.modelId,
      messages,
      stream: false,
      options: {
        temperature: req.temperature ?? 0.2,
        num_predict: req.maxTokens ?? config.routing.defaultMaxTokens,
      },
    }
    if (req.jsonMode) body.format = 'json'

    try {
      const res = await withTimeout(
        fetch(`${node}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }),
        ctx.timeoutMs,
        'ollama',
      )
      if (!res.ok) {
        const txt = await res.text().catch(() => '')
        if (res.status >= 500) throw new ProviderError('ollama', 'server', `${res.status} ${txt}`, true)
        throw new ProviderError('ollama', 'invalid', `${res.status} ${txt}`, false)
      }
      const j = (await res.json()) as OllamaChatRes
      return {
        text: j.message?.content ?? '',
        inputTokens: j.prompt_eval_count ?? 0,
        outputTokens: j.eval_count ?? 0,
        finishReason: j.done_reason,
      }
    } catch (e: unknown) {
      if (e instanceof ProviderError) throw e
      throw new ProviderError('ollama', 'transport', (e as Error).message, true)
    }
  }

  async embed(input: string[], modelId: string): Promise<number[][]> {
    const node = this.nextNode()
    const res = await fetch(`${node}/api/embed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: modelId, input }),
    })
    if (!res.ok) throw new ProviderError('ollama', 'server', `embed ${res.status}`, true)
    const j = (await res.json()) as OllamaEmbedRes
    if (j.embeddings) return j.embeddings
    if (j.embedding) return [j.embedding]
    return []
  }
}
