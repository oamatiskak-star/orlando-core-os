import type { CompletionRequest, ProviderId, ProviderResult } from '../types.js'

export interface ProviderCallContext {
  modelId: string
  timeoutMs: number
}

export interface ProviderAdapter {
  id: ProviderId
  isConfigured(): boolean
  isReachable(): Promise<boolean>
  complete(req: CompletionRequest, ctx: ProviderCallContext): Promise<ProviderResult>
  embed?(input: string[], modelId: string): Promise<number[][]>
}

export class ProviderError extends Error {
  constructor(
    public provider: ProviderId,
    public reason: 'rate_limit' | 'timeout' | 'auth' | 'transport' | 'invalid' | 'server',
    message: string,
    public retryable: boolean,
  ) {
    super(`[${provider}] ${reason}: ${message}`)
  }
}

export function withTimeout<T>(p: Promise<T>, ms: number, provider: ProviderId): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new ProviderError(provider, 'timeout', `exceeded ${ms}ms`, true)), ms)
    p.then(
      v => {
        clearTimeout(t)
        resolve(v)
      },
      e => {
        clearTimeout(t)
        reject(e)
      },
    )
  })
}
