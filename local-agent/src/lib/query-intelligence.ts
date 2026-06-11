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
