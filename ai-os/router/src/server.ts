import Fastify from 'fastify'
import cors from '@fastify/cors'
import sensible from '@fastify/sensible'
import { z } from 'zod'
import { config } from './config.js'
import { router } from './router.js'
import { memory } from './memory.js'
import { workflowEngine } from './workflow-engine.js'
import {
  enqueueTask,
  claimTask,
  completeTask,
  failTask,
  reapStuckTasks,
  heartbeatNode,
} from './queue.js'
import { invalidateRegistry, loadModels, upsertModel } from './registry.js'
import { db, logRouter } from './db.js'

const fastify = Fastify({
  logger: { level: config.logLevel },
  bodyLimit: 8 * 1024 * 1024,
})

await fastify.register(cors, { origin: true })
await fastify.register(sensible)

fastify.addHook('onRequest', async (req, reply) => {
  if (req.url === '/health' || req.url === '/') return
  const key = req.headers['x-api-key']
  if (key !== config.apiKey) {
    reply.code(401).send({ error: 'unauthorized' })
  }
})

// ── Health ───────────────────────────────────────────────────────────────
fastify.get('/health', async () => {
  const providers = await router.healthCheck()
  return { ok: true, service: 'ai-router', nodeId: config.nodeId, providers }
})

fastify.get('/', async () => ({
  service: 'orlando-ai-router',
  version: '1.0.0',
  node: config.nodeId,
  endpoints: [
    'POST /v1/complete',
    'POST /v1/embed',
    'GET  /v1/models',
    'POST /v1/models/refresh',
    'POST /v1/cache/clear',
    'POST /v1/tasks',
    'POST /v1/tasks/claim',
    'POST /v1/tasks/:id/complete',
    'POST /v1/tasks/:id/fail',
    'POST /v1/tasks/reap',
    'POST /v1/workflows/run',
    'POST /v1/memory',
    'POST /v1/memory/search',
    'GET  /v1/usage/summary',
    'POST /v1/nodes/heartbeat',
  ],
}))

// ── Completion / embeddings ───────────────────────────────────────────────
const CompletionSchema = z.object({
  tier: z.enum(['reasoning', 'general', 'coding', 'classification', 'vision', 'embedding']).optional(),
  model: z.string().optional(),
  provider: z.enum(['anthropic', 'openai', 'openrouter', 'ollama', 'lmstudio', 'custom']).optional(),
  messages: z
    .array(
      z.object({
        role: z.enum(['system', 'user', 'assistant', 'tool']),
        content: z.string(),
      }),
    )
    .min(1),
  system: z.string().optional(),
  maxTokens: z.number().int().positive().optional(),
  temperature: z.number().min(0).max(2).optional(),
  jsonMode: z.boolean().optional(),
  caller: z.string().optional(),
  cacheKey: z.string().optional(),
  localOnly: z.boolean().optional(),
  timeoutMs: z.number().int().positive().optional(),
  maxAttempts: z.number().int().positive().max(8).optional(),
})

fastify.post('/v1/complete', async (req, reply) => {
  const parsed = CompletionSchema.safeParse(req.body)
  if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
  try {
    const r = await router.complete(parsed.data)
    return r
  } catch (e: unknown) {
    fastify.log.error({ err: e }, 'complete_failed')
    await logRouter('error', 'complete_failed', { message: (e as Error).message })
    return reply.code(502).send({ error: (e as Error).message })
  }
})

fastify.post('/v1/embed', async (req, reply) => {
  const schema = z.object({
    input: z.union([z.string(), z.array(z.string()).min(1)]),
    model: z.string().optional(),
    provider: z.enum(['anthropic', 'openai', 'openrouter', 'ollama', 'lmstudio', 'custom']).optional(),
  })
  const parsed = schema.safeParse(req.body)
  if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
  try {
    return await router.embed(parsed.data)
  } catch (e: unknown) {
    return reply.code(502).send({ error: (e as Error).message })
  }
})

// ── Models ────────────────────────────────────────────────────────────────
fastify.get('/v1/models', async () => {
  const models = await loadModels(true)
  return { models }
})

fastify.post('/v1/models/refresh', async () => {
  invalidateRegistry()
  const discovered = await router.discoverLocalModels()
  // Register all discovered Ollama models that aren't already known.
  for (const [node, modelNames] of Object.entries(discovered.ollama)) {
    for (const name of modelNames) {
      const tier = guessTier(name)
      await upsertModel({
        provider: 'ollama',
        modelId: name,
        displayName: `${name} (ollama)`,
        tier,
        isLocal: true,
        endpointUrl: node,
        nodeId: node,
        priority: 60,
        capabilities: ['local', tier],
      })
    }
  }
  const models = await loadModels(true)
  return { discovered, models }
})

fastify.post('/v1/cache/clear', async () => {
  await db().from('ai_cache').delete().neq('cache_key', '')
  return { cleared: true }
})

// ── Tasks ─────────────────────────────────────────────────────────────────
fastify.post('/v1/tasks', async (req, reply) => {
  const schema = z.object({
    kind: z.string().min(1),
    tier: z.string().optional(),
    priority: z.number().int().min(0).max(100).optional(),
    payload: z.record(z.unknown()).optional(),
    workflowRunId: z.string().uuid().optional(),
    parentTaskId: z.string().uuid().optional(),
    maxRetries: z.number().int().min(0).max(10).optional(),
    visibleAtIso: z.string().datetime().optional(),
  })
  const parsed = schema.safeParse(req.body)
  if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
  const id = await enqueueTask({
    ...parsed.data,
    visibleAt: parsed.data.visibleAtIso ? new Date(parsed.data.visibleAtIso) : undefined,
  })
  return { id }
})

fastify.post('/v1/tasks/claim', async (req, reply) => {
  const schema = z.object({
    nodeId: z.string().min(1),
    kinds: z.array(z.string()).optional(),
    leaseSeconds: z.number().int().min(15).max(3600).optional(),
  })
  const parsed = schema.safeParse(req.body)
  if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
  const task = await claimTask(parsed.data.nodeId, parsed.data.kinds, parsed.data.leaseSeconds ?? 120)
  return { task }
})

fastify.post('/v1/tasks/:id/complete', async (req, reply) => {
  const { id } = req.params as { id: string }
  const body = (req.body as { result?: Record<string, unknown> }) ?? {}
  await completeTask(id, body.result ?? {})
  return { ok: true }
})

fastify.post('/v1/tasks/:id/fail', async (req, reply) => {
  const { id } = req.params as { id: string }
  const body = (req.body as { error?: string; retry?: boolean }) ?? {}
  await failTask(id, body.error ?? 'unknown', body.retry ?? true)
  return { ok: true }
})

fastify.post('/v1/tasks/reap', async () => {
  const reaped = await reapStuckTasks()
  return { reaped }
})

// ── Workflows ─────────────────────────────────────────────────────────────
fastify.post('/v1/workflows/run', async (req, reply) => {
  const schema = z.object({
    workflowId: z.string().uuid().optional(),
    slug: z.string().optional(),
    input: z.record(z.unknown()).optional(),
    triggerSource: z.string().optional(),
  })
  const parsed = schema.safeParse(req.body)
  if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
  if (!parsed.data.workflowId && !parsed.data.slug) {
    return reply.code(400).send({ error: 'workflowId or slug required' })
  }
  try {
    const result = await workflowEngine.run(parsed.data)
    return result
  } catch (e: unknown) {
    return reply.code(500).send({ error: (e as Error).message })
  }
})

// ── Memory ────────────────────────────────────────────────────────────────
fastify.post('/v1/memory', async (req, reply) => {
  const schema = z.object({
    scope: z.enum(['project', 'workflow', 'user', 'agent', 'global']),
    scopeRef: z.string().optional(),
    kind: z.string().optional(),
    content: z.string().min(1),
    tags: z.array(z.string()).optional(),
    importance: z.number().int().min(1).max(10).optional(),
    metadata: z.record(z.unknown()).optional(),
  })
  const parsed = schema.safeParse(req.body)
  if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
  const id = await memory.write(parsed.data)
  return { id }
})

fastify.post('/v1/memory/search', async (req, reply) => {
  const schema = z.object({
    query: z.string().min(1),
    scope: z.enum(['project', 'workflow', 'user', 'agent', 'global']).optional(),
    scopeRef: z.string().optional(),
    limit: z.number().int().min(1).max(50).optional(),
    minSimilarity: z.number().min(0).max(1).optional(),
  })
  const parsed = schema.safeParse(req.body)
  if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
  const hits = await memory.search(parsed.data)
  return { hits }
})

// ── Usage ─────────────────────────────────────────────────────────────────
fastify.get('/v1/usage/summary', async req => {
  const hours = Number((req.query as { hours?: string })?.hours ?? 24)
  const since = new Date(Date.now() - hours * 3600 * 1000).toISOString()
  const { data } = await db()
    .from('ai_usage')
    .select('provider, model_name, input_tokens, output_tokens, cost_usd, cache_hit, status')
    .gte('ts', since)
  const summary = new Map<string, {
    provider: string
    model: string
    inputTokens: number
    outputTokens: number
    cost: number
    cacheHits: number
    errors: number
    calls: number
  }>()
  for (const row of data ?? []) {
    const key = `${row.provider}|${row.model_name}`
    const cur = summary.get(key) ?? {
      provider: row.provider,
      model: row.model_name,
      inputTokens: 0,
      outputTokens: 0,
      cost: 0,
      cacheHits: 0,
      errors: 0,
      calls: 0,
    }
    cur.inputTokens += row.input_tokens
    cur.outputTokens += row.output_tokens
    cur.cost += Number(row.cost_usd)
    if (row.cache_hit) cur.cacheHits += 1
    if (row.status !== 'ok') cur.errors += 1
    cur.calls += 1
    summary.set(key, cur)
  }
  return { since, models: Array.from(summary.values()) }
})

// ── Nodes ────────────────────────────────────────────────────────────────
fastify.post('/v1/nodes/heartbeat', async (req, reply) => {
  const schema = z.object({
    nodeId: z.string().min(1),
    hostname: z.string().min(1),
    role: z.enum(['brain', 'worker', 'gpu', 'cloud']),
    capabilities: z.array(z.string()).optional(),
  })
  const parsed = schema.safeParse(req.body)
  if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })
  await heartbeatNode(parsed.data.nodeId, parsed.data.hostname, parsed.data.role, parsed.data.capabilities ?? [])
  return { ok: true }
})

// ── Background loops ─────────────────────────────────────────────────────
function guessTier(name: string): 'reasoning' | 'coding' | 'classification' | 'embedding' | 'general' {
  const n = name.toLowerCase()
  if (n.includes('embed') || n.includes('nomic')) return 'embedding'
  if (n.includes('coder') || n.includes('code') || n.includes('deepseek')) return 'coding'
  if (n.includes('qwen') && (n.includes('1.5b') || n.includes('3b') || n.includes('7b'))) return 'classification'
  if (n.includes('r1') || n.includes('reason')) return 'reasoning'
  return 'general'
}

async function startupTasks(): Promise<void> {
  try {
    await heartbeatNode(config.nodeId, config.nodeId, 'brain', ['router', 'ollama', 'orchestrator'])
    await router.discoverLocalModels().catch(() => null)
  } catch (e) {
    fastify.log.warn({ err: e }, 'startup_tasks_failed')
  }
}

setInterval(() => {
  reapStuckTasks().catch(() => {})
}, 30_000)

setInterval(() => {
  heartbeatNode(config.nodeId, config.nodeId, 'brain', ['router']).catch(() => {})
}, 15_000)

await startupTasks()

fastify.listen({ port: config.port, host: config.host }).then(() => {
  fastify.log.info(`AI Router listening on ${config.host}:${config.port}`)
}).catch(err => {
  fastify.log.error({ err }, 'listen failed')
  process.exit(1)
})
