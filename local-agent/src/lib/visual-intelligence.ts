import 'dotenv/config'
import fs from 'fs'
import path from 'path'
import os from 'os'
import axios from 'axios'
import { spawnSync } from 'child_process'
import { createClient } from '@supabase/supabase-js'
import { localLlmJson } from './local-llm'

/**
 * VISUAL INTELLIGENCE ENGINE (Content Factory 2.0 — FASE A).
 *
 * Per scene wordt uit MEERDERE bronnen de beste visuele bron gekozen — niet één
 * stockbron. Bronnen (in volgorde van voorkeur, fallback ALLEEN wanneer nodig):
 *   1. Pexels video   2. Pixabay video   3. Pexels foto (→ still-clip)
 *   4. YouTube-archief (eigen thumbnails, niche-gematcht)
 *   5. Eigen archief (visual_assets approved_for_reuse)
 *
 * Elke kandidaat wordt deterministisch gescoord op 7 dimensies (resolutie, beweging,
 * 9:16-bruikbaarheid, commerciële uitstraling, niche-fit, uniqueness, query-relevantie).
 * De PERCEPTUELE relevantie (klopt het beeld écht inhoudelijk?) is vision/LLM-werk en
 * blijft voor de Visual QC-agent (FASE C) — hier NIET verzonnen (topic_relevance=null).
 *
 * Voor ELKE scene wordt vastgelegd (cf2_visual_decisions): de gekozen bron, ALLE
 * afgewezen alternatieven met score + reden, de confidence, en — bij zwakke dekking —
 * low_visual_confidence + concreet verbeteradvies. GEEN generieke fake-fallback: een
 * bron die inhoudelijk te zwak is wordt NIET gebruikt (scene blijft zonder asset, low conf).
 */

const db = createClient(
  (process.env.SUPABASE_URL ?? 'http://preflight.invalid'),
  (process.env.SUPABASE_SERVICE_ROLE_KEY ?? 'preflight'),
  { auth: { persistSession: false } },
)

export const VISUAL_GATE_NO_PROVIDER = 'blocked_missing_visual_provider'
// Selectie-ondergrens: onder SELECT_FLOOR is de beste bron te zwak/irrelevant → NIET gebruiken.
export const VISUAL_SELECT_FLOOR = 55
// Boven CONFIDENCE_GOOD = vertrouwde keuze; eronder (maar ≥ floor) = gebruikt + low_confidence.
export const VISUAL_CONFIDENCE_GOOD = 78

type Orientation = 'landscape' | 'portrait' | 'square'
type Provider = 'pexels' | 'pixabay' | 'youtube' | 'archive'

interface Candidate {
  provider: Provider
  kind: 'video' | 'photo'
  url: string
  width: number | null
  height: number | null
  duration: number
  nicheMatched: boolean   // bron komt uit niche-eigen materiaal (youtube/archief)
  rank: number            // positie in zoekresultaat (0=top); -1 = niet query-gerankt
  license: string
}

function clipDims(format: '16:9' | '9:16' | '1:1'): { w: number; h: number } {
  if (format === '9:16') return { w: 1080, h: 1920 }
  if (format === '1:1') return { w: 1080, h: 1080 }
  return { w: 1920, h: 1080 }
}

// Foto/thumbnail → still videoclip zodat de render-keten 'm als gewone clip behandelt.
function photoToClip(imgPath: string, outPath: string, durationSec: number, format: '16:9' | '9:16' | '1:1'): Promise<void> {
  const { w, h } = clipDims(format)
  return new Promise((resolve, reject) => {
    const r = spawnSync('ffmpeg', ['-y', '-loop', '1', '-i', imgPath, '-t', String(Math.max(1, durationSec)),
      '-vf', `scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h}`,
      '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-r', '30', '-an', outPath], { timeout: 60_000, encoding: 'utf8' })
    if (r.status === 0 && fs.existsSync(outPath)) resolve()
    else reject(new Error(`photo-clip: ${(r.stderr || r.error?.message || 'ffmpeg status ' + r.status).toString().slice(0, 200)}`))
  })
}

// ── Bron 1: Pexels video ─────────────────────────────────────────────────────
async function searchPexels(query: string, orientation: Orientation): Promise<Candidate[]> {
  const apiKey = process.env.PEXELS_API_KEY
  if (!apiKey) return []
  const page = Math.floor(Math.random() * 5) + 1
  const res = await axios.get('https://api.pexels.com/videos/search', {
    headers: { Authorization: apiKey }, params: { query, per_page: 15, orientation, page }, timeout: 15_000,
  })
  const vids: any[] = res.data?.videos ?? []
  return vids.map((v, rank): Candidate | null => {
    const files = (v.video_files ?? []).filter((f: any) => f.link && f.file_type === 'video/mp4').sort((a: any, b: any) => (b.width ?? 0) - (a.width ?? 0))
    const best = files[0]
    return best ? { provider: 'pexels', kind: 'video', url: best.link, width: best.width ?? null, height: best.height ?? null, duration: v.duration ?? 0, nicheMatched: false, rank, license: 'Pexels License' } : null
  }).filter((c): c is Candidate => c !== null)
}

// ── Bron 2: Pixabay video ────────────────────────────────────────────────────
async function searchPixabay(query: string, orientation: Orientation): Promise<Candidate[]> {
  const apiKey = process.env.PIXABAY_API_KEY
  if (!apiKey) return []
  const res = await axios.get('https://pixabay.com/api/videos/', { params: { key: apiKey, q: query, per_page: 15, safesearch: true }, timeout: 15_000 })
  const hits: any[] = res.data?.hits ?? []
  return hits.map((h, rank): Candidate | null => {
    const f = h.videos?.large ?? h.videos?.medium
    if (!f?.url) return null
    const w = f.width ?? null, ht = f.height ?? null
    return { provider: 'pixabay', kind: 'video', url: f.url, width: w, height: ht, duration: h.duration ?? 0, nicheMatched: false, rank, license: 'Pixabay License' }
  }).filter((c): c is Candidate => c !== null)
}

// ── Bron 3: Pexels foto (brede dekking; wordt still-clip) ────────────────────
async function searchPexelsPhotos(query: string, orientation: Orientation): Promise<Candidate[]> {
  const apiKey = process.env.PEXELS_API_KEY
  if (!apiKey) return []
  const res = await axios.get('https://api.pexels.com/v1/search', { headers: { Authorization: apiKey }, params: { query, per_page: 15, orientation }, timeout: 15_000 })
  const photos: any[] = res.data?.photos ?? []
  return photos.map((p, rank): Candidate | null => {
    const url = p.src?.large2x || p.src?.large || p.src?.original
    if (!url) return null
    return { provider: 'pexels', kind: 'photo', url, width: p.width ?? null, height: p.height ?? null, duration: 0, nicheMatched: false, rank, license: 'Pexels License' }
  }).filter((c): c is Candidate => c !== null)
}

// ── Bron 4: YouTube-archief (eigen thumbnails, niche-gematcht) ───────────────
async function searchYouTubeArchive(niche: string | null): Promise<Candidate[]> {
  if (!niche) return []
  // eigen, niche-eigen beeld uit de bestaande DB via v_hook_classified (heeft niche + thumbnail_url).
  const { data } = await db.from('v_hook_classified')
    .select('thumbnail_url')
    .eq('niche', niche)
    .not('thumbnail_url', 'is', null)
    .limit(12)
  const rows: any[] = data ?? []
  return rows.filter((r) => r.thumbnail_url).map((r): Candidate => ({
    provider: 'youtube', kind: 'photo', url: r.thumbnail_url, width: 1280, height: 720, duration: 0,
    nicheMatched: true, rank: -1, license: 'Eigen kanaal',
  }))
}

// ── Bron 5: Eigen archief (eerder goedgekeurde, herbruikbare assets) ─────────
async function searchOwnArchive(niche: string | null): Promise<Candidate[]> {
  let q = db.from('visual_assets').select('original_source_url, resolution, source_provider, license, duration').eq('approved_for_reuse', true).not('original_source_url', 'is', null).limit(12)
  const { data } = await q
  const rows: any[] = data ?? []
  return rows.filter((r) => r.original_source_url).map((r): Candidate => {
    const [w, h] = (r.resolution || '').split('x').map((n: string) => parseInt(n, 10) || null)
    return { provider: 'archive', kind: (r.duration ?? 0) > 0 ? 'video' : 'photo', url: r.original_source_url, width: w ?? null, height: h ?? null, duration: r.duration ?? 0, nicheMatched: !!niche, rank: -1, license: r.license || 'Archief' }
  })
}

// ── 7-dimensionale scoring (deterministisch, alleen echte metadata) ──────────
function dimResolution(width: number | null): number {
  if (width && width >= 1920) return 95
  if (width && width >= 1280) return 88
  if (width && width >= 854) return 70
  return 45
}
function dimMovement(kind: 'video' | 'photo'): number { return kind === 'video' ? 95 : 55 }
function dimPortraitFit(w: number | null, h: number | null, format: '16:9' | '9:16' | '1:1'): number {
  if (!w || !h) return 60
  const ar = w / h
  if (format === '9:16') return ar <= 0.65 ? 95 : ar <= 1.0 ? 72 : 48          // landscape → zware crop
  if (format === '1:1') { const d = Math.abs(ar - 1); return d < 0.1 ? 95 : d < 0.4 ? 72 : 55 }
  return ar >= 1.5 ? 95 : ar >= 1.0 ? 72 : 48                                  // 16:9
}
function dimCommercial(provider: Provider, kind: 'video' | 'photo', resolution: number): number {
  const base = (provider === 'pexels' || provider === 'pixabay') ? (kind === 'video' ? 88 : 80) : provider === 'archive' ? 78 : 62
  return Math.round(base * 0.6 + resolution * 0.4)
}
function dimNicheFit(nicheMatched: boolean): number { return nicheMatched ? 92 : 68 }
function dimUniqueness(reuseCount: number): number { return Math.max(10, 100 - reuseCount * 25) }
function dimQueryRelevance(rank: number, nicheMatched: boolean): number {
  if (rank < 0) return nicheMatched ? 60 : 55                                   // niet query-gerankt
  return Math.max(50, 90 - rank * 4)                                            // top-hit = relevanter
}

interface Scored {
  c: Candidate
  dims: { resolution: number; movement: number; portrait_fit: number; commercial: number; niche_fit: number; uniqueness: number; query_relevance: number }
  reuseCount: number
  final: number
}
function scoreCandidate(c: Candidate, reuseCount: number, format: '16:9' | '9:16' | '1:1'): Scored {
  const resolution = dimResolution(c.width)
  const dims = {
    resolution,
    movement: dimMovement(c.kind),
    portrait_fit: dimPortraitFit(c.width, c.height, format),
    commercial: dimCommercial(c.provider, c.kind, resolution),
    niche_fit: dimNicheFit(c.nicheMatched),
    uniqueness: dimUniqueness(reuseCount),
    query_relevance: dimQueryRelevance(c.rank, c.nicheMatched),
  }
  // weging: query-relevantie 20 · portrait-fit 20 · resolutie 15 · beweging 15 · commercieel 10 · niche 10 · uniqueness 10
  const final = Math.round(
    dims.query_relevance * 0.20 + dims.portrait_fit * 0.20 + dims.resolution * 0.15 +
    dims.movement * 0.15 + dims.commercial * 0.10 + dims.niche_fit * 0.10 + dims.uniqueness * 0.10,
  )
  return { c, dims, reuseCount, final }
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

/** Confidence (0..100): score gekozen bron, gecorrigeerd voor bron-type + voorsprong op #2. */
function deriveConfidence(winner: Scored, runnerUp: Scored | null): number {
  let conf = winner.final
  if (winner.c.kind === 'photo') conf -= 12           // stilstaand beeld minder ideaal dan video
  if (winner.c.provider === 'youtube') conf -= 8      // eigen thumbnail, niet doelgericht geschoten
  const margin = runnerUp ? winner.final - runnerUp.final : 12
  conf += Math.min(8, Math.max(0, margin) / 2)        // duidelijke voorsprong = zekerder
  return Math.max(0, Math.min(100, Math.round(conf)))
}

/** Concreet verbeteradvies bij zwakke/lage dekking (deterministisch, geen LLM-gok). */
function deriveAdvice(best: Scored | null, sourcesTried: string[]): string {
  if (!best) return `Geen enkele bron gaf resultaat (geprobeerd: ${sourcesTried.join(', ')}). Verfijn search_query naar één concreet visueel onderwerp in het Engels, of voeg niche-archief toe.`
  const reasons: string[] = []
  if (best.dims.portrait_fit < 60) reasons.push('alleen landscape-materiaal (zware crop voor 9:16) — zoek portrait-bron')
  if (best.c.kind === 'photo') reasons.push('alleen foto-match (geen bewegend beeld) — verfijn term voor video-resultaat')
  if (best.dims.query_relevance < 60 && !best.c.nicheMatched) reasons.push('lage zoek-relevantie — maak search_query specifieker')
  if (best.dims.resolution < 70) reasons.push('lage resolutie — beperk tot HD-bronnen')
  if (reasons.length === 0) reasons.push('beste bron scoort net onder de drempel — verfijn search_query of breid bronnen uit')
  return reasons.join('; ')
}

/** Vertaalt zoektermen één keer naar Engels (stock-bibliotheken zijn Engels). Fallback = origineel. */
async function translateQueriesToEnglish(language: string | null, queries: string[]): Promise<string[]> {
  try {
    const lang = (language || 'en').toLowerCase()
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

export interface VisualResult {
  blockedReason: string | null
  sceneCount: number
  assetsSelected: number
  belowThreshold: number
  lowConfidence: number      // aantal scenes gemarkeerd low_visual_confidence
}

export async function sourceVisualsForProject(projectId: string, format: '16:9' | '9:16' | '1:1'): Promise<VisualResult> {
  if (!process.env.PEXELS_API_KEY && !process.env.PIXABAY_API_KEY) {
    return { blockedReason: VISUAL_GATE_NO_PROVIDER, sceneCount: 0, assetsSelected: 0, belowThreshold: 0, lowConfidence: 0 }
  }
  const orientation: Orientation = format === '9:16' ? 'portrait' : format === '1:1' ? 'square' : 'landscape'

  const { data: proj } = await db.from('video_projects').select('language, niche').eq('id', projectId).maybeSingle()
  const niche = (proj?.niche as string | null) ?? null

  const { data: scenes } = await db.from('video_scenes')
    .select('id, idx, search_query, visual_intent, expected_duration')
    .eq('project_id', projectId).order('idx')
  const list = scenes ?? []

  const rawQueries = list.map((sc) => (sc.search_query || sc.visual_intent || '').trim())
  const enQueries = await translateQueriesToEnglish(proj?.language as string | null, rawQueries)

  // niche-bronnen één keer ophalen (gedeeld over scenes; geen query-match, wél niche-fit)
  const ytArchive = await searchYouTubeArchive(niche)
  const ownArchive = await searchOwnArchive(niche)

  let selected = 0, below = 0, lowConf = 0
  for (let i = 0; i < list.length; i++) {
    const sc = list[i]
    const sceneDur = Number(sc.expected_duration) || 5
    const query = enQueries[i] || rawQueries[i]
    const sourcesTried: string[] = []

    // RONDE 1 — video-bronnen (voorkeur). Fallback alleen wanneer écht nodig.
    let raw: Candidate[] = []
    if (query) {
      sourcesTried.push('pexels-video', 'pixabay-video')
      raw = [...await searchPexels(query, orientation), ...await searchPixabay(query, orientation)]
    }
    let scored = await Promise.all(raw.map(async (c) => scoreCandidate(c, await reuseCountFor(c.url), format)))
    scored.sort((a, b) => b.final - a.final)

    // RONDE 2 — pas extra bronnen erbij als ronde 1 zwak/leeg is (geen onnodige calls/fakes)
    if (!scored.length || scored[0].final < VISUAL_CONFIDENCE_GOOD) {
      const extra: Candidate[] = []
      if (query) { sourcesTried.push('pexels-foto'); extra.push(...await searchPexelsPhotos(query, orientation)) }
      if (ytArchive.length) { sourcesTried.push('youtube-archief'); extra.push(...ytArchive) }
      if (ownArchive.length) { sourcesTried.push('eigen-archief'); extra.push(...ownArchive) }
      const extraScored = await Promise.all(extra.map(async (c) => scoreCandidate(c, await reuseCountFor(c.url), format)))
      scored = [...scored, ...extraScored].sort((a, b) => b.final - a.final)
    }

    const winner = scored[0] ?? null
    const runnerUp = scored[1] ?? null
    const confidence = winner ? deriveConfidence(winner, runnerUp) : 0

    // beslis: gebruiken, low-confidence-gebruiken, of niet gebruiken (te zwak/irrelevant)
    const usable = !!winner && winner.final >= VISUAL_SELECT_FLOOR
    const lowConfidence = !usable || winner!.final < VISUAL_CONFIDENCE_GOOD || confidence < VISUAL_CONFIDENCE_GOOD
    const advice = lowConfidence ? deriveAdvice(usable ? winner : null, sourcesTried) : null

    // audittrail: top-8 kandidaten met dimensie-scores + reden van afwijzing
    const candidatesJson = scored.slice(0, 8).map((s, rank) => ({
      provider: s.c.provider, kind: s.c.kind, url: s.c.url,
      resolution: s.c.width && s.c.height ? `${s.c.width}x${s.c.height}` : null,
      scores: s.dims, final: s.final,
      chosen: usable && rank === 0,
      reject_reason: (usable && rank === 0) ? null
        : (s.final < VISUAL_SELECT_FLOOR ? `te zwak (score ${s.final} < ${VISUAL_SELECT_FLOOR})`
          : `lager gescoord (${s.final} < ${winner?.final})`),
    }))

    let chosenAssetId: string | null = null

    if (usable) {
      const w = winner!
      const localPath = path.join(os.tmpdir(), `cf2-asset-${projectId}-${sc.id}.mp4`)
      let ok = true
      try {
        if (w.c.kind === 'photo') {
          const imgTmp = path.join(os.tmpdir(), `cf2-photo-${projectId}-${sc.id}.jpg`)
          await downloadTo(w.c.url, imgTmp)
          await photoToClip(imgTmp, localPath, sceneDur, format)
          try { fs.unlinkSync(imgTmp) } catch { /* */ }
        } else {
          await downloadTo(w.c.url, localPath)
        }
      } catch { ok = false }

      if (ok) {
        const { data: asset } = await db.from('visual_assets').insert({
          scene_id: sc.id, project_id: projectId,
          source_provider: w.c.provider,
          original_source_url: w.c.url,
          local_asset_url: localPath,
          license: w.c.license,
          license_status: 'free_commercial',
          duration: w.c.kind === 'photo' ? sceneDur : w.c.duration,
          resolution: w.c.width && w.c.height ? `${w.c.width}x${w.c.height}` : null,
          topic_relevance: null,                    // perceptueel → Visual QC-agent
          cinematic_score: w.dims.resolution,
          freshness_score: w.dims.uniqueness,
          uniqueness_score: w.dims.uniqueness,
          final_visual_score: w.final,
          approved_for_reuse: false,
        }).select('id').single()
        if (asset?.id) {
          chosenAssetId = asset.id
          await db.from('video_scenes').update({ selected_asset_id: asset.id }).eq('id', sc.id)
          selected++
        } else { below++ }
      } else { below++ }
    } else {
      below++   // geen inhoudelijk passende bron → scene zonder asset (render slaat 'm netjes over)
    }

    if (lowConfidence) lowConf++

    // scene-vlaggen + volledige beslis-audittrail wegschrijven (uitlegbaarheid)
    await db.from('video_scenes').update({
      visual_confidence: confidence,
      low_visual_confidence: lowConfidence,
      visual_advice: advice,
    }).eq('id', sc.id)

    await db.from('cf2_visual_decisions').insert({
      project_id: projectId, scene_id: sc.id, scene_idx: sc.idx,
      query_used: query || null,
      chosen_provider: usable ? winner!.c.provider : null,
      chosen_kind: usable ? winner!.c.kind : null,
      chosen_url: usable ? winner!.c.url : null,
      chosen_asset_id: chosenAssetId,
      final_score: winner?.final ?? null,
      runner_up_score: runnerUp?.final ?? null,
      confidence,
      low_confidence: lowConfidence,
      advice,
      candidates: candidatesJson,
      sources_tried: sourcesTried,
    })
  }

  return { blockedReason: null, sceneCount: list.length, assetsSelected: selected, belowThreshold: below, lowConfidence: lowConf }
}
