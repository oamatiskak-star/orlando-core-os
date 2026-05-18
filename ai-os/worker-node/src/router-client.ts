import { config } from './config.js'

export interface CompletionInput {
  tier?: string
  model?: string
  provider?: string
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[]
  system?: string
  maxTokens?: number
  temperature?: number
  jsonMode?: boolean
  localOnly?: boolean
  caller?: string
}

export interface CompletionResult {
  text: string
  model: string
  provider: string
  inputTokens: number
  outputTokens: number
  latencyMs: number
  cost: number
}

async function call<T>(path: string, body: unknown, method: 'POST' | 'GET' = 'POST'): Promise<T> {
  const res = await fetch(`${config.routerUrl}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.routerKey,
    },
    body: method === 'POST' ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const txt = await res.text().catch(() => '')
    throw new Error(`router ${res.status}: ${txt}`)
  }
  return (await res.json()) as T
}

export async function complete(input: CompletionInput): Promise<CompletionResult> {
  return call<CompletionResult>('/v1/complete', input)
}

export async function embed(input: string | string[]): Promise<number[][]> {
  const r = await call<{ vectors: number[][] }>('/v1/embed', { input })
  return r.vectors
}
