import { db } from '../db.js'
import { router } from '../router.js'
import type { CompletionResponse, Tier } from '../types.js'

// ── Fixed project universe (LAAG 1) ─────────────────────────────────────────
export const PROJECTS = [
  'Aquier',
  'SterkCalc',
  'Vastgoed Core OS',
  'STRKBOUW',
  'STRKBEHEER',
  'YouTube Engine',
  'Affiliate Engine',
  'Trading Engine',
  'Administratie',
  'Marketing',
] as const
export type ProjectName = (typeof PROJECTS)[number]

// ── Row + result shapes ──────────────────────────────────────────────────────
export interface RoutingRequestRow {
  id: string
  company_id: string
  raw_message: string
  source: string
  requested_by: string
  is_incident: boolean
  status: string
}

export interface SkillCandidate {
  skill_id: string
  name: string
  score: number
  target_host: string
  reversible: boolean
  boards: string[]
  agents: string[]
}

export interface AgentCandidate {
  name: string
  source: 'skill' | 'subagent' | 'claude-agent'
  matched_skill?: string
  status?: string
}

export interface BoardCandidate {
  key: string
  label: string
}

export interface ModelTraceEntry {
  layer: string
  tier: Tier | 'none'
  provider: string
  model: string
  inputTokens: number
  outputTokens: number
  cost: number
}

export interface RoutingContext {
  request: RoutingRequestRow
  trace: ModelTraceEntry[]
}

// ── Supabase client scoped to the hermes schema (db() defaults to public!) ───
export function hermesDb() {
  return db().schema('hermes')
}

export function newContext(request: RoutingRequestRow): RoutingContext {
  return { request, trace: [] }
}

export function pushTrace(ctx: RoutingContext, layer: string, tier: Tier | 'none', resp: CompletionResponse): void {
  ctx.trace.push({
    layer,
    tier,
    provider: resp.provider,
    model: resp.model,
    inputTokens: resp.inputTokens,
    outputTokens: resp.outputTokens,
    cost: resp.cost,
  })
}

/**
 * Local-first classification completion. Forces localOnly so layers 1-5 never
 * touch a cloud provider (token-optimalisatie). Returns the parsed JSON of type T
 * or null if the model could not be reached / produced no parseable JSON.
 */
export async function localJson<T>(opts: {
  layer: string
  ctx: RoutingContext
  system: string
  prompt: string
  maxTokens?: number
}): Promise<T | null> {
  try {
    const resp = await router.complete({
      tier: 'classification',
      localOnly: true,
      jsonMode: true,
      caller: `hermes-orch:${opts.layer}`,
      system: opts.system,
      maxTokens: opts.maxTokens ?? 512,
      temperature: 0,
      messages: [{ role: 'user', content: opts.prompt }],
    })
    pushTrace(opts.ctx, opts.layer, 'classification', resp)
    return extractJson<T>(resp.text)
  } catch {
    return null
  }
}

/** Tolerant JSON extraction — local models often wrap JSON in prose / fences. */
export function extractJson<T>(text: string): T | null {
  if (!text) return null
  const cleaned = text.replace(/```json/gi, '```').trim()
  const fenced = cleaned.match(/```\s*([\s\S]*?)```/)
  const body = fenced && fenced[1] !== undefined ? fenced[1] : cleaned
  // Try whole body, then the first {...} or [...] span.
  const candidates: string[] = [body]
  const obj = body.match(/[{[][\s\S]*[}\]]/)
  if (obj && obj[0]) candidates.push(obj[0])
  for (const c of candidates) {
    try {
      return JSON.parse(c.trim()) as T
    } catch {
      /* try next */
    }
  }
  return null
}

/** Lowercase token set for cheap keyword overlap scoring. */
export function tokenize(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .replace(/[^a-z0-9áéíóúàèäëïöü\s]/gi, ' ')
      .split(/\s+/)
      .filter(w => w.length >= 3),
  )
}
