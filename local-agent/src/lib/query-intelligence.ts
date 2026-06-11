import { createClient } from '@supabase/supabase-js'
import { localLlmJson } from './local-llm'

/**
 * CF2.1 QUERY INTELLIGENCE ENGINE.
 *
 * Zoekt NIET op de ruwe titel maar op de VISUELE INTENTIE + NICHE. Genereert meerdere
 * Engelse stock-zoekvarianten (concrete visuele onderwerpen), scoort en rankt ze
 * deterministisch (concreetheid, niche-anchor, lengte, geleerde patronen). Leert van
 * `cf2_query_learning_patterns` (FASE 8 — Hermes visual-learning): termen die per niche
 * structureel hoog/laag scoorden sturen de generatie + ranking.
 *
 * Geen publicatie, geen re-source — dit levert alleen betere zoektermen.
 */

export interface QueryVariant { query: string; intent: string; score: number }
export interface QueryIntelResult { variants: QueryVariant[]; best: string; keywords: string[] }

function db() {
  return createClient(process.env.SUPABASE_URL ?? 'http://preflight.invalid', process.env.SUPABASE_SERVICE_ROLE_KEY ?? 'preflight', { auth: { persistSession: false } })
}

// Abstracte/onbruikbare zoekwoorden voor stock (matchen zelden visueel).
const ABSTRACT = /\b(shock|document|concept|thing|stuff|variant|phenomenon|background|story|effect|intro|topic|approach|aspect|fenomeen|achtergrond|verhaal|aanpak)\b/i

// Niche → concrete visuele anker-termen (sturen generatie + scoren niche-fit).
const NICHE_ANCHORS: Record<string, string[]> = {
  finance: ['stock market', 'trading screen', 'investor', 'financial charts', 'money', 'bank', 'economy', 'stock exchange', 'candlestick chart'],
  vastgoed: ['real estate', 'house keys', 'property', 'apartment building', 'construction site', 'mortgage', 'home interior', 'city skyline'],
  satisfying: ['satisfying machine', 'mechanical loop', 'automation', 'precision machine', 'kinetic sculpture', 'lego automation'],
  cutting: ['knife cutting', 'slicing', 'asmr cutting', 'clean cut', 'sharp blade'],
}
function nicheKey(niche: string | null): keyof typeof NICHE_ANCHORS | null {
  const n = (niche ?? '').toLowerCase()
  if (n.includes('finance')) return 'finance'
  if (n.includes('vastgoed') || n.includes('real') || n.includes('estate')) return 'vastgoed'
  if (n.includes('cutting')) return 'cutting'
  if (n.includes('satisf') || n.includes('brick') || n.includes('loop') || n.includes('mini-world')) return 'satisfying'
  return null
}

async function getLearned(niche: string | null, hook: string | null): Promise<{ good: string[]; bad: string[]; lesson: string | null }> {
  try {
    const { data } = await db().from('cf2_query_learning_patterns').select('good_query_terms, bad_query_terms, lesson, hook_category').eq('niche', niche ?? '')
    const rows = (data ?? []) as any[]
    const pick = rows.find((r) => r.hook_category === hook) ?? rows[0]
    if (!pick) return { good: [], bad: [], lesson: null }
    return { good: pick.good_query_terms ?? [], bad: pick.bad_query_terms ?? [], lesson: pick.lesson ?? null }
  } catch { return { good: [], bad: [], lesson: null } }
}

function scoreVariant(q: string, anchors: string[], learned: { good: string[]; bad: string[] }): number {
  const t = q.toLowerCase().trim()
  if (!t || t.length < 4) return 0
  let s = 58
  if (!ABSTRACT.test(t)) s += 16                                   // concreet i.p.v. abstract
  const words = t.split(/\s+/).length
  if (words >= 2 && words <= 5) s += 10                             // bruikbare lengte
  if (anchors.some((a) => t.includes(a) || a.split(' ').some((w) => w.length > 4 && t.includes(w)))) s += 12  // niche-fit
  if (learned.good.some((g) => g && t.includes(g.toLowerCase()))) s += 8
  if (learned.bad.some((b) => b && t.includes(b.toLowerCase()))) s -= 14
  return Math.max(0, Math.min(98, s))
}

export interface QueryInput {
  title?: string | null
  sceneIntent?: string | null    // visual_intent van de scene
  scriptText?: string | null     // voice_text van de scene
  hookCategory?: string | null
  niche?: string | null
}

export async function generateQueries(input: QueryInput): Promise<QueryIntelResult> {
  const nk = nicheKey(input.niche ?? null)
  const anchors = nk ? NICHE_ANCHORS[nk] : []
  const learned = await getLearned(input.niche ?? null, input.hookCategory ?? null)

  const prompt = `Je bepaalt STOCK-FOOTAGE zoektermen voor één video-scene. Zoek NIET op de titel maar op het VISUELE ONDERWERP dat bij de scene + niche past.
REGELS: 6 termen, ENGELS, 2-5 woorden, CONCREET visueel onderwerp (geen abstracte woorden als shock/document/concept/variant/intro). Pas bij de niche.
NICHE: ${input.niche ?? '?'} ${anchors.length ? `(voorbeeld-ankers: ${anchors.slice(0, 5).join(', ')})` : ''}
HOOK: ${input.hookCategory ?? '?'}
SCENE-INTENTIE: ${input.sceneIntent ?? '?'}
SCRIPT: ${(input.scriptText ?? '').slice(0, 160)}
${learned.lesson ? `GELEERDE LES: ${learned.lesson}` : ''}
Geef ALLEEN JSON: {"queries":[{"query":"...","intent":"wat we visueel willen zien"}]}`

  let variants: QueryVariant[] = []
  try {
    const r = await localLlmJson(prompt)
    if (Array.isArray(r?.queries)) {
      variants = r.queries
        .filter((v: any) => v?.query)
        .map((v: any) => ({ query: String(v.query).trim().slice(0, 80), intent: String(v.intent ?? '').slice(0, 120), score: scoreVariant(String(v.query), anchors, learned) }))
    }
  } catch { /* val terug op anker-afgeleide termen */ }

  // deterministische fallback/aanvulling: niche-ankers (altijd ≥1 bruikbare term)
  if (variants.length === 0 && anchors.length) {
    variants = anchors.slice(0, 4).map((a) => ({ query: a, intent: `niche-anchor: ${a}`, score: scoreVariant(a, anchors, learned) }))
  }
  // ontdubbel + rank
  const seen = new Set<string>()
  variants = variants.filter((v) => { const k = v.query.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true })
    .sort((a, b) => b.score - a.score)

  const best = variants[0]?.query ?? (input.sceneIntent ?? input.title ?? '').slice(0, 60)
  const keywords = Array.from(new Set(variants.flatMap((v) => v.query.toLowerCase().split(/\s+/)).filter((w) => w.length > 3))).slice(0, 12)
  return { variants, best, keywords }
}

/* ───────────────────────────────────────────────────────────────────────────
 * CF2.7 — SCENE INTENT PRESERVATION LAYER
 *
 * De scene-intentie blijft ALTIJD dominant. Query Intelligence mag verrijken
 * (additieve modifiers), maar NOOIT het hoofdonderwerp vervangen. Volledige
 * override mag uitsluitend bij een betekenisloze/extreem generieke raw-query.
 * ─────────────────────────────────────────────────────────────────────────── */

// Regel 5 — alleen deze raw-queries mogen volledig overruled worden
const GENERIC_JUNK = /^(document|paper|object|random thing|thing|stuff|intro|concept|background|footage|video|clip|image|scene|topic|content|item)s?$/i
const QSTOP = new Set(['the', 'and', 'with', 'for', 'een', 'met', 'van', 'het', 'a', 'an', 'of', 'in', 'on', 'to', 'at', 'close', 'shot'])

function contentWords(s: string): string[] {
  return (s || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((w) => w.length > 3 && !QSTOP.has(w))
}

/** Is de raw-query extreem generiek/betekenisloos? (Regel 5) */
export function isJunkQuery(raw: string): boolean {
  const t = (raw || '').trim().toLowerCase()
  if (!t) return true
  if (GENERIC_JUNK.test(t)) return true
  const words = contentWords(t)
  if (words.length === 0) return true                  // alleen stopwoorden
  if (words.length <= 1 && ABSTRACT.test(t)) return true
  return false
}

/** Regel 4 — fractie van de raw-subject-tokens die in de kandidaat behouden is. */
function subjectSimilarity(candidate: string, raw: string): number {
  const r = contentWords(raw); if (r.length === 0) return 1
  const c = new Set(contentWords(candidate))
  let hit = 0; for (const w of r) if (c.has(w)) hit++
  return hit / r.length
}

/** Regel 2 — vraag ALLEEN additieve modifiers (stijl/detail/context), nooit een nieuw onderwerp. */
async function llmModifiers(raw: string, sceneIntent: string | null): Promise<string[]> {
  const prompt = `Een GOEDE stock-footage zoekterm voor één video-scene: "${raw}".
Scene-intentie: ${sceneIntent ?? '?'}.
Geef tot 3 AANVULLENDE Engelse modifiers (visuele STIJL/DETAIL/CONTEXT, elk 1-3 woorden) die EXACT hetzelfde hoofdonderwerp behouden. Verander NOOIT het onderwerp; introduceer GEEN nieuw onderwerp of nieuwe machine/locatie.
ALLEEN JSON: {"modifiers":["cinematic","detailed environment","wide shot"]}`
  try {
    const r = await localLlmJson(prompt)
    if (Array.isArray(r?.modifiers)) {
      return r.modifiers.map((m: any) => String(m ?? '').trim().toLowerCase()).filter((m: string) => m && m.length <= 28 && m.split(/\s+/).length <= 3).slice(0, 3)
    }
  } catch { /* geen modifiers → raw behouden */ }
  return []
}

export interface QueryDecision {
  scene_intent: string | null
  raw_query: string
  proposed_query: string
  final_query: string
  mode: 'preserve' | 'enrich' | 'override' | 'reject'
  override_reason: string | null
  rejection_reason: string | null
  similarity_score: number | null
}

// Regel 4 — minimale subject-overlap voordat een query geaccepteerd wordt
export const INTENT_SIM_MIN = 0.6

/**
 * Regel 1-5 — bepaalt de definitieve zoekterm met behoud van scene-intentie.
 * raw blijft de basis; intelligence verrijkt additief; override alleen bij junk.
 */
export async function refineQuery(input: QueryInput & { rawQuery: string }): Promise<QueryDecision> {
  const raw = (input.rawQuery || '').trim()
  const sceneIntent = input.sceneIntent ?? null

  // Regel 5 — volledige override uitsluitend bij betekenisloze/generieke raw-query
  if (isJunkQuery(raw)) {
    const gen = await generateQueries(input)
    const proposed = gen.best || raw
    return { scene_intent: sceneIntent, raw_query: raw, proposed_query: proposed, final_query: proposed || raw, mode: 'override', override_reason: 'raw_query_generic_or_meaningless', rejection_reason: null, similarity_score: null }
  }

  // Regel 1+2 — raw is de basis; intelligence levert ALLEEN additieve modifiers
  const modifiers = await llmModifiers(raw, sceneIntent)
  if (modifiers.length === 0) {
    return { scene_intent: sceneIntent, raw_query: raw, proposed_query: raw, final_query: raw, mode: 'preserve', override_reason: null, rejection_reason: null, similarity_score: 1 }
  }
  const proposed = `${raw} ${modifiers.slice(0, 2).join(' ')}`.trim()
  // Regel 4 — subject-preservatie-check (additief → behoudt per definitie het onderwerp)
  const sim = subjectSimilarity(proposed, raw)
  if (sim >= INTENT_SIM_MIN) {
    return { scene_intent: sceneIntent, raw_query: raw, proposed_query: proposed, final_query: proposed, mode: 'enrich', override_reason: null, rejection_reason: null, similarity_score: sim }
  }
  // veiligheidsnet: verrijking zou onderwerp verschuiven → verwerp, behoud raw (Regel 1+4)
  return { scene_intent: sceneIntent, raw_query: raw, proposed_query: proposed, final_query: raw, mode: 'reject', override_reason: null, rejection_reason: 'intent_similarity_below_threshold', similarity_score: sim }
}
