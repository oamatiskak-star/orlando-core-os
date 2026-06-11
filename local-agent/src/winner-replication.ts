import './ws-shim'   // MOET eerst — zet global WebSocket vóór elke @supabase-import (Node20)
import 'dotenv/config'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { localLlmJson } from './lib/local-llm'

/**
 * CF2 WINNER REPLICATION ENGINE.
 *
 * Bereidt nieuwe varianten voor vanuit ECHTE winners (v_winner_intelligence) — geen vrij
 * verzonnen content. Per winner: structuur (hook/titel/scene-ritme) → tot 50 varianten via
 * lokaal model (STRUCTUUR repliceren, onderwerp variëren binnen dezelfde niche) → ranking →
 * top 10 'selected'. Schrijft variation_requests + cf2_winner_variants. GEEN publicatie,
 * GEEN producer-aanroep, GEEN upload. De top-10 gaat pas naar de horizon via de aparte
 * gegatede functie public.cf2_seed_variants_to_horizon() (expliciete GO).
 *
 * Draait NIET vanzelf: vereist WINNER_REPLICATION_RUN=1. Top-N winners via
 * WINNER_REPLICATION_TOP (default 3), variantenaantal via WINNER_REPLICATION_COUNT (default 50).
 */

const TOP_WINNERS = Number(process.env.WINNER_REPLICATION_TOP) || 3
const VARIANT_COUNT = Number(process.env.WINNER_REPLICATION_COUNT) || 50
const SELECT_TOP = 10
const log = (...a: unknown[]) => console.log('[winner-replication]', ...a)

function db(): SupabaseClient {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

type Winner = {
  id: string; title: string; niche: string | null; category: string | null
  hook_score: number | null; views: number | null; length_bucket: string | null; why_winner: string | null
}

/** Scene-ritme-template uit het winner-format (deterministisch; scene-planner vult later in). */
function sceneRhythm(lengthBucket: string | null): { target_seconds: number; scene_count_hint: number; pacing: string } {
  const isShort = (lengthBucket ?? 'short') === 'short'
  return isShort
    ? { target_seconds: 45, scene_count_hint: 8, pacing: 'snel: hook(0-3s) → escalatie → payoff → CTA' }
    : { target_seconds: 240, scene_count_hint: 16, pacing: 'documentaire: hook → context → bewijs → climax → CTA' }
}

/** Replication-score: hoe goed volgt de variant de winner-structuur + niche (deterministisch). */
function replicationScore(variantTitle: string, source: Winner): number {
  if (!variantTitle || variantTitle.length < 8) return 0
  let s = 60
  // lengte-gelijkenis met de winner-titel
  const lenDiff = Math.abs(variantTitle.length - (source.title?.length ?? variantTitle.length))
  s += Math.max(0, 15 - Math.round(lenDiff / 4))
  // structurele pariteit (emoji / cijfer / hashtag aanwezig zoals bij de winner)
  const hasNum = (t: string) => /\d/.test(t)
  const hasHash = (t: string) => /#/.test(t)
  const hasEmoji = (t: string) => /\p{Extended_Pictographic}/u.test(t)
  if (hasNum(variantTitle) === hasNum(source.title ?? '')) s += 6
  if (hasHash(variantTitle) === hasHash(source.title ?? '')) s += 6
  if (hasEmoji(variantTitle) === hasEmoji(source.title ?? '')) s += 5
  // hook-categorie-signaal aanwezig (curiosity/shock/education etc. → vraagteken/cijfer/superlatief)
  if (source.category && /shock|curiosity|mystery/.test(source.category) && /[?!]/.test(variantTitle)) s += 4
  return Math.max(50, Math.min(98, s))
}

async function replicateWinner(client: SupabaseClient, w: Winner): Promise<number> {
  const rhythm = sceneRhythm(w.length_bucket)
  // 1) variation_request (structuur vastgelegd)
  const { data: req } = await client.from('variation_requests').insert({
    source_video_id: w.id, title: w.title, niche: w.niche, category: w.category,
    structure: { hook_category: w.category, length_bucket: w.length_bucket, why_winner: w.why_winner, scene_rhythm: rhythm },
    count: VARIANT_COUNT, status: 'producing', requested_by: 'winner-replication',
  }).select('id').single()
  const reqId = req?.id ?? null

  // 2) varianten genereren — STRUCTUUR repliceren, onderwerp variëren binnen de niche
  const prompt = `Je krijgt een BEWEZEN winnende short/video-titel. Genereer ${VARIANT_COUNT} titelvarianten die DEZELFDE hook-structuur, lengte en ritme repliceren voor DEZELFDE niche.
REGELS: behoud de bewezen structuur en toon; varieer alleen het concrete onderwerp BINNEN de niche; verzin GEEN nieuw genre/format; geen aanhalingstekens. Taal = taal van de winner.
WINNER: "${w.title}"
NICHE: ${w.niche ?? '?'} · HOOK-CATEGORIE: ${w.category ?? '?'} · FORMAT: ${w.length_bucket ?? 'short'}
Geef ALLEEN JSON: {"variants":[{"title":"...","hook_structure":"korte beschrijving van het toegepaste hook-patroon"}]}`

  let variants: { title: string; hook_structure?: string }[] = []
  try {
    const r = await localLlmJson(prompt)
    if (Array.isArray(r?.variants)) variants = r.variants.filter((v: any) => v?.title)
  } catch (e) { log(`  LLM-fout voor "${w.title?.slice(0, 30)}": ${(e as Error).message}`) }

  if (variants.length === 0) { log(`  geen varianten gegenereerd voor "${w.title?.slice(0, 30)}"`); return 0 }

  // 3) scoren + rangschikken
  const scored = variants.map((v) => ({ v, score: replicationScore(v.title, w) }))
    .sort((a, b) => b.score - a.score)

  // 4) schrijven: top-10 'selected', rest 'prepared'
  const rows = scored.map((s, i) => ({
    variation_request_id: reqId, source_video_id: w.id, source_title: w.title,
    niche: w.niche, hook_category: w.category, rank: i + 1,
    variant_title: s.v.title.slice(0, 200),
    hook_structure: (s.v.hook_structure ?? '').slice(0, 300),
    scene_rhythm: rhythm,
    replication_score: s.score,
    status: i < SELECT_TOP ? 'selected' : 'prepared',
  }))
  await client.from('cf2_winner_variants').insert(rows)
  await client.from('variation_requests').update({ status: 'done' }).eq('id', reqId)
  log(`  "${w.title?.slice(0, 36)}" → ${rows.length} varianten, top ${Math.min(SELECT_TOP, rows.length)} selected (beste ${scored[0].score})`)
  return rows.length
}

export async function runWinnerReplication(): Promise<{ winners: number; variants: number }> {
  const client = db()
  const { data: winners } = await client.from('v_winner_intelligence')
    .select('id, title, niche, category, hook_score, views, length_bucket, why_winner')
    .order('hook_score', { ascending: false }).order('views', { ascending: false })
    .limit(TOP_WINNERS)
  const list = (winners ?? []) as Winner[]
  log(`mode=prepare · top ${list.length} winners · ${VARIANT_COUNT} varianten elk · GEEN publicatie`)
  if (list.length === 0) { log('geen winners in v_winner_intelligence — niets te repliceren.'); return { winners: 0, variants: 0 } }

  let total = 0
  for (const w of list) total += await replicateWinner(client, w)
  log(`klaar — ${list.length} winners, ${total} varianten voorbereid. Top-10/winner staat 'selected'.`)
  log(`Volgende (aparte GO): select public.cf2_seed_variants_to_horizon(10);  daarna cf2_seed_jobs_from_horizon().`)
  return { winners: list.length, variants: total }
}

// Alleen draaien bij expliciete opt-in. Geen auto-start, geen publicatie.
if (require.main === module && process.env.WINNER_REPLICATION_RUN === '1') {
  runWinnerReplication()
    .then((r) => { console.log('[winner-replication]', JSON.stringify(r)); process.exit(0) })
    .catch((e) => { console.error('[winner-replication] error', e); process.exit(1) })
}
