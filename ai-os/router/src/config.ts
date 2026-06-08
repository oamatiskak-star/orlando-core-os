import 'node:process'

function env(name: string, fallback?: string): string {
  const v = process.env[name]
  if (v === undefined || v === '') {
    if (fallback !== undefined) return fallback
    throw new Error(`Missing required env: ${name}`)
  }
  return v
}

function envOpt(name: string): string | undefined {
  const v = process.env[name]
  return v && v.length > 0 ? v : undefined
}

function envBool(name: string, fallback = false): boolean {
  const v = process.env[name]
  if (v === undefined) return fallback
  return v === '1' || v.toLowerCase() === 'true' || v.toLowerCase() === 'yes'
}

function envInt(name: string, fallback: number): number {
  const v = process.env[name]
  if (!v) return fallback
  const n = parseInt(v, 10)
  return Number.isFinite(n) ? n : fallback
}

export const config = {
  port: envInt('AI_ROUTER_PORT', 8787),
  host: env('AI_ROUTER_HOST', '0.0.0.0'),
  apiKey: env('AI_ROUTER_API_KEY', 'change-me-router-key'),
  nodeId: env('AI_NODE_ID', 'router-brain'),
  region: env('AI_REGION', 'local'),
  logLevel: env('LOG_LEVEL', 'info'),

  supabase: {
    url: env('SUPABASE_URL'),
    serviceKey: env('SUPABASE_SERVICE_ROLE_KEY'),
  },

  providers: {
    anthropic: {
      apiKey: envOpt('ANTHROPIC_API_KEY'),
      enabled: envBool('AI_PROVIDER_ANTHROPIC', true),
    },
    openai: {
      apiKey: envOpt('OPENAI_API_KEY'),
      baseUrl: env('OPENAI_BASE_URL', 'https://api.openai.com/v1'),
      enabled: envBool('AI_PROVIDER_OPENAI', true),
    },
    openrouter: {
      apiKey: envOpt('OPENROUTER_API_KEY'),
      enabled: envBool('AI_PROVIDER_OPENROUTER', true),
    },
    ollama: {
      baseUrl: env('OLLAMA_BASE_URL', 'http://localhost:11434'),
      nodes: (envOpt('OLLAMA_NODES') ?? 'http://localhost:11434')
        .split(',')
        .map(s => s.trim())
        .filter(Boolean),
      enabled: envBool('AI_PROVIDER_OLLAMA', true),
    },
    lmstudio: {
      baseUrl: env('LMSTUDIO_BASE_URL', 'http://localhost:1234/v1'),
      enabled: envBool('AI_PROVIDER_LMSTUDIO', false),
    },
    perplexity: {
      apiKey: envOpt('PERPLEXITY_API_KEY'),
      baseUrl: env('PERPLEXITY_BASE_URL', 'https://api.perplexity.ai'),
      // Vangnet: laatste redmiddel als de hele keten op capaciteit/limiet vastloopt.
      enabled: envBool('AI_PROVIDER_PERPLEXITY', true),
      fallbackModel: env('PERPLEXITY_FALLBACK_MODEL', 'sonar'),
    },
  },

  cache: {
    enabled: envBool('AI_CACHE_ENABLED', true),
    ttlSeconds: envInt('AI_CACHE_TTL_S', 60 * 60 * 24),
  },

  routing: {
    localFirst: envBool('AI_LOCAL_FIRST', true),
    defaultMaxTokens: envInt('AI_DEFAULT_MAX_TOKENS', 1024),
    defaultTimeoutMs: envInt('AI_DEFAULT_TIMEOUT_MS', 60_000),
    defaultMaxAttempts: envInt('AI_DEFAULT_MAX_ATTEMPTS', 4),
    // Perplexity-vangnet aan als de hele keten faalt (vooral bij rate-limits).
    perplexityFallback: envBool('AI_PERPLEXITY_FALLBACK', true),
  },

  embeddings: {
    defaultProvider: env('AI_EMBED_PROVIDER', 'ollama') as 'ollama' | 'openai',
    defaultModel: env('AI_EMBED_MODEL', 'nomic-embed-text'),
    dimensions: envInt('AI_EMBED_DIM', 1024),
  },
} as const

export type AppConfig = typeof config
