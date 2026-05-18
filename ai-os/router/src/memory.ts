import { db } from './db.js'
import { config } from './config.js'
import { router } from './router.js'

export interface MemoryEntry {
  scope: 'project' | 'workflow' | 'user' | 'agent' | 'global'
  scopeRef?: string
  kind?: string
  content: string
  tags?: string[]
  importance?: number
  metadata?: Record<string, unknown>
}

export interface MemoryHit {
  id: string
  scope: string
  scope_ref: string | null
  kind: string
  content: string
  tags: string[]
  similarity: number
  metadata: Record<string, unknown>
}

export class MemoryStore {
  async write(entry: MemoryEntry): Promise<string> {
    const emb = await router.embed({ input: entry.content })
    const vec = emb.vectors[0]
    if (!vec) throw new Error('embedding failed')
    if (vec.length !== config.embeddings.dimensions) {
      throw new Error(
        `Embedding dimension mismatch: got ${vec.length}, expected ${config.embeddings.dimensions}. ` +
          `Update AI_EMBED_DIM env or migration vector(N) to match the embed model.`,
      )
    }
    const { data, error } = await db()
      .from('ai_memory')
      .insert({
        scope: entry.scope,
        scope_ref: entry.scopeRef ?? null,
        kind: entry.kind ?? 'note',
        content: entry.content,
        embedding: vec,
        tags: entry.tags ?? [],
        importance: entry.importance ?? 5,
        metadata: entry.metadata ?? {},
      })
      .select('id')
      .single()
    if (error) throw error
    return data.id as string
  }

  async search(opts: {
    query: string
    scope?: MemoryEntry['scope']
    scopeRef?: string
    limit?: number
    minSimilarity?: number
  }): Promise<MemoryHit[]> {
    const emb = await router.embed({ input: opts.query })
    const vec = emb.vectors[0]
    if (!vec) return []
    const { data, error } = await db().rpc('ai_memory_search', {
      p_query: vec as unknown as string,
      p_scope: opts.scope ?? null,
      p_scope_ref: opts.scopeRef ?? null,
      p_limit: opts.limit ?? 8,
      p_min_similarity: opts.minSimilarity ?? 0.65,
    })
    if (error) throw error
    return (data ?? []) as MemoryHit[]
  }

  async forget(id: string): Promise<void> {
    await db().from('ai_memory').delete().eq('id', id)
  }
}

export const memory = new MemoryStore()
