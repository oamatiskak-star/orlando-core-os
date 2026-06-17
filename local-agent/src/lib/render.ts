import 'dotenv/config'
import ffmpeg from 'fluent-ffmpeg'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { spawnSync } from 'child_process'
import { createClient } from '@supabase/supabase-js'
import { hasDrawtext } from './ffmpeg-caps'
import { wrapCaptionLines } from './script-clean'

/**
 * RENDER ENGINE (Content Factory 2.0 — FASE B + News-Desk anchor).
 *
 * Bouwt op de bestaande FFmpeg-infra (fluent-ffmpeg, zoals content-worker).
 * Pipeline: scenes → assets → voice → captions → transitions → music → final.
 * Output 16:9 én 9:16. Produceert één renderbaar videobestand — UPLOADT NIET en
 * raakt youtube_upload_queue niet aan. Zet alleen render_url op video_projects.
 *
 * VISUELE LAAG (news-presentator): per scene een consistente "news-desk" overlay —
 * een titelbalk bovenin (kanaal/onderwerp), een grote leesbare lower-third caption
 * met WAT DE STEM ZEGT, en een accentbalk. Charts/b-roll blijven het achtergrond-
 * beeld (chart-cutaways op data-beats komen uit chart-intelligence). Optioneel een
 * subtiele audio-waveform onderin (CF2_WAVEFORM=1).
 */

const db = createClient(
  (process.env.SUPABASE_URL ?? 'http://preflight.invalid'),
  (process.env.SUPABASE_SERVICE_ROLE_KEY ?? 'preflight'),
  { auth: { persistSession: false } },
)

const CAPTION_FONT = process.env.CAPTION_FONT || '/System/Library/Fonts/Supplemental/Arial Bold.ttf'
// News-accent (balken). Override via env; ffmpeg-kleur als 0xRRGGBB.
const ACCENT = process.env.CAPTION_ACCENT || '0xC8102E'
const WAVEFORM = process.env.CF2_WAVEFORM === '1'

/** Mediaduur in seconden via ffprobe (0 bij fout → caller slaat scaling over). */
function probeDuration(filePath: string): number {
  try {
    const bin = (process.env.FFPROBE_BIN && fs.existsSync(process.env.FFPROBE_BIN)) ? process.env.FFPROBE_BIN : 'ffprobe'
    const r = spawnSync(bin, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', filePath],
      { encoding: 'utf8', timeout: 30_000 })
    const d = parseFloat((r.stdout || '').trim())
    return Number.isFinite(d) && d > 0 ? d : 0
  } catch { return 0 }
}

function dims(format: '16:9' | '9:16' | '1:1'): { w: number; h: number } {
  if (format === '9:16') return { w: 1080, h: 1920 }
  if (format === '1:1')  return { w: 1080, h: 1080 }
  return { w: 1920, h: 1080 }
}

/** drawtext-veilige escape. We renderen met expansion=none, dus '%' is letterlijk
 *  (NIET escapen — anders verschijnt '\%'). Alleen backslash, ':' (optie-scheider) en
 *  enkele quote moeten op filter-arg-niveau worden afgevangen. */
function esc(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/:/g, '\\:').replace(/'/g, "’")
}

/** Format-afhankelijke caption-/titel-styling voor de news-desk overlay. */
function styleFor(format: '16:9' | '9:16' | '1:1') {
  if (format === '9:16') return { capFS: 56, capChars: 24, capLines: 3, titleFS: 40, titleChars: 26 }
  if (format === '1:1')  return { capFS: 48, capChars: 28, capLines: 3, titleFS: 36, titleChars: 34 }
  return { capFS: 54, capChars: 40, capLines: 3, titleFS: 38, titleChars: 64 }
}

/** libass force_style voor de gebrande SRT (news lower-third: wit, vet, halftransp. box).
 *  FontSize/MarginV format-afhankelijk; box (BorderStyle=3) verschijnt alleen bij tekst. */
function subtitleForceStyle(format: '16:9' | '9:16' | '1:1'): string {
  const fontName = (process.env.CAPTION_FONT_NAME || 'Arial').replace(/[,']/g, '')
  // Iets kleiner → het laatste woord van een cue past op één regel (kwam anders te laat/krap).
  const s = format === '9:16'
    ? { fs: 13, mv: 235 }
    : format === '1:1'
      ? { fs: 16, mv: 70 }
      : { fs: 18, mv: 64 }
  // Kleuren in libass-formaat &HAABBGGRR. Box = halftransparant zwart, tekst wit.
  return [
    `FontName=${fontName}`,
    `FontSize=${s.fs}`,
    'PrimaryColour=&H00FFFFFF',
    'OutlineColour=&H00000000',
    'BackColour=&H66000000',
    'BorderStyle=3', 'Outline=1', 'Shadow=0',
    'Bold=1', 'Alignment=2', `MarginV=${s.mv}`,
  ].join(',')
}

/** Pad-escape voor het subtitles-filter (filter-arg-niveau: \, ', : afvangen). */
function escSubPath(p: string): string {
  return p.replace(/\\/g, '\\\\').replace(/:/g, '\\:').replace(/'/g, "\\'")
}

/**
 * Bouwt de news-desk drawtext/drawbox-filters: titelbalk + accent bovenin, en een
 * lower-third caption-band met de gesproken tekst. Leeg → geen overlay (degradeert
 * netjes als drawtext ontbreekt; de caller checkt hasDrawtext()).
 */
function newsOverlayFilters(format: '16:9' | '9:16' | '1:1', caption: string, title: string): string[] {
  const { w, h } = dims(format)
  const st = styleFor(format)
  const out: string[] = []
  const font = `fontfile='${CAPTION_FONT}'`

  // ── Titelbalk bovenin (news banner) ──────────────────────────────────────
  if (title && title.trim()) {
    const tline = wrapCaptionLines(title, st.titleChars, 1)[0] || ''
    const barH = Math.round(st.titleFS * 1.9)
    if (tline) {
      out.push(`drawbox=x=0:y=0:w=${w}:h=${barH}:color=black@0.78:t=fill`)
      out.push(`drawbox=x=0:y=${barH}:w=${w}:h=6:color=${ACCENT}:t=fill`)
      out.push(`drawtext=${font}:text='${esc(tline)}':fontcolor=white:fontsize=${st.titleFS}:x=44:y=${Math.round((barH - st.titleFS) / 2)}:expansion=none`)
    }
  }

  // ── Lower-third caption-band (wat de stem zegt) ──────────────────────────
  const lines = wrapCaptionLines(caption || '', st.capChars, st.capLines)
  if (lines.length) {
    const lineH = Math.round(st.capFS * 1.5)
    const pad = Math.round(st.capFS * 0.45)
    const blockH = lines.length * lineH
    const bottomMargin = Math.round(h / 11)
    const blockTop = h - bottomMargin - blockH
    // accentstreep + halfdoorzichtige band achter de tekst
    out.push(`drawbox=x=0:y=${blockTop - pad - 6}:w=${w}:h=6:color=${ACCENT}:t=fill`)
    out.push(`drawbox=x=0:y=${blockTop - pad}:w=${w}:h=${blockH + pad * 2}:color=black@0.66:t=fill`)
    lines.forEach((ln, i) => {
      const y = blockTop + i * lineH
      out.push(`drawtext=${font}:text='${esc(ln)}':fontcolor=white:fontsize=${st.capFS}:x=(w-text_w)/2:y=${y}:expansion=none`)
    })
  }
  return out
}

/** Eén scene-clip: trim → scale/crop naar formaat → news-desk overlay (titel + caption).
 *  zoom = 1 → ongewijzigd (legacy). zoom > 1 → center punch-in voor retentie-pacing
 *  (per-scene variatie geeft een 'cut'-ritme; statische lange scenes = retentie-cliff). */
function processScene(inputPath: string, outputPath: string, durationSec: number, format: '16:9' | '9:16' | '1:1', caption: string, title: string, zoom = 1): Promise<void> {
  const { w, h } = dims(format)
  const zw = Math.round(w * zoom), zh = Math.round(h * zoom)
  // force_original_aspect_ratio=increase → bron dekt altijd zw×zh (ook 2160x4096 / afwijkende
  // aspect), dan center-crop naar w×h. Voorkomt 'crop groter dan bron' (ffmpeg code 234).
  const filters = [`scale=${zw}:${zh}:force_original_aspect_ratio=increase`, `crop=${w}:${h}`]
  if (fs.existsSync(CAPTION_FONT) && hasDrawtext()) {
    filters.push(...newsOverlayFilters(format, caption, title))
  }
  fs.mkdirSync(path.dirname(outputPath), { recursive: true })
  const dur = Math.max(1, durationSec)
  // Stilstaande beelden (charts/foto's) → -loop 1 zodat het een clip van `dur` sec wordt
  // i.p.v. één frame (de chart-render bug). Video's → -stream_loop -1 zodat een korte clip
  // het volledige (mogelijk opgerekte) slot vult i.p.v. vroegtijdig te eindigen → anders
  // wordt de totale beeldduur < voicelengte en kapt -shortest de narratie af.
  const isImage = /\.(png|jpe?g|webp|bmp|gif)$/i.test(inputPath)
  const inOpts = isImage ? ['-loop 1', `-t ${dur}`] : ['-stream_loop -1', `-t ${dur}`]
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .inputOptions(inOpts)
      .videoFilter(filters)
      .outputOptions(['-an', '-c:v libx264', '-preset fast', '-crf 23', '-pix_fmt yuv420p', '-r 30', `-t ${dur}`, '-movflags +faststart'])
      .output(outputPath)
      .on('end', () => resolve())
      .on('error', (e) => reject(new Error(`scene-render: ${e.message}`)))
      .run()
  })
}

/** Concat de scene-clips (concat-demuxer). */
function concatScenes(clipPaths: string[], outputPath: string): Promise<void> {
  const listFile = outputPath + '.concat.txt'
  fs.writeFileSync(listFile, clipPaths.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join('\n'))
  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(listFile).inputOptions(['-f concat', '-safe 0'])
      .outputOptions(['-c:v libx264', '-preset fast', '-crf 23', '-pix_fmt yuv420p', '-r 30', '-movflags +faststart'])
      .output(outputPath)
      .on('end', () => { try { fs.unlinkSync(listFile) } catch { /* */ } ; resolve() })
      .on('error', (e) => reject(new Error(`concat: ${e.message}`)))
      .run()
  })
}

/** Mux voice (+ optionele muziek met ducking) op de videotrack; loudnorm; -shortest.
 *  Optioneel (CF2_WAVEFORM=1): een subtiele audio-waveform onderin als 'levend' news-element. */
function muxAudio(videoPath: string, voicePath: string, musicPath: string | null, brandingLogo: string | null, outputPath: string, format: '16:9' | '9:16' | '1:1', subtitlePath: string | null): Promise<void> {
  return new Promise((resolve, reject) => {
    const cmd = ffmpeg(videoPath).input(voicePath)
    const filters: string[] = []
    let videoLabel = '0:v'

    // Synchrone ondertiteling (whisper-SRT) in beeld branden — tijdstempels uit de stem,
    // dus woord-accuraat en gap-loos (vervangt de losgelopen statische per-scene caption).
    if (subtitlePath && fs.existsSync(subtitlePath) && hasDrawtext()) {
      filters.push(`[0:v]subtitles='${escSubPath(subtitlePath)}':force_style='${subtitleForceStyle(format)}'[vsub]`)
      videoLabel = 'vsub'
    }

    // Voice eventueel splitsen: één tak naar de audiomix, één tak naar de waveform-visual.
    let voiceLabel = '1:a'
    if (WAVEFORM) {
      filters.push('[1:a]asplit=2[avmix][avwave]')
      voiceLabel = 'avmix'
    }
    if (musicPath) {
      cmd.input(musicPath)
      // voice full, music (2) gedempt → amix → loudnorm
      filters.push('[2:a]volume=0.18[bg]', `[${voiceLabel}][bg]amix=inputs=2:duration=first:dropout_transition=2[mixraw]`, '[mixraw]loudnorm=I=-16:TP=-1.5:LRA=11[aout]')
    } else {
      filters.push(`[${voiceLabel}]loudnorm=I=-16:TP=-1.5:LRA=11[aout]`)
    }
    if (WAVEFORM) {
      const { w, h } = dims(format)
      const waveH = Math.round(h / 16)
      filters.push(`[avwave]showwaves=s=${w}x${waveH}:mode=cline:rate=30:colors=white@0.55[wavesraw]`)
      filters.push(`[${videoLabel}][wavesraw]overlay=0:H-h[vwave]`)
      videoLabel = 'vwave'
    }
    if (brandingLogo && fs.existsSync(brandingLogo)) {
      const logoIdx = musicPath ? 3 : 2
      cmd.input(brandingLogo)
      filters.push(`[${videoLabel}][${logoIdx}:v]overlay=W-w-40:40[vout]`)
      videoLabel = 'vout'
    }
    cmd.complexFilter(filters)
      .outputOptions([
        `-map ${videoLabel.includes(':') ? videoLabel : '[' + videoLabel + ']'}`,
        '-map [aout]', '-c:v libx264', '-preset fast', '-crf 23', '-pix_fmt yuv420p',
        '-c:a aac', '-b:a 192k', '-shortest', '-movflags +faststart',
      ])
      .output(outputPath)
      .on('end', () => resolve())
      .on('error', (e) => reject(new Error(`mux: ${e.message}`)))
      .run()
  })
}

export interface RenderInput {
  projectId: string
  format: '16:9' | '9:16' | '1:1'
  voicePath: string
  musicPath?: string | null
  brandingLogo?: string | null
  pacing?: boolean   // retentie-pacing (per-scene punch-in). Default false = legacy ongewijzigd.
  subtitlePath?: string | null   // whisper-SRT → synchrone gebrande captions. Null → legacy per-scene caption.
}
export interface RenderResult {
  outputPath: string
  sceneCount: number
  renderedScenes: number
}

/**
 * Rendert het volledige project naar één bestand. Vereist dat alle scenes een
 * selected_asset met lokaal bestand hebben (Visual Intelligence FASE A) en een
 * voice-track. Gooit als er geen renderbare scenes zijn — produceert NOOIT
 * iets met ontbrekende/fake assets.
 */
export async function renderProject(input: RenderInput): Promise<RenderResult> {
  // Titel voor de news-desk titelbalk (consistent over alle scenes).
  const { data: project } = await db.from('video_projects').select('title').eq('id', input.projectId).single()
  const title = (project?.title as string | null) ?? ''

  const { data: scenes } = await db.from('video_scenes')
    .select('id, idx, caption_text, expected_duration, selected_asset_id')
    .eq('project_id', input.projectId).order('idx')
  const list = scenes ?? []
  if (list.length === 0) throw new Error('renderProject: geen scenes')

  // Synchrone gebrande SRT? Dan GEEN statische per-scene caption meer (anders dubbel).
  // Zonder SRT valt het terug op de legacy per-scene caption (beter iets dan niets).
  const useSubs = !!input.subtitlePath && fs.existsSync(input.subtitlePath)

  const work = path.join(os.tmpdir(), `cf2-render-${input.projectId}`)
  fs.mkdirSync(work, { recursive: true })

  // Pass 1 — renderbare scenes verzamelen (echte assets op schijf; NOOIT fake invullen).
  const renderable: { sc: typeof list[number]; src: string }[] = []
  for (const sc of list) {
    if (!sc.selected_asset_id) continue
    const { data: asset } = await db.from('visual_assets').select('local_asset_url').eq('id', sc.selected_asset_id).single()
    const src = asset?.local_asset_url
    if (!src || !fs.existsSync(src)) continue
    renderable.push({ sc, src })
  }
  if (renderable.length === 0) throw new Error('renderProject: geen renderbare scenes (alle clip-bronnen faalden)')

  // Beeldduur schalen naar de ÉCHTE voicelengte → -shortest kapt de narratie niet meer af
  // (scene-schattingen ≠ TTS-duur). Elke scene houdt zijn beeld evenredig langer vast; de
  // ondertiteling blijft synchroon want die komt los uit de stem. Clamp tegen extremen.
  const voiceDur = probeDuration(input.voicePath)
  const expectedTotal = renderable.reduce((a, r) => a + (Number(r.sc.expected_duration) || 5), 0)
  const scale = (voiceDur > 0 && expectedTotal > 0) ? Math.min(4, Math.max(0.5, voiceDur / expectedTotal)) : 1
  const durations = renderable.map((r) => Math.max(1, (Number(r.sc.expected_duration) || 5) * scale))
  // rondingsrest op de laatste scene zodat totaal >= voicelengte (volledige narratie in beeld).
  if (voiceDur > 0) {
    const sum = durations.reduce((a, b) => a + b, 0)
    if (sum < voiceDur) durations[durations.length - 1] += (voiceDur - sum) + 0.3
  }
  console.log(`render: voice=${voiceDur.toFixed(1)}s · scenes=${renderable.length} · scale=${scale.toFixed(2)}`)

  // Pass 2 — clips renderen. Eén kapotte bron mag de hele render niet doden (scene overslaan).
  const clips: string[] = []
  for (let i = 0; i < renderable.length; i++) {
    const { sc, src } = renderable[i]
    const clip = path.join(work, `scene-${sc.idx}.mp4`)
    // Retentie-pacing: per-scene punch-in (1.06/1.10/1.14) geeft een cut-ritme. Alleen als
    // input.pacing aan staat (format-profiel); anders zoom=1 → identiek aan legacy.
    const zoom = input.pacing ? 1.06 + ((Number(sc.idx) || 0) % 3) * 0.04 : 1
    try {
      const sceneCaption = useSubs ? '' : (sc.caption_text || '')
      await processScene(src, clip, durations[i], input.format, sceneCaption, title, zoom)
      if (fs.existsSync(clip)) clips.push(clip)
    } catch (e: any) {
      console.warn(`scene ${sc.idx} overgeslagen (clip-fout): ${(e?.message ?? e).toString().slice(0, 160)}`)
    }
  }
  if (clips.length === 0) throw new Error('renderProject: geen renderbare scenes (alle clip-bronnen faalden)')

  const concatPath = path.join(work, 'concat.mp4')
  await concatScenes(clips, concatPath)

  const outputPath = path.join(work, `final-${input.format.replace(':', 'x')}.mp4`)
  await muxAudio(concatPath, input.voicePath, input.musicPath ?? null, input.brandingLogo ?? null, outputPath, input.format, useSubs ? input.subtitlePath! : null)

  // render-metadata op project (geen status-wijziging → upload blijft onmogelijk)
  await db.from('video_projects').update({ render_url: outputPath }).eq('id', input.projectId)

  return { outputPath, sceneCount: list.length, renderedScenes: clips.length }
}
