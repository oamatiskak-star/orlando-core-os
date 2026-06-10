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

export async function generateTTS(
  text:       string,
  outputPath: string,
  voice:      string = 'nl-NL-ColetteNeural',
): Promise<void> {
  // Schrijf script naar temp bestand (voorkomt shell-escape issues)
  const tmpScript = outputPath + '.script.txt'
  fs.writeFileSync(tmpScript, text, 'utf8')
  const cleanup = () => { try { fs.unlinkSync(tmpScript) } catch { /* */ } }

  // 1) edge-tts (absoluut pad — geen PATH-afhankelijkheid)
  const edgeBin = resolveBin('edge-tts', 'EDGE_TTS_BIN')
  if (edgeBin) {
    const r = spawnSync(edgeBin, ['--voice', voice, '--file', tmpScript, '--write-media', outputPath],
      { timeout: 60_000, encoding: 'utf8', env: spawnEnv() })
    if (r.status === 0 && fs.existsSync(outputPath)) { cleanup(); return }
    // edge-tts gevonden maar faalde → toon de echte reden (geen stille espeak-misleiding)
    console.warn(`edge-tts faalde (status=${r.status}): ${(r.stderr || r.error?.message || '').toString().slice(0, 300)}`)
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
