import { execSync, spawnSync } from 'child_process'
import fs from 'fs'
import path from 'path'

/**
 * Genereert TTS audio via edge-tts (Python package).
 * Installeer eenmalig: pip install edge-tts
 * Nederlandse stemmen: nl-NL-ColetteNeural, nl-NL-MaartjeNeural
 * Engelse stem: en-US-JennyNeural
 */
export async function generateTTS(
  text:       string,
  outputPath: string,
  voice:      string = 'nl-NL-ColetteNeural',
): Promise<void> {
  // Schrijf script naar temp bestand (voorkomt shell-escape issues)
  const tmpScript = outputPath + '.script.txt'
  fs.writeFileSync(tmpScript, text, 'utf8')

  // Probeer edge-tts
  const edgeTts = spawnSync('edge-tts', [
    '--voice', voice,
    '--file',  tmpScript,
    '--write-media', outputPath,
  ], { timeout: 60_000, encoding: 'utf8' })

  fs.unlinkSync(tmpScript)

  if (edgeTts.status === 0) return

  // Fallback: espeak (op Linux, robotisch maar werkt altijd)
  console.warn('edge-tts niet gevonden, fallback naar espeak')
  const langCode = voice.startsWith('nl') ? 'nl' : 'en'
  const espeak = spawnSync('espeak', [
    '-v', langCode, '-f', '-', '-w', outputPath,
  ], {
    input: text,
    timeout: 60_000,
    encoding: 'utf8',
  })

  if (espeak.status !== 0) {
    throw new Error(`TTS mislukt: ${espeak.stderr}`)
  }
}

export function edgeTtsAvailable(): boolean {
  try {
    execSync('edge-tts --version', { stdio: 'ignore', timeout: 5000 })
    return true
  } catch {
    return false
  }
}
