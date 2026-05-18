export type ProviderId =
  | 'anthropic'
  | 'openai'
  | 'openrouter'
  | 'ollama'
  | 'lmstudio'
  | 'custom'

export type Tier =
  | 'reasoning'
  | 'general'
  | 'coding'
  | 'classification'
  | 'vision'
  | 'embedding'

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
}

export interface CompletionRequest {
  /** Routing tier — what kind of work this is. */
  tier?: Tier
  /** Optional explicit model_id (overrides routing). */
  model?: string
  /** Optional explicit provider (constrains routing). */
  provider?: ProviderId
  messages: ChatMessage[]
  system?: string
  maxTokens?: number
  temperature?: number
  jsonMode?: boolean
  /** Where the request comes from (workflow slug / module name). */
  caller?: string
  /** Identifier to dedup identical requests. */
  cacheKey?: string
  /** Disable cloud providers — local-first only. */
  localOnly?: boolean
  /** Time budget per attempt in ms. */
  timeoutMs?: number
  /** Maximum providers to try before failing. */
  maxAttempts?: number
}

export interface CompletionResponse {
  text: string
  model: string
  provider: ProviderId
  inputTokens: number
  outputTokens: number
  latencyMs: number
  cacheHit: boolean
  cost: number
  fallbacksTried: string[]
  finishReason?: string
}

export interface EmbeddingRequest {
  input: string | string[]
  model?: string
  provider?: ProviderId
}

export interface EmbeddingResponse {
  vectors: number[][]
  model: string
  provider: ProviderId
  inputTokens: number
}

export interface ModelRecord {
  id: string
  provider: ProviderId
  model_id: string
  display_name: string
  tier: Tier
  context_window: number
  cost_in_per_mtok: number
  cost_out_per_mtok: number
  is_local: boolean
  is_available: boolean
  endpoint_url: string | null
  node_id: string | null
  priority: number
  capabilities: string[]
  health_status: 'healthy' | 'degraded' | 'down' | 'unknown'
  metadata: Record<string, unknown>
}

export interface ProviderResult {
  text: string
  inputTokens: number
  outputTokens: number
  finishReason?: string
}

export interface RouterContext {
  caller: string
  taskId?: string
  workflowRunId?: string
}
