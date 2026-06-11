import 'dotenv/config'
import ffmpeg from 'fluent-ffmpeg'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { createClient } from '@supabase/supabase-js'
import { hasDrawtext } from './ffmpeg-caps'

/**
 * RENDER ENGINE (Content Factory 2.0 — FASE B).
 *
 * Bouwt op de bestaande FFmpeg-infra (fluent-ffmpeg, zoals content-worker).
 * Pipeline: scenes → assets → voice → captions → transitions → music → final.
 * Output 16:9 én 9:16. Produceert één renderbaar videobestand — UPLOADT NIET en
 * raakt youtube_upload_queue niet aan. Zet alleen render_url op video_projects.
 */

const db = createClient(
  (process.env.SUPABASE_URL ?? 'http://preflight.invalid'),
  (process.env.SUPABASE_SERVICE_ROLE_KEY ?? 'preflight'),
  { auth: { persistSession: false } },
)

const CAPTION_FONT = process.env.CAPTION_FONT || '/System/Library/Fonts/Supplemental/Arial Bold.ttf'

function dims(format: '16:9' | '9:16' | '1:1'): { w: number; h: number } {
  if (format === '9:16') return { w: 1080, h: 1920 }
  if (format === '1:1')  return { w: 1080, h: 1080 }
  return { w: 1920, h: 1080 }
}

/** drawtext-veilige escape. */
function esc(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/:/g, '\\:').replace(/'/g, "’").replace(/%/g, '\\%')
}

/** Eén scene-clip: trim → scale/crop naar formaat → optionele caption-overlay. */
function processScene(inputPath: string, outputPath: string, durationSec: number, format: '16:9' | '9:16' | '1:1', caption: string): Promise<void> {
  const { w, h } = dims(format)
  // force_original_aspect_ratio=increase → bron dekt altijd w×h (ook 2160x4096 / afwijkende
  // aspect), dan center-crop. Voorkomt 'crop groter dan bron' (ffmpeg code 234).
  const filters = [`scale=${w}:${h}:force_original_aspect_ratio=increase`, `crop=${w}:${h}`]
  if (caption && fs.existsSync(CAPTION_FONT) && hasDrawtext()) {
    filters.push(
      `drawtext=fontfile='${CAPTION_FONT}':text='${esc(caption)}':fontcolor=white:fontsize=48:` +
      `box=1:boxcolor=black@0.5:boxborderw=16:x=(w-text_w)/2:y=h-(h/6)`,
    )
  }
  fs.mkdirSync(path.dirname(outputPath), { recursive: true })
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .inputOptions([`-t ${Math.max(1, durationSec)}`])
      .videoFilter(filters)
      .outputOptions(['-an', '-c:v libx264', '-preset fast', '-crf 23', '-pix_fmt yuv420p', '-r 30', '-movflags +faststart'])
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

/** Mux voice (+ optionele muziek met ducking) op de videotrack; loudnorm; -shortest. */
function muxAudio(videoPath: string, voicePath: string, musicPath: string | null, brandingLogo: string | null, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const cmd = ffmpeg(videoPath).input(voicePath)
    const filters: string[] = []
    let videoLabel = '0:v'
    if (musicPath) {
      cmd.input(musicPath)
      // voice (1) full, music (2) gedempt → amix → loudnorm
      filters.push('[2:a]volume=0.18[bg]', '[1:a][bg]amix=inputs=2:duration=first:dropout_transition=2[mixraw]', '[mixraw]loudnorm=I=-16:TP=-1.5:LRA=11[aout]')
    } else {
      filters.push('[1:a]loudnorm=I=-16:TP=-1.5:LRA=11[aout]')
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
  const { data: scenes } = await db.from('video_scenes')
    .select('id, idx, caption_text, expected_duration, selected_asset_id')
    .eq('project_id', input.projectId).order('idx')
  const list = scenes ?? []
  if (list.length === 0) throw new Error('renderProject: geen scenes')

  const work = path.join(os.tmpdir(), `cf2-render-${input.projectId}`)
  fs.mkdirSync(work, { recursive: true })

  const clips: string[] = []
  for (const sc of list) {
    if (!sc.selected_asset_id) continue
    const { data: asset } = await db.from('visual_assets').select('local_asset_url').eq('id', sc.selected_asset_id).single()
    const src = asset?.local_asset_url
    if (!src || !fs.existsSync(src)) continue   // geen asset → scene overslaan, NOOIT fake invullen
    const clip = path.join(work, `scene-${sc.idx}.mp4`)
    // één kapotte bron mag de hele render niet doden — sla die scene over (geen fake-invulling).
    try {
      await processScene(src, clip, Number(sc.expected_duration) || 5, input.format, sc.caption_text || '')
      if (fs.existsSync(clip)) clips.push(clip)
    } catch (e: any) {
      console.warn(`scene ${sc.idx} overgeslagen (clip-fout): ${(e?.message ?? e).toString().slice(0, 160)}`)
    }
  }
  if (clips.length === 0) throw new Error('renderProject: geen renderbare scenes (alle clip-bronnen faalden)')

  const concatPath = path.join(work, 'concat.mp4')
  await concatScenes(clips, concatPath)

  const outputPath = path.join(work, `final-${input.format.replace(':', 'x')}.mp4`)
  await muxAudio(concatPath, input.voicePath, input.musicPath ?? null, input.brandingLogo ?? null, outputPath)

  // render-metadata op project (geen status-wijziging → upload blijft onmogelijk)
  await db.from('video_projects').update({ render_url: outputPath }).eq('id', input.projectId)

  return { outputPath, sceneCount: list.length, renderedScenes: clips.length }
}
