import 'dotenv/config'
import fs from 'fs'
import path from 'path'
import os from 'os'
import axios from 'axios'
import { createClient } from '@supabase/supabase-js'
import { localLlmJson } from './local-llm'

/**
 * VISUAL INTELLIGENCE LAYER (Content Factory 2.0 — FASE A).
 *
 * Vindt volledig automatisch beelden per scene: Pexels → Pixabay → eigen library.
 * Geen handmatige links. Geen fake assets, geen placeholders, geen stock-simulatie.
 *
 * Scoring: de OBJECTIEVE selectie-score wordt hier deterministisch uit echte
 * asset-metadata berekend (resolutie→cinematic, reuse_count→uniqueness, verse
 * download→freshness, clipduur↔scèneduur→fit). De PERCEPTUELE dimensies
 * (relevance / emotional_fit / scene_match) zijn vision/LLM-werk en worden door
 * de Visual QC-Agent (FASE C) ingevuld — hier NIET verzonnen (blijven null).
 * Selectie-drempel final_visual_score >= 85.
 *
 * Herbruikt de bewezen Pexels-logica uit content-worker/src/lib/pexels.ts
 * (geport omdat local-agent een apart TS-package is).
 */

const db = createClient(
  (process.env.SUPABASE_URL ?? 'http://preflight.invalid'),
  (process.env.SUPABASE_SERVICE_ROLE_KEY ?? 'preflight'),
  { auth: { persistSession: false } },
)

export const VISUAL_GATE_NO_PROVIDER = 'blocked_missing_visual_provider'
export const VISUAL_MIN_SCORE = 85

type Orientation = 'landscape' | 'portrait' | 'square'

interface Candidate {
  provider: 'pexels' | 'pixabay'
  url: string
  width: number | null
  height: number | null
  duration: number
}

// ── Pexels (geport uit content-worker) ───────────────────────────────────────
async function searchPexels(query: string, orientation: Orientation): Promise<Candidate[]> {
  const apiKey = process.env.PEXELS_API_KEY
  if (!apiKey) return []
  const page = Math.floor(Math.random() * 5) + 1
  const res = await axios.get('https://api.pexels.com/videos/search', {
    headers: { Authorization: apiKey },
    params: { query, per_page: 15, orientation, page },
    timeout: 15_000,
  })
  const vids: any[] = res.data?.videos ?? []
  return vids.map((v): Candidate | null => {
    const files = (v.video_files ?? [])
      .filter((f: any) => f.link && f.file_type === 'video/mp4')
      .sort((a: any, b: any) => (b.width ?? 0) - (a.width ?? 0))
    const best = files[0]
    return best ? { provider: 'pexels' as const, url: best.link, width: best.width ?? null, height: best.height ?? null, duration: v.duration ?? 0 } : null
  }).filter((c): c is Candidate => c !== null)
}

// ── Pixabay (nieuw, tweede gratis bron) ──────────────────────────────────────
async function searchPixabay(query: string, orientation: Orientation): Promise<Candidate[]> {
  const apiKey = process.env.PIXABAY_API_KEY
  if (!apiKey) return []
  const res = await axios.get('https://pixabay.com/api/videos/', {
    params: { key: apiKey, q: query, per_page: 15, safesearch: true },
    timeout: 15_000,
  })
  const hits: any[] = res.data?.hits ?? []
  return hits.map((h): Candidate | null => {
    const f = h.videos?.large ?? h.videos?.medium
    if (!f?.url) return null
    const portrait = orientation === 'portrait'
    // Pixabay levert geen orientatie-filter; respecteer grof via aspect.
    const w = f.width ?? null, ht = f.height ?? null
    if (portrait && w && ht && w > ht) return null
    return { provider: 'pixabay' as const, url: f.url, width: w, height: ht, duration: h.duration ?? 0 }
  }).filter((c): c is Candidate => c !== null)
}

// ── deterministische selectie-score (alleen echte metadata) ──────────────────
function qualityToCinematic(width: number | null): number {
  if (width && width >= 1920) return 95
  if (width && width >= 1280) return 88
  if (width && width >= 854) return 70
  return 45
}
function durationFit(clip: number, sceneDur: number): number {
  if (clip <= 0 || sceneDur <= 0) return 50
  if (clip >= sceneDur) return 95
  return Math.round((clip / sceneDur) * 95)   // te korte clip = lagere fit
}

interface ScoreSet {
  cinematic_score: number
  uniqueness_score: number
  freshness_score: number
  topic_relevance: number | null   // perceptueel → Visual QC-agent (FASE C)
  final_visual_score: number
}
function scoreCandidate(c: Candidate, sceneDur: number, reuseCount: number): ScoreSet {
  const cinematic = qualityToCinematic(c.width)
  const uniqueness = Math.max(10, 100 - reuseCount * 25)
  const freshness = reuseCount === 0 ? 95 : 70
  const fit = durationFit(c.duration, sceneDur)
  // weging: kwaliteit 40%, fit 25%, uniqueness 20%, freshness 15%
  const final = Math.round(cinematic * 0.4 + fit * 0.25 + uniqueness * 0.2 + freshness * 0.15)
  return { cinematic_score: cinematic, uniqueness_score: uniqueness, freshness_score: freshness, topic_relevance: null, final_visual_score: final }
}

async function downloadTo(url: string, dest: string): Promise<void> {
  fs.mkdirSync(path.dirname(dest), { recursive: true })
  const res = await axios.get<NodeJS.ReadableStream>(url, { responseType: 'stream', timeout: 120_000 })
  await new Promise<void>((resolve, reject) => {
    const w = fs.createWriteStream(dest)
    ;(res.data as NodeJS.ReadableStream).pipe(w)
    w.on('finish', () => w.close((e) => (e ? reject(e) : resolve())))
    w.on('error', (e) => { try { fs.unlinkSync(dest) } catch { /* */ } ; reject(e) })
  })
}

async function reuseCountFor(url: string): Promise<number> {
  const { count } = await db.from('visual_assets').select('id', { count: 'exact', head: true }).eq('original_source_url', url)
  return count ?? 0
}

export interface VisualResult {
  blockedReason: string | null
  sceneCount: number
  assetsSelected: number
  belowThreshold: number
}

/**
 * Bron-visuals voor alle scenes van een project. Geen visual-provider (Pexels
 * NOCH Pixabay) → meteen geblokkeerd, GEEN rijen, GEEN fakes. Per scene: zoek
 * (Pexels → Pixabay) → score → beste >=85 → download → visual_assets-rij →
 * koppel scene.selected_asset_id. Eén van beide keys volstaat.
 */
/** Vertaalt zoektermen één keer naar Engels (stock-bibliotheken zijn Engels). Fallback = origineel. */
async function translateQueriesToEnglish(projectId: string, queries: string[]): Promise<string[]> {
  try {
    const { data: proj } = await db.from('video_projects').select('language').eq('id', projectId).maybeSingle()
    const lang = (proj?.language || 'en').toLowerCase()
    if (lang.startsWith('en')) return queries
    const nonEmpty = queries.map((q, i) => ({ q, i })).filter((x) => x.q)
    if (nonEmpty.length === 0) return queries
    const prompt = `Translate each stock-video search term to concise ENGLISH (2-5 words, only the visual subject, no quotes). Keep the SAME order and count. Return ONLY JSON: {"queries":["...","..."]}.
TERMS (${nonEmpty.length}):
${nonEmpty.map((x, k) => `${k + 1}. ${x.q}`).join('\n')}`
    const r = await localLlmJson(prompt)
    const out = Array.isArray(r?.queries) ? (r.queries as unknown[]).map((s) => String(s ?? '').trim()) : null
    if (!out || out.length !== nonEmpty.length) return queries
    const result = [...queries]
    nonEmpty.forEach((x, k) => { if (out[k]) result[x.i] = out[k] })
    return result
  } catch { return queries }
}

export async function sourceVisualsForProject(projectId: string, format: '16:9' | '9:16' | '1:1'): Promise<VisualResult> {
  if (!process.env.PEXELS_API_KEY && !process.env.PIXABAY_API_KEY) {
    return { blockedReason: VISUAL_GATE_NO_PROVIDER, sceneCount: 0, assetsSelected: 0, belowThreshold: 0 }
  }
  const orientation: Orientation = format === '9:16' ? 'portrait' : format === '1:1' ? 'square' : 'landscape'

  const { data: scenes } = await db.from('video_scenes')
    .select('id, search_query, visual_intent, expected_duration')
    .eq('project_id', projectId).order('idx')
  const list = scenes ?? []

  // Stock-bibliotheken (Pexels/Pixabay) zijn Engels-geïndexeerd. Het lokale model levert
  // ondanks de prompt vaak niet-Engelse zoektermen → 0 hits. Vertaal de termen één keer
  // naar Engels (deterministische extra stap); faalt de vertaling → val terug op origineel.
  const rawQueries = list.map((sc) => (sc.search_query || sc.visual_intent || '').trim())
  const enQueries = await translateQueriesToEnglish(projectId, rawQueries)

  let selected = 0, below = 0
  for (let i = 0; i < list.length; i++) {
    const sc = list[i]
    const query = enQueries[i] || rawQueries[i]
    if (!query) { below++; continue }

    let candidates = await searchPexels(query, orientation)
    if (candidates.length === 0) candidates = await searchPixabay(query, orientation)
    if (candidates.length === 0) { below++; continue }

    // score alle kandidaten, kies hoogste
    const scored = await Promise.all(candidates.map(async (c) => ({ c, s: scoreCandidate(c, Number(sc.expected_duration) || 5, await reuseCountFor(c.url)) })))
    scored.sort((a, b) => b.s.final_visual_score - a.s.final_visual_score)
    const winner = scored[0]

    if (!winner || winner.s.final_visual_score < VISUAL_MIN_SCORE) { below++; continue }

    // download → storage-pad lokaal (render-laag mux't dit; geen upload)
    const localPath = path.join(os.tmpdir(), `cf2-asset-${projectId}-${sc.id}.mp4`)
    try { await downloadTo(winner.c.url, localPath) } catch { below++; continue }

    const { data: asset } = await db.from('visual_assets').insert({
      scene_id: sc.id, project_id: projectId,
      source_provider: winner.c.provider,
      original_source_url: winner.c.url,
      local_asset_url: localPath,
      license: winner.c.provider === 'pexels' ? 'Pexels License' : 'Pixabay License',
      license_status: 'free_commercial',
      duration: winner.c.duration,
      resolution: winner.c.width && winner.c.height ? `${winner.c.width}x${winner.c.height}` : null,
      topic_relevance: winner.s.topic_relevance,
      cinematic_score: winner.s.cinematic_score,
      freshness_score: winner.s.freshness_score,
      uniqueness_score: winner.s.uniqueness_score,
      final_visual_score: winner.s.final_visual_score,
      approved_for_reuse: false,
    }).select('id').single()

    if (asset?.id) {
      await db.from('video_scenes').update({ selected_asset_id: asset.id }).eq('id', sc.id)
      selected++
    } else { below++ }
  }

  return { blockedReason: null, sceneCount: list.length, assetsSelected: selected, belowThreshold: below }
}
