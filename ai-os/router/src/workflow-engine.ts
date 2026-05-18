import { db } from './db.js'
import { router } from './router.js'
import type { Tier } from './types.js'

/**
 * Workflow graph schema:
 * {
 *   "nodes": [
 *     { "id":"n1", "type":"ai", "config":{ "tier":"general", "prompt":"...", "outputKey":"summary" }},
 *     { "id":"n2", "type":"http", "config":{ "method":"POST", "url":"...", "body":{...}, "outputKey":"resp" }},
 *     { "id":"n3", "type":"task", "config":{ "kind":"moneybird_sync", "payload":{...} }},
 *     { "id":"n4", "type":"transform", "config":{ "set":{ "k":"value" }}},
 *     { "id":"n5", "type":"branch", "config":{ "if":"summary.advies == 'KOPEN'", "true":"n6", "false":"n7" }}
 *   ],
 *   "edges":[ { "from":"n1", "to":"n2" }, ... ]
 * }
 *
 * Context substitution uses {{ key }} replaced from the run context object.
 */

interface NodeConfig {
  id: string
  type: 'ai' | 'http' | 'task' | 'transform' | 'branch' | 'memory_search' | 'memory_write'
  config: Record<string, unknown>
}

interface Graph {
  nodes: NodeConfig[]
  edges: { from: string; to: string }[]
}

function getByPath(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object' && key in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[key]
    }
    return undefined
  }, obj)
}

function substitute(template: string, ctx: Record<string, unknown>): string {
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, k) => {
    const v = getByPath(ctx, k)
    return v === undefined || v === null ? '' : String(v)
  })
}

function deepSubstitute(value: unknown, ctx: Record<string, unknown>): unknown {
  if (typeof value === 'string') return substitute(value, ctx)
  if (Array.isArray(value)) return value.map(v => deepSubstitute(v, ctx))
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value)) out[k] = deepSubstitute(v, ctx)
    return out
  }
  return value
}

/**
 * Tiny safe expression evaluator for the branch node: supports
 *   key.path == 'literal'
 *   key.path != 'literal'
 *   key.path
 *   !key.path
 * No arbitrary JS execution.
 */
function evalCondition(expr: string, ctx: Record<string, unknown>): boolean {
  const m = expr.match(/^\s*(!?)([\w.]+)\s*(==|!=)?\s*(?:'([^']*)'|"([^"]*)"|(\d+))?\s*$/)
  if (!m) return false
  const negate = m[1] === '!'
  const path = m[2]!
  const op = m[3]
  const litStr = m[4] ?? m[5]
  const litNum = m[6] !== undefined ? Number(m[6]) : undefined
  const val = getByPath(ctx, path)
  if (!op) return negate ? !val : Boolean(val)
  const rhs = litNum !== undefined ? litNum : litStr
  const eq = String(val) === String(rhs)
  return op === '==' ? eq : !eq
}

export interface RunWorkflowOptions {
  workflowId?: string
  slug?: string
  input?: Record<string, unknown>
  triggerSource?: string
}

export interface RunWorkflowResult {
  runId: string
  status: 'completed' | 'failed'
  output: Record<string, unknown>
  steps: Array<{ id: string; status: string; durationMs: number; error?: string }>
}

export class WorkflowEngine {
  async run(opts: RunWorkflowOptions): Promise<RunWorkflowResult> {
    const wf = await this.loadWorkflow(opts)
    const graph = wf.graph as Graph

    const { data: runRow, error: runErr } = await db()
      .from('ai_workflow_runs')
      .insert({
        workflow_id: wf.id,
        status: 'running',
        input: opts.input ?? {},
        trigger_source: opts.triggerSource ?? 'manual',
      })
      .select('id')
      .single()
    if (runErr) throw runErr
    const runId = runRow.id as string

    const ctx: Record<string, unknown> = { input: opts.input ?? {} }
    const order = topoSort(graph)
    const stepResults: RunWorkflowResult['steps'] = []
    let failed = false

    let skipUntilId: string | null = null
    for (const nodeId of order) {
      const node = graph.nodes.find(n => n.id === nodeId)
      if (!node) continue
      if (skipUntilId && node.id !== skipUntilId) {
        stepResults.push({ id: node.id, status: 'skipped', durationMs: 0 })
        continue
      }
      skipUntilId = null

      const stepStart = Date.now()
      const { data: step } = await db()
        .from('ai_workflow_steps')
        .insert({
          run_id: runId,
          node_id: node.id,
          status: 'running',
          input: deepSubstitute(node.config, ctx) as Record<string, unknown>,
          started_at: new Date().toISOString(),
        })
        .select('id')
        .single()
      const stepId = step?.id as string | undefined

      try {
        const out = await this.runNode(node, ctx)
        const outputKey = (node.config.outputKey as string | undefined) ?? node.id
        ctx[outputKey] = out

        if (node.type === 'branch') {
          const cond = (node.config.if as string) ?? ''
          const t = (node.config.true as string) ?? ''
          const f = (node.config.false as string) ?? ''
          skipUntilId = evalCondition(cond, ctx) ? t : f
        }

        if (stepId) {
          await db()
            .from('ai_workflow_steps')
            .update({
              status: 'completed',
              output: typeof out === 'object' ? out : { value: out },
              finished_at: new Date().toISOString(),
            })
            .eq('id', stepId)
        }
        stepResults.push({ id: node.id, status: 'completed', durationMs: Date.now() - stepStart })
      } catch (e: unknown) {
        const message = (e as Error).message
        if (stepId) {
          await db()
            .from('ai_workflow_steps')
            .update({ status: 'failed', error: message, finished_at: new Date().toISOString() })
            .eq('id', stepId)
        }
        stepResults.push({ id: node.id, status: 'failed', durationMs: Date.now() - stepStart, error: message })
        failed = true
        break
      }
    }

    const status: 'completed' | 'failed' = failed ? 'failed' : 'completed'
    await db()
      .from('ai_workflow_runs')
      .update({
        status,
        output: ctx,
        finished_at: new Date().toISOString(),
        error: failed ? stepResults.find(s => s.status === 'failed')?.error : null,
      })
      .eq('id', runId)

    return { runId, status, output: ctx, steps: stepResults }
  }

  private async loadWorkflow(opts: RunWorkflowOptions): Promise<{ id: string; graph: Graph }> {
    let q = db().from('ai_workflows').select('id, graph, enabled, slug').limit(1)
    q = opts.workflowId ? q.eq('id', opts.workflowId) : q.eq('slug', opts.slug ?? '')
    const { data, error } = await q.maybeSingle()
    if (error || !data) throw new Error(`workflow not found: ${opts.workflowId ?? opts.slug}`)
    return { id: data.id as string, graph: data.graph as Graph }
  }

  private async runNode(node: NodeConfig, ctx: Record<string, unknown>): Promise<unknown> {
    const cfg = deepSubstitute(node.config, ctx) as Record<string, unknown>

    switch (node.type) {
      case 'ai': {
        const prompt = (cfg.prompt as string) ?? ''
        const tier = (cfg.tier as Tier) ?? 'general'
        const r = await router.complete({
          tier,
          messages: [{ role: 'user', content: prompt }],
          system: cfg.system as string | undefined,
          maxTokens: cfg.maxTokens as number | undefined,
          jsonMode: Boolean(cfg.jsonMode),
          caller: `workflow:${node.id}`,
        })
        if (cfg.jsonMode) {
          try {
            return JSON.parse(r.text)
          } catch {
            return { raw: r.text, _parseError: true }
          }
        }
        return r.text
      }
      case 'http': {
        const res = await fetch(cfg.url as string, {
          method: (cfg.method as string) ?? 'GET',
          headers: (cfg.headers as Record<string, string>) ?? {},
          body: cfg.body ? JSON.stringify(cfg.body) : undefined,
        })
        const text = await res.text()
        try {
          return JSON.parse(text)
        } catch {
          return { _status: res.status, body: text }
        }
      }
      case 'task': {
        const { data, error } = await db()
          .from('ai_tasks')
          .insert({
            kind: cfg.kind as string,
            tier: (cfg.tier as string) ?? 'general',
            priority: (cfg.priority as number) ?? 50,
            payload: (cfg.payload as Record<string, unknown>) ?? {},
          })
          .select('id')
          .single()
        if (error) throw error
        return { taskId: data.id }
      }
      case 'transform': {
        return (cfg.set as Record<string, unknown>) ?? {}
      }
      case 'memory_search': {
        const { memory } = await import('./memory.js')
        return memory.search({
          query: cfg.query as string,
          scope: cfg.scope as 'project' | 'workflow' | 'user' | 'agent' | 'global' | undefined,
          scopeRef: cfg.scopeRef as string | undefined,
          limit: cfg.limit as number | undefined,
        })
      }
      case 'memory_write': {
        const { memory } = await import('./memory.js')
        const id = await memory.write({
          scope: (cfg.scope as 'project' | 'workflow' | 'user' | 'agent' | 'global') ?? 'global',
          scopeRef: cfg.scopeRef as string | undefined,
          content: cfg.content as string,
          tags: cfg.tags as string[] | undefined,
          metadata: cfg.metadata as Record<string, unknown> | undefined,
        })
        return { id }
      }
      case 'branch':
        return { evaluated: true }
      default:
        throw new Error(`unknown node type: ${(node as NodeConfig).type}`)
    }
  }
}

function topoSort(graph: Graph): string[] {
  const order: string[] = []
  const indeg = new Map<string, number>()
  const adj = new Map<string, string[]>()
  for (const n of graph.nodes) {
    indeg.set(n.id, 0)
    adj.set(n.id, [])
  }
  for (const e of graph.edges) {
    adj.get(e.from)!.push(e.to)
    indeg.set(e.to, (indeg.get(e.to) ?? 0) + 1)
  }
  const q: string[] = []
  for (const [id, d] of indeg) if (d === 0) q.push(id)
  while (q.length) {
    const id = q.shift()!
    order.push(id)
    for (const next of adj.get(id) ?? []) {
      indeg.set(next, (indeg.get(next) ?? 0) - 1)
      if ((indeg.get(next) ?? 0) === 0) q.push(next)
    }
  }
  return order
}

export const workflowEngine = new WorkflowEngine()
