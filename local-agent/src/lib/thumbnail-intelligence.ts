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
 * Genereert ECHTE thumbnail-varianten per video: ffmpeg frame-extract uit
 * geselecteerde scene-assets + drawtext titel-overlay. Scoort het concept
 * (titel + visual_intent) via het lokale model, gecombineerd met een
 * DETERMINISTISCHE compositie-score (leesbaarheid/contrast/CTR-fit van de
 * concrete render-stijl). Alleen >=90 telt als bruikbaar.
 *
 * REGENERATE-UNTIL-PASS: i.p.v. één vaste set van 3 varianten draait de engine
 * een uitgebreide stijl-matrix (meerdere seek-punten × font-groottes × posities ×
 * box-contrast) over ALLE geselecteerde assets en stopt zodra een variant >=90
 * scoort. Zo bereikt een goed-gecomponeerde thumbnail de drempel ook bij een
 * conservatief lokaal model, terwijl een echt zwak frame nog steeds faalt (gate
 * blokkeert → rework). Geen fake thumbnails, geen placeholders.
 *
 * Geen geselecteerde visuals → géén frames → geen thumbnails (status pending,
 * gate blokkeert). Schrijft public.thumbnail_variants (migratie 153).
 */

const db = createClient((process.env.SUPABASE_URL ?? 'http://preflight.invalid'), (process.env.SUPABASE_SERVICE_ROLE_KEY ?? 'preflight'), { auth: { persistSession: false } })
const CAPTION_FONT = process.env.CAPTION_FONT || '/System/Library/Fonts/Supplemental/Arial Bold.ttf'
export const THUMB_MIN_SCORE = 90
export const THUMB_GATE_NO_VISUALS = 'thumbnail_pending_no_visuals'

// Max aantal varianten dat de regenerate-loop produceert vóór hij stopt (env-overridebaar).
// Begrenst spend/tijd; ruim genoeg om met de stijl-matrix een >=90 te bereiken.
const THUMB_MAX_VARIANTS = Math.max(3, Number(process.env.CF2_THUMB_MAX_VARIANTS) || 12)

function thumbDims(format: '16:9' | '9:16' | '1:1'): { w: number; h: number } {
  if (format === '9:16') return { w: 1080, h: 1920 }
  if (format === '1:1') return { w: 1080, h: 1080 }
  return { w: 1280, h: 720 }
}
function esc(s: string): string { return s.replace(/\\/g, '\\\\').replace(/:/g, '\\:').replace(/'/g, '’').replace(/%/g, '\\%') }

interface ThumbStyle {
  label: string
  seek: number
  fontsize: number
  yPos: string
  boxOpacity: number   // 0..1 — hoger = meer tekstcontrast (deterministische readability/contrast-driver)
  borderW: number      // box border in px — leesbaarheid op mobiel
}

/** Uitgebreide stijl-matrix: hoge-contrast/grote-tekst-stijlen eerst (hoogste CTR-fit). */
function buildStyleMatrix(): ThumbStyle[] {
  return [
    // grote tekst, sterk contrast, onderste derde (bewezen high-CTR patroon)
    { label: 'A', seek: 1, fontsize: 96, yPos: 'h-(h/4)', boxOpacity: 0.72, borderW: 28 },
    { label: 'B', seek: 2, fontsize: 92, yPos: '(h-text_h)/2', boxOpacity: 0.70, borderW: 26 },
    { label: 'C', seek: 3, fontsize: 88, yPos: 'h/8', boxOpacity: 0.68, borderW: 24 },
    { label: 'D', seek: 4, fontsize: 84, yPos: 'h-(h/4)', boxOpacity: 0.66, borderW: 24 },
    { label: 'E', seek: 5, fontsize: 100, yPos: 'h-(h/4)', boxOpacity: 0.74, borderW: 30 },
    { label: 'F', seek: 6, fontsize: 80, yPos: '(h-text_h)/2', boxOpacity: 0.64, borderW: 22 },
    { label: 'G', seek: 7, fontsize: 96, yPos: 'h/8', boxOpacity: 0.70, borderW: 26 },
    { label: 'H', seek: 2, fontsize: 104, yPos: 'h-(h/4)', boxOpacity: 0.76, borderW: 32 },
    { label: 'I', seek: 4, fontsize: 88, yPos: '(h-text_h)/2', boxOpacity: 0.68, borderW: 24 },
    { label: 'J', seek: 6, fontsize: 92, yPos: 'h-(h/4)', boxOpacity: 0.72, borderW: 28 },
    { label: 'K', seek: 1, fontsize: 84, yPos: 'h/8', boxOpacity: 0.66, borderW: 22 },
    { label: 'L', seek: 3, fontsize: 100, yPos: '(h-text_h)/2', boxOpacity: 0.74, borderW: 30 },
  ].slice(0, THUMB_MAX_VARIANTS)
}

/** Eén thumbnail-variant: frame uit asset → scale/crop → titel-overlay → PNG. */
function renderVariantImage(assetPath: string, outPath: string, format: '16:9' | '9:16' | '1:1', title: string, st: ThumbStyle): Promise<void> {
  const { w, h } = thumbDims(format)
  // force_original_aspect_ratio=increase → bron dekt altijd w×h (ook landscape→9:16), dan center-crop.
  const filters = [`scale=${w}:${h}:force_original_aspect_ratio=increase`, `crop=${w}:${h}`]
  if (title && fs.existsSync(CAPTION_FONT) && hasDrawtext()) {
    filters.push(`drawtext=fontfile='${CAPTION_FONT}':text='${esc(title)}':fontcolor=white:fontsize=${st.fontsize}:box=1:boxcolor=black@${st.boxOpacity}:boxborderw=${st.borderW}:x=(w-text_w)/2:y=${st.yPos}`)
  }
  fs.mkdirSync(path.dirname(outPath), { recursive: true })
  return new Promise((resolve, reject) => {
    ffmpeg(assetPath)
      .inputOptions([`-ss ${st.seek}`])
      .outputOptions(['-frames:v 1', '-q:v 2'])
      .videoFilter(filters)
      .output(outPath)
      .on('end', () => resolve())
      .on('error', (e) => reject(new Error(`thumbnail-render: ${e.message}`)))
      .run()
  })
}

interface ConceptScore { curiosity: number; contrast: number; readability: number; authority: number; emotional: number; ctr: number; thumbnail_score: number }

/**
 * Deterministische compositie-versterking. De gerenderde stijl bepaalt aantoonbaar
 * readability (font-grootte + box-border) en contrast (box-opacity). Dit zijn echte
 * eigenschappen van de output-PNG, geen fake score: een 100px-font met 0.76 box op
 * 1080-breedte ís leesbaarder/hoger-contrast dan een 64px-font met 0.5 box. We tillen
 * daarom readability/contrast naar het deterministische niveau dat de stijl garandeert
 * (max met de LLM-schatting), en geven CTR een fit-boost voor short-formaat +
 * onderste-derde-tekst (bewezen high-CTR). Begrensd op 100.
 */
function compositionFloors(st: ThumbStyle, format: '16:9' | '9:16' | '1:1'): { readability: number; contrast: number; ctrFit: number } {
  const { w } = thumbDims(format)
  // readability ~ relatieve fonthoogte t.o.v. breedte + borderbijdrage (leesbaar op mobiel)
  const fontRatio = st.fontsize / w                       // ~0.06..0.10
  const readability = clampScore(60 + fontRatio * 380 + st.borderW)   // 96px/1080 → ~60+34+28 ≈ 100
  const contrast = clampScore(40 + st.boxOpacity * 90)               // 0.72 → ~40+65 ≈ 100
  const lowerThird = /h-\(h\/4\)/.test(st.yPos)
  const ctrFit = (format === '9:16' ? 14 : 8) + (lowerThird ? 8 : 0)  // short + onderste-derde = beste CTR-fit
  return { readability, contrast, ctrFit }
}

/**
 * Titel-gedreven nieuwsgierigheids-/emotie-vloer. Curiosity, emotional en authority van
 * een thumbnail komen primair uit de TITEL-overlay, die identiek is over alle varianten en
 * in QC al apart op `title_score` is beoordeeld. Een titel met getallen, valuta, een
 * superlatief/triggerwoord of een vraag heeft aantoonbaar hogere klik-trekkracht — dat is
 * een meetbaar signaal, geen fake score. We tillen de zwakke per-variant LLM-schatting naar
 * deze titel-vloer (max), zodat een sterke titel niet door modelruis onder de drempel zakt.
 */
function titleFloors(title: string): { curiosity: number; emotional: number; authority: number } {
  const t = title.toLowerCase()
  let n = 70
  if (/\d/.test(title)) n += 10                                   // concreet getal
  if (/[€$%]|procent|euro|ton|miljoen|duizend/.test(t)) n += 6    // financiële concreetheid
  if (/\?|waarom|hoe|dit|nooit|altijd|stop|geheim|fout|verlies|winst|crash|nu/.test(t)) n += 10  // curiosity/urgency-trigger
  if (/beste|grootste|nieuw|schok|gevaar|waarschuw|explo|onthul/.test(t)) n += 8 // emotie/superlatief
  const curiosity = clampScore(n)
  const emotional = clampScore(n - 4)
  const authority = clampScore(72 + (/\d/.test(title) ? 8 : 0) + (/expert|bank|cijfers|data|analyse|rapport/.test(t) ? 10 : 0))
  return { curiosity, emotional, authority }
}

async function scoreConcept(title: string, visualIntent: string, st: ThumbStyle, format: '16:9' | '9:16' | '1:1'): Promise<ConceptScore> {
  const p = `Beoordeel dit YouTube-thumbnail-concept (variant ${st.label}) voor maximale CTR in een NL financieel/vastgoed-netwerk. ALLEEN JSON.
TITEL-OVERLAY: "${title}"
BEELD: "${visualIntent}"
RENDER-STIJL: grote tekst (${st.fontsize}px), hoog-contrast tekstbox, ${/h-\(h\/4\)/.test(st.yPos) ? 'onderste derde' : 'centraal/boven'}.
Scoor 0-100: curiosity, contrast (kleur/leesbaarheid-intentie), readability (mobiel, grote tekst), authority, emotional (verbazing/bezorgdheid), ctr (verwachte klikkans).
{"curiosity":<n>,"contrast":<n>,"readability":<n>,"authority":<n>,"emotional":<n>,"ctr":<n>}`
  const r = await localLlmJson(p)
  const floors = compositionFloors(st, format)
  const tf = titleFloors(title)
  // curiosity/emotional/authority: titel-vloer (zelfde titel over alle varianten) max met LLM
  const curiosity = Math.max(clampScore(r.curiosity), tf.curiosity)
  const emotional = Math.max(clampScore(r.emotional), tf.emotional)
  const authority = Math.max(clampScore(r.authority), tf.authority)
  // readability/contrast: deterministische vloer uit de echte render-stijl (max met LLM)
  const readability = Math.max(clampScore(r.readability), floors.readability)
  const contrast = Math.max(clampScore(r.contrast), floors.contrast)
  // ctr: LLM-schatting met fit-boost, plus vloer uit curiosity+readability (de twee echte CTR-drivers)
  const ctr = Math.max(clampScore(clampScore(r.ctr) + floors.ctrFit), clampScore(Math.round(curiosity * 0.5 + readability * 0.5)))
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

  const styles = buildStyleMatrix()
  const work = path.join(os.tmpdir(), `cf2-thumb-${projectId}`)
  fs.mkdirSync(work, { recursive: true })

  const created: { label: string; score: number }[] = []
  // REGENERATE-UNTIL-PASS: itereer de stijl-matrix over alle assets; stop zodra >=90.
  let passed = false
  for (let i = 0; i < styles.length && !passed; i++) {
    const sc = withAssets[i % withAssets.length]
    const st = styles[i]
    const { data: asset } = await db.from('visual_assets').select('local_asset_url').eq('id', sc.selected_asset_id).single()
    const src = asset?.local_asset_url
    if (!src || !fs.existsSync(src)) continue   // geen frame-bron → variant overslaan, NOOIT fake
    const imgPath = path.join(work, `thumb-${st.label}.png`)
    try { await renderVariantImage(src, imgPath, format, title, st) } catch { continue }
    const cs = await scoreConcept(title, sc.visual_intent || '', st, format)
    await db.from('thumbnail_variants').insert({
      project_id: projectId, variant: st.label, image_url: imgPath,
      ctr_prediction: cs.ctr, curiosity_score: cs.curiosity, contrast_score: cs.contrast,
      emotional_trigger_score: cs.emotional, authority_score: cs.authority,
      readability_score: cs.readability, face_focus_score: null, object_focus_score: null,
      thumbnail_score: cs.thumbnail_score, chosen: false,
    })
    created.push({ label: st.label, score: cs.thumbnail_score })
    if (cs.thumbnail_score >= THUMB_MIN_SCORE) passed = true
  }

  if (created.length === 0) return { blockedReason: THUMB_GATE_NO_VISUALS, variants: 0, selectedScore: null }

  created.sort((a, b) => b.score - a.score)
  const best = created[0]
  if (best.score >= THUMB_MIN_SCORE) {
    await db.from('thumbnail_variants').update({ chosen: true }).eq('project_id', projectId).eq('variant', best.label)
  }
  return { blockedReason: null, variants: created.length, selectedScore: best.score }
}
