import { memory } from '../memory.js'
import { hermesDb, type RoutingContext } from './shared.js'
import type { ProjectName } from './shared.js'

export interface ContextBundle {
  memory_hits: Array<{ content: string; similarity: number; kind: string }>
  kv: Array<{ scope: string; key: string; value: unknown }>
  note?: string
}

/**
 * LAAG 2 — build the context_bundle: semantic memory (ai_memory, local nomic
 * embeddings) scoped to the project + hermes.memory key/value for the company.
 * Defensive: any failure (e.g. embedding-dim mismatch, missing table) degrades
 * to an empty bundle with a note rather than breaking the pipeline.
 */
export async function buildContextBundle(ctx: RoutingContext, activeProject: ProjectName): Promise<ContextBundle> {
  const bundle: ContextBundle = { memory_hits: [], kv: [] }

  // 2a. Semantic memory (vector search). Local embedding only.
  try {
    const hits = await memory.search({
      query: ctx.request.raw_message,
      scope: 'project',
      scopeRef: activeProject,
      limit: 6,
      minSimilarity: 0.6,
    })
    bundle.memory_hits = hits.map(h => ({ content: h.content, similarity: h.similarity, kind: h.kind }))
  } catch (e) {
    bundle.note = `semantic memory skipped: ${(e as Error).message}`
  }

  // 2b. Hermes key/value memory for this company + global facts.
  try {
    const { data } = await hermesDb()
      .from('memory')
      .select('scope, key, value')
      .in('scope', [`company:${ctx.request.company_id}`, 'global'])
      .order('importance', { ascending: false })
      .limit(12)
    bundle.kv = (data ?? []) as ContextBundle['kv']
  } catch {
    /* kv optional */
  }

  return bundle
}
