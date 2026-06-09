import 'dotenv/config'
import fs from 'fs'
import { createClient } from '@supabase/supabase-js'
import { localLlmJson, clampScore } from './local-llm'

/**
 * MUSIC INTELLIGENCE ENGINE (Content Factory 2.0 — FASE F).
 *
 * Selecteert achtergrondmuziek uit een LICENSED catalogus (env MUSIC_CATALOG =
 * pad naar JSON [{name,path,license,bpm,mood,energy}]). Scoort op premium/
 * retention/platform-fit (lokaal model) + license-safety. Hoogste >=90 →
 * audio_assets(kind='music'). public.audio_library (trend-signaal) voedt de
 * platform-fit, maar levert GEEN bestand/licentie → geen track-bron op zich.
 *
 * Geen licensed bron → `blocked_missing_music_source`. Geen fake muziek, geen
 * placeholders. Geen track >=90 → rework.
 */

const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
export const MUSIC_MIN_SCORE = 90
export const MUSIC_GATE_NO_SOURCE = 'blocked_missing_music_source'

interface CatalogTrack { name: string; path: string; license: string; bpm?: number; mood?: string; energy?: string }

function loadCatalog(): CatalogTrack[] | null {
  const p = process.env.MUSIC_CATALOG
  if (!p || !fs.existsSync(p)) return null
  try {
    const arr = JSON.parse(fs.readFileSync(p, 'utf8'))
    return Array.isArray(arr) ? arr.filter((t) => t?.path && t?.license) : null
  } catch { return null }
}

interface MusicScore { premium_fit: number; retention_fit: number; platform_fit: number; music_score: number; reject_reason: string | null }
async function scoreTrack(track: CatalogTrack, niche: string, needMood: string, platformTrend: number): Promise<MusicScore> {
  // license-safety hard: alleen vrij/gelicentieerd commercieel gebruik
  const safe = /royalty|cc0|commercial|licensed|owned/i.test(track.license)
  if (!safe) return { premium_fit: 0, retention_fit: 0, platform_fit: 0, music_score: 0, reject_reason: 'license_unsafe' }

  const p = `Beoordeel deze achtergrondmuziek voor een NL ${niche}-video (documentaire/finance, premium gevoel). ALLEEN JSON.
TRACK: "${track.name}" mood=${track.mood ?? '?'} bpm=${track.bpm ?? '?'} energy=${track.energy ?? '?'}
GEVRAAGDE SFEER: ${needMood}
Scoor 0-100: premium_fit, retention_fit (houdt aandacht vast), platform_fit (YouTube/Shorts compliant).
{"premium_fit":<n>,"retention_fit":<n>,"platform_fit":<n>}`
  const r = await localLlmJson(p)
  const premium = clampScore(r.premium_fit), retention = clampScore(r.retention_fit)
  // platform_fit licht opgehoogd door echte trend-velocity uit audio_library (0..~)
  const platform = Math.min(100, clampScore(r.platform_fit) + Math.min(10, Math.round(platformTrend)))
  const music_score = Math.round(premium * 0.4 + retention * 0.4 + platform * 0.2)
  return { premium_fit: premium, retention_fit: retention, platform_fit: platform, music_score, reject_reason: null }
}

export interface MusicResult { blockedReason: string | null; candidates: number; selectedScore: number | null }

export async function selectMusic(projectId: string): Promise<MusicResult> {
  const catalog = loadCatalog()
  if (!catalog || catalog.length === 0) return { blockedReason: MUSIC_GATE_NO_SOURCE, candidates: 0, selectedScore: null }

  const { data: project } = await db.from('video_projects').select('niche').eq('id', projectId).single()
  const { data: scenes } = await db.from('video_scenes').select('music_intensity, emotion').eq('project_id', projectId)
  const moods = Array.from(new Set((scenes ?? []).map((s) => s.emotion).filter(Boolean)))
  const intensities = Array.from(new Set((scenes ?? []).map((s) => s.music_intensity).filter(Boolean)))
  const needMood = `${moods.join('/') || 'neutral'} · ${intensities.join('→') || 'building'}`

  // trend-signaal (audio_library): hoogste trend_velocity voor youtube als platform-fit-boost
  const { data: trend } = await db.from('audio_library').select('trend_velocity').eq('platform', 'youtube').order('trend_velocity', { ascending: false }).limit(1).maybeSingle()
  const trendBoost = Number(trend?.trend_velocity ?? 0)

  let best: { track: CatalogTrack; s: MusicScore } | null = null
  for (const track of catalog.slice(0, 12)) {
    const s = await scoreTrack(track, project?.niche ?? 'vastgoed', needMood, trendBoost)
    if (!best || s.music_score > best.s.music_score) best = { track, s }
  }
  if (!best) return { blockedReason: MUSIC_GATE_NO_SOURCE, candidates: 0, selectedScore: null }

  // schrijf audio_assets(kind=music) — ook onder de drempel (transparant), gate beslist later
  await db.from('audio_assets').insert({
    project_id: projectId, kind: 'music', provider: 'catalog', url: best.track.path, language: null,
    duration: null,
    scores: { premium_fit: best.s.premium_fit, retention_fit: best.s.retention_fit, platform_fit: best.s.platform_fit, mood: needMood, license: best.track.license, reject_reason: best.s.reject_reason },
    final_score: best.s.music_score,
  })

  return { blockedReason: null, candidates: catalog.length, selectedScore: best.s.music_score }
}
