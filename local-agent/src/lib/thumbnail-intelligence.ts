import 'dotenv/config'
import ffmpeg from 'fluent-ffmpeg'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { createClient } from '@supabase/supabase-js'
import { localLlmJson, clampScore } from './local-llm'
import { hasDrawtext } from './ffmpeg-caps'

/**
 * THUMBNAIL INTELLIGENCE ENGINE (Content Factory 2.0 — FASE E).
 *
 * Genereert ≥3 ECHTE thumbnail-varianten per video: ffmpeg frame-extract uit
 * geselecteerde scene-assets + drawtext titel-overlay. Scoort het concept
 * (titel + visual_intent) via het lokale model. Selecteert de hoogste; alleen
 * >=90 telt als bruikbaar. Geen fake thumbnails, geen placeholders.
 *
 * Geen geselecteerde visuals → géén frames → geen thumbnails (status pending,
 * gate blokkeert). Schrijft public.thumbnail_variants (migratie 153).
 */

const db = createClient((process.env.SUPABASE_URL ?? 'http://preflight.invalid'), (process.env.SUPABASE_SERVICE_ROLE_KEY ?? 'preflight'), { auth: { persistSession: false } })
const CAPTION_FONT = process.env.CAPTION_FONT || '/System/Library/Fonts/Supplemental/Arial Bold.ttf'
export const THUMB_MIN_SCORE = 90
export const THUMB_GATE_NO_VISUALS = 'thumbnail_pending_no_visuals'

function thumbDims(format: '16:9' | '9:16' | '1:1'): { w: number; h: number } {
  if (format === '9:16') return { w: 1080, h: 1920 }
  if (format === '1:1') return { w: 1080, h: 1080 }
  return { w: 1280, h: 720 }
}
function esc(s: string): string { return s.replace(/\\/g, '\\\\').replace(/:/g, '\\:').replace(/'/g, '’').replace(/%/g, '\\%') }

/** Eén thumbnail-variant: frame uit asset → scale/crop → titel-overlay → PNG. */
function renderVariantImage(assetPath: string, outPath: string, format: '16:9' | '9:16' | '1:1', title: string, seekSec: number, fontsize: number, yPos: string): Promise<void> {
  const { w, h } = thumbDims(format)
  // force_original_aspect_ratio=increase → bron dekt altijd w×h (ook landscape→9:16), dan center-crop.
  const filters = [`scale=${w}:${h}:force_original_aspect_ratio=increase`, `crop=${w}:${h}`]
  if (title && fs.existsSync(CAPTION_FONT) && hasDrawtext()) {
    filters.push(`drawtext=fontfile='${CAPTION_FONT}':text='${esc(title)}':fontcolor=white:fontsize=${fontsize}:box=1:boxcolor=black@0.55:boxborderw=20:x=(w-text_w)/2:y=${yPos}`)
  }
  fs.mkdirSync(path.dirname(outPath), { recursive: true })
  return new Promise((resolve, reject) => {
    ffmpeg(assetPath)
      .inputOptions([`-ss ${seekSec}`])
      .outputOptions(['-frames:v 1', '-q:v 2'])
      .videoFilter(filters)
      .output(outPath)
      .on('end', () => resolve())
      .on('error', (e) => reject(new Error(`thumbnail-render: ${e.message}`)))
      .run()
  })
}

interface ConceptScore { curiosity: number; contrast: number; readability: number; authority: number; emotional: number; ctr: number; thumbnail_score: number }
async function scoreConcept(title: string, visualIntent: string, variant: string): Promise<ConceptScore> {
  const p = `Beoordeel dit YouTube-thumbnail-concept (variant ${variant}) voor maximale CTR in een NL financieel/vastgoed-netwerk. ALLEEN JSON.
TITEL-OVERLAY: "${title}"
BEELD: "${visualIntent}"
Scoor 0-100: curiosity, contrast (kleur/leesbaarheid-intentie), readability (mobiel, grote tekst), authority, emotional (verbazing/bezorgdheid), ctr (verwachte klikkans).
{"curiosity":<n>,"contrast":<n>,"readability":<n>,"authority":<n>,"emotional":<n>,"ctr":<n>}`
  const r = await localLlmJson(p)
  const curiosity = clampScore(r.curiosity), contrast = clampScore(r.contrast), readability = clampScore(r.readability)
  const authority = clampScore(r.authority), emotional = clampScore(r.emotional), ctr = clampScore(r.ctr)
  // gewogen thumbnail_score (CTR + curiosity zwaarst)
  const thumbnail_score = Math.round(ctr * 0.3 + curiosity * 0.25 + readability * 0.2 + contrast * 0.1 + emotional * 0.1 + authority * 0.05)
  return { curiosity, contrast, readability, authority, emotional, ctr, thumbnail_score }
}

export interface ThumbnailResult {
  blockedReason: string | null
  variants: number
  selectedScore: number | null
}

export async function generateThumbnails(projectId: string, format: '16:9' | '9:16' | '1:1'): Promise<ThumbnailResult> {
  const { data: project } = await db.from('video_projects').select('title, topic').eq('id', projectId).single()
  const title = (project?.title || project?.topic || '').slice(0, 60)

  const { data: scenes } = await db.from('video_scenes')
    .select('visual_intent, selected_asset_id').eq('project_id', projectId)
    .not('selected_asset_id', 'is', null).order('idx')
  const withAssets = scenes ?? []
  if (withAssets.length === 0) return { blockedReason: THUMB_GATE_NO_VISUALS, variants: 0, selectedScore: null }

  // tot 3 distinct assets → 3 varianten (verschillende seek/stijl)
  const styles = [
    { label: 'A', seek: 1, fontsize: 72, yPos: 'h-(h/4)' },
    { label: 'B', seek: 2, fontsize: 84, yPos: '(h-text_h)/2' },
    { label: 'C', seek: 3, fontsize: 64, yPos: 'h/8' },
  ]
  const work = path.join(os.tmpdir(), `cf2-thumb-${projectId}`)
  fs.mkdirSync(work, { recursive: true })

  const created: { label: string; score: number }[] = []
  for (let i = 0; i < styles.length; i++) {
    const sc = withAssets[i % withAssets.length]
    const st = styles[i]
    const { data: asset } = await db.from('visual_assets').select('local_asset_url').eq('id', sc.selected_asset_id).single()
    const src = asset?.local_asset_url
    if (!src || !fs.existsSync(src)) continue   // geen frame-bron → variant overslaan, NOOIT fake
    const imgPath = path.join(work, `thumb-${st.label}.png`)
    try { await renderVariantImage(src, imgPath, format, title, st.seek, st.fontsize, st.yPos) } catch { continue }
    const cs = await scoreConcept(title, sc.visual_intent || '', st.label)
    await db.from('thumbnail_variants').insert({
      project_id: projectId, variant: st.label, image_url: imgPath,
      ctr_prediction: cs.ctr, curiosity_score: cs.curiosity, contrast_score: cs.contrast,
      emotional_trigger_score: cs.emotional, authority_score: cs.authority,
      readability_score: cs.readability, face_focus_score: null, object_focus_score: null,
      thumbnail_score: cs.thumbnail_score, chosen: false,
    })
    created.push({ label: st.label, score: cs.thumbnail_score })
  }

  if (created.length === 0) return { blockedReason: THUMB_GATE_NO_VISUALS, variants: 0, selectedScore: null }

  created.sort((a, b) => b.score - a.score)
  const best = created[0]
  if (best.score >= THUMB_MIN_SCORE) {
    await db.from('thumbnail_variants').update({ chosen: true }).eq('project_id', projectId).eq('variant', best.label)
  }
  return { blockedReason: null, variants: created.length, selectedScore: best.score }
}
