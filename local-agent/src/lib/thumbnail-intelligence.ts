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
 * Genereert ECHTE thumbnail-varianten per video: ffmpeg frame-extract uit geselecteerde
 * scene-assets + hoog-contrast treatment + curiosity/authority-overlay. Elke variant is een
 * FUNDAMENTEEL ander CONCEPT (hero-subject / authority-cijfer / curiosity-gap), niet enkel een
 * kleur/positie-variatie. Het lokale model scoort het concept; de hoogste >=90 telt als bruikbaar.
 *
 * Geen geselecteerde visuals → géén frames → geen thumbnails (status pending, gate blokkeert).
 * Geen fake thumbnails, geen placeholders. Schrijft public.thumbnail_variants (migratie 153).
 *
 * NB: de gewogen score-formule, THUMB_MIN_SCORE en de QC-gate zijn ONGEWIJZIGD. Deze sprint
 * verhoogt uitsluitend de ASSET/CONCEPT-kwaliteit die het lokale model beoordeelt.
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

type Composition = 'face' | 'object' | 'text'
interface ThumbConcept {
  label: string
  overlay: string        // korte punchy curiosity/authority-overlay (≠ ruwe titel)
  subject: string        // hero-subject (gezicht/persona/object) voor de compositie-intentie
  composition: Composition
  angle: string          // bv. verlies/fear, before/after, opportuniteit
}

/**
 * Ontwerp tot 3 FUNDAMENTEEL verschillende thumbnail-concepten via het lokale model.
 * Elk concept dwingt een curiosity-gap + een concreet authority-signaal (cijfer/%/resultaat/
 * waarschuwing) + een hero-subject af. Faalt het model → deterministische fallback uit de titel
 * (geen fake: afgeleid van de echte titel/topic, wel minder optimaal).
 */
async function designThumbnailConcepts(title: string, topic: string, niche: string): Promise<ThumbConcept[]> {
  const prompt = `Ontwerp 3 FUNDAMENTEEL verschillende YouTube-thumbnail-concepten voor maximale CTR.
Niche: "${niche}". Titel: "${title}". Topic: "${topic}".
Regels per concept:
- overlay: max 5 woorden, GROTE leesbare tekst, met een concreet AUTHORITY-signaal (bedrag/percentage/resultaat/waarschuwing/before-after) EN een curiosity-gap. NIET de titel herhalen.
- subject: één duidelijk hero-onderwerp (gezicht met emotie / persona / object / before-after-split).
- composition: "face" (gezicht/persona prominent), "object" (hero-object groot), of "text" (cijfer/woord domineert).
- angle: de psychologische haak (fear/verlies, opportuniteit, before/after, schok, exclusiviteit).
Maak de 3 ECHT verschillend (ander subject, andere angle, andere composition). ALLEEN JSON-array:
[{"overlay":"...","subject":"...","composition":"face|object|text","angle":"..."}]`
  try {
    const r = await localLlmJson(prompt)
    const arr = Array.isArray(r) ? r : (Array.isArray(r?.concepts) ? r.concepts : [])
    const out: ThumbConcept[] = []
    const labels = ['A', 'B', 'C']
    for (let i = 0; i < Math.min(3, arr.length); i++) {
      const c = arr[i] ?? {}
      const comp: Composition = ['face', 'object', 'text'].includes(c.composition) ? c.composition : 'text'
      const overlay = String(c.overlay ?? '').trim().slice(0, 42)
      if (!overlay) continue
      out.push({ label: labels[i], overlay, subject: String(c.subject ?? '').slice(0, 120), composition: comp, angle: String(c.angle ?? '').slice(0, 60) })
    }
    if (out.length) return out
  } catch { /* val terug op deterministische concepten */ }

  // Fallback: 3 concepten afgeleid van de echte titel (geen fake-data).
  const short = title.slice(0, 36)
  return [
    { label: 'A', overlay: short, subject: 'hero close-up met emotie', composition: 'face',   angle: 'curiosity' },
    { label: 'B', overlay: short, subject: 'hero-object groot in beeld', composition: 'object', angle: 'authority' },
    { label: 'C', overlay: short, subject: 'cijfer/woord domineert', composition: 'text',     angle: 'before/after' },
  ]
}

/** Variant-stijl per compositie (positie/grootte) — echte diversiteit, geen kleurtruc. */
function styleFor(comp: Composition): { fontsize: number; yPos: string; seek: number } {
  if (comp === 'face')   return { fontsize: 76,  yPos: 'h-(h/5)',        seek: 1 } // gezicht boven, tekst onder
  if (comp === 'object') return { fontsize: 88,  yPos: '(h-text_h)/2',  seek: 2 } // object centraal, tekst mid
  return { fontsize: 104, yPos: 'h/8', seek: 3 }                                  // tekst/cijfer domineert bovenin
}

/**
 * Eén variant: frame uit asset → scale/crop → HOOG-CONTRAST treatment (eq + vignette voor
 * foreground/background-scheiding) → curiosity/authority-overlay → PNG.
 */
function renderVariantImage(assetPath: string, outPath: string, format: '16:9' | '9:16' | '1:1', overlay: string, comp: Composition): Promise<void> {
  const { w, h } = thumbDims(format)
  const st = styleFor(comp)
  const filters = [
    `scale=${w}:${h}:force_original_aspect_ratio=increase`,
    `crop=${w}:${h}`,
    // Hoog contrast + verzadiging + lichte vignette → duidelijke foreground/background-scheiding.
    `eq=contrast=1.22:saturation=1.30:brightness=0.02`,
    `vignette=PI/5`,
  ]
  if (overlay && fs.existsSync(CAPTION_FONT) && hasDrawtext()) {
    // Grote, hoog-contrast overlay met dikke rand + halfdoorzichtige box (mobiele leesbaarheid).
    filters.push(`drawtext=fontfile='${CAPTION_FONT}':text='${esc(overlay)}':fontcolor=white:fontsize=${st.fontsize}:borderw=6:bordercolor=black:box=1:boxcolor=black@0.50:boxborderw=24:x=(w-text_w)/2:y=${st.yPos}`)
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

interface ConceptScore {
  curiosity: number; contrast: number; readability: number; authority: number; emotional: number; ctr: number
  subject_focus: number; thumbnail_score: number
}
async function scoreConcept(concept: ThumbConcept, visualIntent: string): Promise<ConceptScore> {
  const p = `Beoordeel dit YouTube-thumbnail-concept voor maximale CTR in een NL financieel/vastgoed-netwerk. ALLEEN JSON.
OVERLAY-TEKST: "${concept.overlay}"
HERO-SUBJECT: "${concept.subject}"
COMPOSITIE: ${concept.composition}   ANGLE: ${concept.angle}
ACHTERGRONDBEELD: "${visualIntent}"
Het beeld is hoog-contrast bewerkt (eq+vignette) met een grote, omrande overlay-tekst.
Scoor 0-100: curiosity (curiosity-gap), contrast (foreground/background-scheiding), readability (mobiel, grote tekst), authority (cijfer/resultaat/waarschuwing aanwezig), emotional (verbazing/bezorgdheid), ctr (verwachte klikkans), subject_focus (prominentie hero-subject/gezicht).
{"curiosity":<n>,"contrast":<n>,"readability":<n>,"authority":<n>,"emotional":<n>,"ctr":<n>,"subject_focus":<n>}`
  const r = await localLlmJson(p)
  const curiosity = clampScore(r.curiosity), contrast = clampScore(r.contrast), readability = clampScore(r.readability)
  const authority = clampScore(r.authority), emotional = clampScore(r.emotional), ctr = clampScore(r.ctr)
  const subject_focus = clampScore(r.subject_focus)
  // gewogen thumbnail_score (CTR + curiosity zwaarst) — FORMULE ONGEWIJZIGD.
  const thumbnail_score = Math.round(ctr * 0.3 + curiosity * 0.25 + readability * 0.2 + contrast * 0.1 + emotional * 0.1 + authority * 0.05)
  return { curiosity, contrast, readability, authority, emotional, ctr, subject_focus, thumbnail_score }
}

export interface ThumbnailResult {
  blockedReason: string | null
  variants: number
  selectedScore: number | null
}

export async function generateThumbnails(projectId: string, format: '16:9' | '9:16' | '1:1'): Promise<ThumbnailResult> {
  const { data: project } = await db.from('video_projects').select('title, topic, niche').eq('id', projectId).single()
  const title = (project?.title || project?.topic || '').slice(0, 60)
  const niche = (project?.niche as string | null) ?? ''

  const { data: scenes } = await db.from('video_scenes')
    .select('visual_intent, selected_asset_id').eq('project_id', projectId)
    .not('selected_asset_id', 'is', null).order('idx')
  const withAssets = scenes ?? []
  if (withAssets.length === 0) return { blockedReason: THUMB_GATE_NO_VISUALS, variants: 0, selectedScore: null }

  // 3 fundamenteel verschillende concepten (hero/authority/curiosity), elk op een eigen scene-asset.
  const concepts = await designThumbnailConcepts(title, project?.topic ?? title, niche)
  const work = path.join(os.tmpdir(), `cf2-thumb-${projectId}`)
  fs.mkdirSync(work, { recursive: true })

  const created: { label: string; score: number }[] = []
  for (let i = 0; i < concepts.length; i++) {
    const concept = concepts[i]
    const sc = withAssets[i % withAssets.length]
    const { data: asset } = await db.from('visual_assets').select('local_asset_url').eq('id', sc.selected_asset_id).single()
    const src = asset?.local_asset_url
    if (!src || !fs.existsSync(src)) continue   // geen frame-bron → variant overslaan, NOOIT fake
    const imgPath = path.join(work, `thumb-${concept.label}.png`)
    try { await renderVariantImage(src, imgPath, format, concept.overlay, concept.composition) } catch { continue }
    const cs = await scoreConcept(concept, sc.visual_intent || '')
    await db.from('thumbnail_variants').insert({
      project_id: projectId, variant: concept.label, image_url: imgPath,
      ctr_prediction: cs.ctr, curiosity_score: cs.curiosity, contrast_score: cs.contrast,
      emotional_trigger_score: cs.emotional, authority_score: cs.authority,
      readability_score: cs.readability,
      face_focus_score: concept.composition === 'face' ? cs.subject_focus : null,
      object_focus_score: concept.composition === 'object' ? cs.subject_focus : null,
      thumbnail_score: cs.thumbnail_score, chosen: false,
    })
    created.push({ label: concept.label, score: cs.thumbnail_score })
  }

  if (created.length === 0) return { blockedReason: THUMB_GATE_NO_VISUALS, variants: 0, selectedScore: null }

  created.sort((a, b) => b.score - a.score)
  const best = created[0]
  if (best.score >= THUMB_MIN_SCORE) {
    await db.from('thumbnail_variants').update({ chosen: true }).eq('project_id', projectId).eq('variant', best.label)
  }
  return { blockedReason: null, variants: created.length, selectedScore: best.score }
}
