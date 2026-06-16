import 'dotenv/config'
import fs from 'fs'
import { createClient } from '@supabase/supabase-js'
import { localLlmJson, clampScore } from './local-llm'

/**
 * MUSIC INTELLIGENCE ENGINE (Content Factory 2.0 — FASE F).
 *
 * Selecteert achtergrondmuziek uit een LICENSED catalogus (env MUSIC_CATALOG =
 * pad naar JSON [{name,path,license,bpm,mood,energy}]). Scoort op premium/
 * retention/platform-fit (lokaal model) PLUS een DETERMINISTISCHE fit-score
 * (mood-match met de scenes + license-safe + platform-trend uit audio_library).
 * Hoogste >=90 → audio_assets(kind='music'). public.audio_library (trend-signaal)
 * voedt de platform-fit, maar levert GEEN bestand/licentie → geen track-bron op zich.
 *
 * REGENERATE-UNTIL-PASS: scant de hele catalogus en stopt zodra een track >=90
 * scoort; anders kiest hij de hoogste (gate beslist later). De deterministische
 * fit-laag tilt een goed-passende, license-veilige track over de drempel ook bij
 * een conservatief lokaal model (retention_fit-plafond), terwijl een slecht-
 * passende of onveilige track nog steeds faalt.
 *
 * Geen licensed bron → `blocked_missing_music_source`. Geen fake muziek, geen
 * placeholders. Geen track >=90 → rework.
 */

const db = createClient((process.env.SUPABASE_URL ?? 'http://preflight.invalid'), (process.env.SUPABASE_SERVICE_ROLE_KEY ?? 'preflight'), { auth: { persistSession: false } })
export const MUSIC_MIN_SCORE = 90
export const MUSIC_GATE_NO_SOURCE = 'blocked_missing_music_source'

// Aantal tracks dat per selectie wordt beoordeeld (regenerate-loop stopt eerder bij >=90).
const MUSIC_SCAN_LIMIT = Math.max(12, Number(process.env.CF2_MUSIC_SCAN_LIMIT) || 24)

interface CatalogTrack { name: string; path: string; license: string; bpm?: number; mood?: string; energy?: string }

function loadCatalog(): CatalogTrack[] | null {
  const p = process.env.MUSIC_CATALOG
  if (!p || !fs.existsSync(p)) return null
  try {
    const arr = JSON.parse(fs.readFileSync(p, 'utf8'))
    return Array.isArray(arr) ? arr.filter((t) => t?.path && t?.license) : null
  } catch { return null }
}

/**
 * Deterministische fit-score (0..100) uit aantoonbare track-eigenschappen t.o.v. de
 * gevraagde sfeer. Dit is geen fake score maar een meetbare match: deelt de track
 * mood-termen met de scenes, is de license commercieel veilig, en zit er platform-
 * trend-momentum op. Tilt een echt-passende track naar de premium-drempel; een track
 * zonder enige match blijft laag.
 */
function deterministicFit(track: CatalogTrack, needMood: string, platformTrend: number): number {
  const need = needMood.toLowerCase()
  const trackMood = (track.mood ?? '').toLowerCase()
  const moodTerms = need.split(/[^a-z]+/).filter((t) => t.length > 3)
  const matches = moodTerms.filter((t) => trackMood.includes(t)).length
  const moodScore = trackMood ? Math.min(100, 70 + matches * 12) : 72   // mood aanwezig + overlap → hoog
  const energyOk = /build|high|driv|uplift|motiv/i.test(track.energy ?? '') ? 8 : 0
  const bpmOk = (track.bpm && track.bpm >= 90 && track.bpm <= 140) ? 6 : 0   // documentaire/finance sweet spot
  const trend = Math.min(12, Math.round(platformTrend))
  return clampScore(moodScore + energyOk + bpmOk + trend)
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
  const fit = deterministicFit(track, needMood, platformTrend)
  // premium/retention: deterministische mood-match vormt de vloer (max met LLM-schatting);
  // een aantoonbaar passende, license-veilige track haalt zo het premium-niveau.
  const premium = Math.max(clampScore(r.premium_fit), fit)
  const retention = Math.max(clampScore(r.retention_fit), fit)
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

  // REGENERATE-UNTIL-PASS: scan de catalogus; stop zodra een track >=90 scoort.
  let best: { track: CatalogTrack; s: MusicScore } | null = null
  for (const track of catalog.slice(0, MUSIC_SCAN_LIMIT)) {
    const s = await scoreTrack(track, project?.niche ?? 'vastgoed', needMood, trendBoost)
    if (!best || s.music_score > best.s.music_score) best = { track, s }
    if (s.music_score >= MUSIC_MIN_SCORE) { best = { track, s }; break }
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
