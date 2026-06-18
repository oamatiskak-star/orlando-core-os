import fs from 'fs'
import os from 'os'
import path from 'path'
import { spawnSync, execFileSync } from 'child_process'
import { createClient } from '@supabase/supabase-js'
import { resolveBin } from './tts'

const db = createClient(
  (process.env.SUPABASE_URL ?? 'http://preflight.invalid'),
  (process.env.SUPABASE_SERVICE_ROLE_KEY ?? 'preflight'),
  { auth: { persistSession: false } },
)

/**
 * REMOTION-RENDER (Route A — high-end code-driven explainer).
 *
 * Rendert een branded motion-graphic explainer (intro + bewegende gradient + kinetische
 * captions gesynct met de stem + outro) uit een voicetrack + whisper-SRT, via het
 * Remotion-project in local-agent/remotion. Geen stock/GPU/API — draait op de M2.
 * Concurrency-veilig: per-project audio/props-bestanden.
 */

const REMO = process.env.REMOTION_DIR || path.resolve(__dirname, '../../remotion')

function toSec(t: string): number {
  const m = t.trim().match(/(\d+):(\d+):(\d+)[,.](\d+)/)
  return m ? (+m[1]) * 3600 + (+m[2]) * 60 + (+m[3]) + (+m[4]) / 1000 : 0
}

function srtToCaptions(srtPath: string): { from: number; to: number; text: string }[] {
  const raw = fs.readFileSync(srtPath, 'utf8').replace(/\r/g, '')
  const caps: { from: number; to: number; text: string }[] = []
  for (const block of raw.split(/\n\n+/)) {
    const lines = block.split('\n').filter(Boolean)
    const tl = lines.find((l) => l.includes('-->'))
    if (!tl) continue
    const [a, b] = tl.split('-->')
    const text = lines.slice(lines.indexOf(tl) + 1).join(' ').trim()
    if (text) caps.push({ from: toSec(a), to: toSec(b), text })
  }
  return caps
}

function probeDur(f: string): number {
  try {
    const bin = (process.env.FFPROBE_BIN && fs.existsSync(process.env.FFPROBE_BIN)) ? process.env.FFPROBE_BIN : 'ffprobe'
    const o = execFileSync(bin, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', f], { encoding: 'utf8' })
    const d = parseFloat(o.trim()); return Number.isFinite(d) && d > 0 ? d : 10
  } catch { return 10 }
}

export interface RemotionInput {
  projectId: string
  voicePath: string
  srtPath: string | null
  title: string
  brand?: string
  accent?: string
  outro?: string
  stats?: { value: string; label: string }[]   // → tijd-gespreide data-animaties in de body
}

/** Verdeelt de stats over de body (na de intro, vóór de outro), elk ~3.5s in beeld. */
function statsToBeats(stats: { value: string; label: string }[], dur: number): { value: string; label: string; from: number; to: number }[] {
  const list = (stats || []).filter((s) => s && s.value)
  if (!list.length || dur < 6) return []
  const start = 2.0, end = Math.max(start + 2, dur - 2.0)
  const span = (end - start) / list.length
  const win = Math.min(3.5, span * 0.9)
  return list.map((s, i) => ({ value: s.value, label: s.label, from: +(start + i * span).toFixed(2), to: +(start + i * span + win).toFixed(2) }))
}

/** True als het Remotion-project bruikbaar is (project + node_modules aanwezig). */
export function remotionAvailable(): boolean {
  return fs.existsSync(path.join(REMO, 'src', 'index.ts')) && fs.existsSync(path.join(REMO, 'node_modules', '.bin', 'remotion'))
}

const IMG_RE = /\.(png|jpe?g|webp|bmp|gif)$/i

/** Haalt de gesourcete scene-visuals op, schaalt hun duur naar de voicelengte en kopieert ze
 *  naar public/ → content-achtergrond in de render. Geeft [] als er geen assets zijn. */
async function buildSceneBackground(projectId: string, voiceDur: number, assetDir: string): Promise<{ src: string; from: number; to: number; isVideo: boolean }[]> {
  const { data: scenes } = await db.from('video_scenes')
    .select('idx, expected_duration, selected_asset_id').eq('project_id', projectId).order('idx')
  const list = scenes ?? []
  const renderable: { idx: number; src: string; expected: number }[] = []
  for (const sc of list) {
    if (!sc.selected_asset_id) continue
    const { data: asset } = await db.from('visual_assets').select('local_asset_url').eq('id', sc.selected_asset_id).single()
    const src = asset?.local_asset_url
    if (src && fs.existsSync(src)) renderable.push({ idx: Number(sc.idx) || renderable.length, src, expected: Number(sc.expected_duration) || 5 })
  }
  if (!renderable.length) return []

  const sumExp = renderable.reduce((a, r) => a + r.expected, 0)
  const scale = sumExp > 0 ? voiceDur / sumExp : 1
  fs.mkdirSync(assetDir, { recursive: true })
  const out: { src: string; from: number; to: number; isVideo: boolean }[] = []
  let cursor = 0
  for (let i = 0; i < renderable.length; i++) {
    const r = renderable[i]
    const dur = Math.max(0.8, r.expected * scale)
    const ext = path.extname(r.src) || '.mp4'
    const name = `sc-${projectId}/${i}${ext}`            // staticFile-pad (relatief t.o.v. public/)
    fs.copyFileSync(r.src, path.join(assetDir, `${i}${ext}`)) // assetDir == public/sc-<pid>
    out.push({ src: name, from: +cursor.toFixed(2), to: +(cursor + dur).toFixed(2), isVideo: !IMG_RE.test(r.src) })
    cursor += dur
  }
  // laatste scene rekt tot het einde (geen zwart gat door rondingsrest)
  if (out.length && cursor < voiceDur) out[out.length - 1].to = +voiceDur.toFixed(2)
  return out
}

/** Rendert de explainer en geeft het output-mp4-pad terug. Gooit bij fout. */
export async function renderRemotionExplainer(input: RemotionInput): Promise<string> {
  if (!remotionAvailable()) throw new Error('remotion_not_available')
  if (!fs.existsSync(input.voicePath)) throw new Error('voice ontbreekt')
  const captions = input.srtPath && fs.existsSync(input.srtPath) ? srtToCaptions(input.srtPath) : []

  const audioName = `voice-${input.projectId}.mp3`
  const publicDir = path.join(REMO, 'public')
  fs.mkdirSync(publicDir, { recursive: true })
  fs.copyFileSync(input.voicePath, path.join(publicDir, audioName))

  const durSec = probeDur(input.voicePath)
  const sceneDir = path.join(publicDir, `sc-${input.projectId}`)
  let scenes: { src: string; from: number; to: number; isVideo: boolean }[] = []
  try { scenes = await buildSceneBackground(input.projectId, durSec, sceneDir) } catch { scenes = [] }

  const props = {
    title: input.title || 'Explainer',
    brand: input.brand || '#0b1f3a',
    accent: input.accent || '#C8102E',
    audioSrc: audioName,
    audioDurationSec: durSec,
    outro: input.outro || '',
    captions,
    dataBeats: statsToBeats(input.stats || [], durSec),
    scenes,
  }
  const propsPath = path.join(REMO, `props-${input.projectId}.json`)
  fs.writeFileSync(propsPath, JSON.stringify(props))

  const out = path.join(os.tmpdir(), `cf2-remotion-${input.projectId}.mp4`)
  const npx = resolveBin('npx', 'NPX_BIN') || 'npx'
  const r = spawnSync(npx, ['remotion', 'render', 'src/index.ts', 'Explainer', out, `--props=${propsPath}`, '--concurrency=4', '--log=error'],
    { cwd: REMO, encoding: 'utf8', timeout: 1_800_000 })

  // opruimen (per-project artefacten)
  try { fs.unlinkSync(path.join(publicDir, audioName)) } catch { /* */ }
  try { fs.unlinkSync(propsPath) } catch { /* */ }
  try { fs.rmSync(sceneDir, { recursive: true, force: true }) } catch { /* */ }

  if (r.status !== 0 || !fs.existsSync(out)) {
    throw new Error(`remotion render faalde (status=${r.status}): ${(r.stderr || '').toString().slice(0, 200)}`)
  }
  return out
}
