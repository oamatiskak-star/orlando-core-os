import fs from 'fs'
import os from 'os'
import path from 'path'
import { spawnSync, execFileSync } from 'child_process'
import { resolveBin } from './tts'

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
}

/** True als het Remotion-project bruikbaar is (project + node_modules aanwezig). */
export function remotionAvailable(): boolean {
  return fs.existsSync(path.join(REMO, 'src', 'index.ts')) && fs.existsSync(path.join(REMO, 'node_modules', '.bin', 'remotion'))
}

/** Rendert de explainer en geeft het output-mp4-pad terug. Gooit bij fout. */
export function renderRemotionExplainer(input: RemotionInput): string {
  if (!remotionAvailable()) throw new Error('remotion_not_available')
  if (!fs.existsSync(input.voicePath)) throw new Error('voice ontbreekt')
  const captions = input.srtPath && fs.existsSync(input.srtPath) ? srtToCaptions(input.srtPath) : []

  const audioName = `voice-${input.projectId}.mp3`
  const publicDir = path.join(REMO, 'public')
  fs.mkdirSync(publicDir, { recursive: true })
  fs.copyFileSync(input.voicePath, path.join(publicDir, audioName))

  const props = {
    title: input.title || 'Explainer',
    brand: input.brand || '#0b1f3a',
    accent: input.accent || '#C8102E',
    audioSrc: audioName,
    audioDurationSec: probeDur(input.voicePath),
    outro: input.outro || '',
    captions,
  }
  const propsPath = path.join(REMO, `props-${input.projectId}.json`)
  fs.writeFileSync(propsPath, JSON.stringify(props))

  const out = path.join(os.tmpdir(), `cf2-remotion-${input.projectId}.mp4`)
  const npx = resolveBin('npx', 'NPX_BIN') || 'npx'
  const r = spawnSync(npx, ['remotion', 'render', 'src/index.ts', 'Explainer', out, `--props=${propsPath}`, '--concurrency=4', '--log=error'],
    { cwd: REMO, encoding: 'utf8', timeout: 1_200_000 })

  // opruimen (per-project artefacten)
  try { fs.unlinkSync(path.join(publicDir, audioName)) } catch { /* */ }
  try { fs.unlinkSync(propsPath) } catch { /* */ }

  if (r.status !== 0 || !fs.existsSync(out)) {
    throw new Error(`remotion render faalde (status=${r.status}): ${(r.stderr || '').toString().slice(0, 200)}`)
  }
  return out
}
