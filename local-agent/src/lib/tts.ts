import { execFileSync, spawnSync } from 'child_process'
import fs from 'fs'
import os from 'os'
import path from 'path'

/**
 * Genereert TTS audio via edge-tts (Python package), met espeak als laatste lokale fallback.
 * Installeer eenmalig: pipx install edge-tts   (of: pip install edge-tts)
 * Nederlandse stemmen: nl-NL-ColetteNeural, nl-NL-MaartjeNeural · Engels: en-US-JennyNeural
 *
 * Binaries worden robuust geresolved (env-override → PATH → gangbare dirs), zodat de
 * producer ook werkt onder een scheduler/PM2/cron waar `~/.local/bin` niet op PATH staat.
 */

const EXTRA_BIN_DIRS = [
  path.join(os.homedir(), '.local/bin'),   // pipx
  '/opt/homebrew/bin', '/usr/local/bin', '/usr/bin', '/bin',
]

/** Resolve een binary naar een absoluut pad: env-override → which (verruimde PATH) → gangbare dirs. */
export function resolveBin(name: string, envVar?: string): string | null {
  if (envVar && process.env[envVar] && fs.existsSync(process.env[envVar] as string)) return process.env[envVar] as string
  const PATH = [process.env.PATH || '', ...EXTRA_BIN_DIRS].join(':')
  const w = spawnSync('which', [name], { encoding: 'utf8', env: { ...process.env, PATH } })
  if (w.status === 0 && w.stdout.trim()) return w.stdout.trim()
  for (const dir of EXTRA_BIN_DIRS) { const p = path.join(dir, name); if (fs.existsSync(p)) return p }
  return null
}

/** Verruimde PATH voor child-processen (edge-tts roept zelf weer subprocessen aan). */
function spawnEnv(): NodeJS.ProcessEnv {
  return { ...process.env, PATH: [process.env.PATH || '', ...EXTRA_BIN_DIRS].join(':') }
}

/** Splits tekst op zin-grenzen in chunks <= maxLen. Long-form (~13k tekens) faalt anders
 *  op edge-tts (één lange request) en overschrijdt de OpenAI/ElevenLabs-limieten. */
export function chunkText(text: string, maxLen = 2200): string[] {
  const parts = text.replace(/\s+/g, ' ').trim().match(/[^.!?]+[.!?]+|\S[^.!?]*$/g) ?? [text]
  const chunks: string[] = []
  let cur = ''
  for (const s of parts) {
    if (cur && (cur.length + 1 + s.length) > maxLen) { chunks.push(cur.trim()); cur = s }
    else cur += (cur ? ' ' : '') + s
  }
  if (cur.trim()) chunks.push(cur.trim())
  return chunks
}

/** Concat meerdere mp3-chunks tot één bestand (ffmpeg concat-demuxer, -c copy). */
function concatAudio(parts: string[], outputPath: string): boolean {
  const ffmpeg = resolveBin('ffmpeg', 'FFMPEG_BIN') || 'ffmpeg'
  const listFile = outputPath + '.concat.txt'
  fs.writeFileSync(listFile, parts.map(p => `file '${p.replace(/'/g, "'\\''")}'`).join('\n'))
  const r = spawnSync(ffmpeg, ['-y', '-f', 'concat', '-safe', '0', '-i', listFile, '-c', 'copy', outputPath],
    { timeout: 120_000, encoding: 'utf8', env: spawnEnv() })
  try { fs.unlinkSync(listFile) } catch { /* */ }
  return r.status === 0 && fs.existsSync(outputPath)
}

function edgeSynthOne(edgeBin: string, voice: string, text: string, out: string): boolean {
  const tmp = out + '.script.txt'
  fs.writeFileSync(tmp, text, 'utf8')
  const r = spawnSync(edgeBin, ['--voice', voice, '--file', tmp, '--write-media', out],
    { timeout: 180_000, encoding: 'utf8', env: spawnEnv() })
  try { fs.unlinkSync(tmp) } catch { /* */ }
  if (r.status !== 0 || !fs.existsSync(out)) {
    console.warn(`edge-tts chunk faalde (status=${r.status}): ${(r.stderr || r.error?.message || '').toString().slice(0, 200)}`)
    return false
  }
  return true
}

export async function generateTTS(
  text:       string,
  outputPath: string,
  voice:      string = 'nl-NL-ColetteNeural',
): Promise<void> {
  const cleanup = () => { /* per-chunk cleanup gebeurt inline */ }

  // 1) edge-tts met chunking (long-form-veilig): splits op zinnen, synth per chunk, concat.
  const edgeBin = resolveBin('edge-tts', 'EDGE_TTS_BIN')
  if (edgeBin) {
    const chunks = chunkText(text)
    if (chunks.length <= 1) {
      if (edgeSynthOne(edgeBin, voice, text, outputPath)) { cleanup(); return }
    } else {
      const partPaths: string[] = []
      let allOk = true
      for (let i = 0; i < chunks.length; i++) {
        const part = `${outputPath}.part${i}.mp3`
        if (!edgeSynthOne(edgeBin, voice, chunks[i], part)) { allOk = false; break }
        partPaths.push(part)
      }
      if (allOk && partPaths.length && concatAudio(partPaths, outputPath)) {
        for (const p of partPaths) { try { fs.unlinkSync(p) } catch { /* */ } }
        console.log(`edge-tts: ${chunks.length} chunks ge-synth + geconcat → ${outputPath}`)
        cleanup(); return
      }
      for (const p of partPaths) { try { fs.unlinkSync(p) } catch { /* */ } }
      console.warn(`edge-tts chunked faalde (chunks=${chunks.length}) — val terug op espeak`)
    }
  } else {
    console.warn('edge-tts niet gevonden op PATH/gangbare dirs (zet EDGE_TTS_BIN of `pipx install edge-tts`)')
  }
  cleanup()

  // 2) espeak fallback (robotisch maar lokaal)
  const espeakBin = resolveBin('espeak', 'ESPEAK_BIN') || resolveBin('espeak-ng', 'ESPEAK_BIN')
  if (!espeakBin) {
    throw new Error('TTS mislukt: edge-tts noch espeak beschikbaar (pipx install edge-tts / brew install espeak)')
  }
  const langCode = voice.startsWith('nl') ? 'nl' : 'en'
  const espeak = spawnSync(espeakBin, ['-v', langCode, '-f', '-', '-w', outputPath],
    { input: text, timeout: 60_000, encoding: 'utf8', env: spawnEnv() })
  if (espeak.status !== 0 || !fs.existsSync(outputPath)) {
    throw new Error(`TTS mislukt (espeak status=${espeak.status}): ${(espeak.stderr || espeak.error?.message || 'onbekend').toString().slice(0, 300)}`)
  }
}

export function edgeTtsAvailable(): boolean {
  const bin = resolveBin('edge-tts', 'EDGE_TTS_BIN')
  if (!bin) return false
  try { execFileSync(bin, ['--version'], { stdio: 'ignore', timeout: 5000, env: spawnEnv() }); return true }
  catch { return false }
}
