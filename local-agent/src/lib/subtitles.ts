import fs from 'fs'
import os from 'os'
import path from 'path'
import { spawnSync } from 'child_process'
import { resolveBin } from './tts'

/**
 * SUBTITLES (Content Factory 2.0 — synchrone ondertiteling).
 *
 * Genereert een SRT uit de ÉCHTE voicetrack via whisper.cpp (lokaal, gratis,
 * geen API-afhankelijkheid). Tijdstempels komen uit de audio zelf → de captions
 * lopen woord-accuraat synchroon en missen geen stukken (i.t.t. de oude statische
 * caption-per-scene, die losliep van de stem).
 *
 * Lokaal-first: vereist whisper-cli (brew install whisper-cpp) + een ggml-model.
 * Geen binary/model → geeft null terug (render valt netjes terug op géén of de
 * legacy per-scene caption). Verzint NOOIT timings.
 */

const DEFAULT_MODELS = [
  process.env.WHISPER_MODEL || '',
  path.join(os.homedir(), '.cache/whisper/ggml-base.en.bin'),
  path.join(os.homedir(), '.cache/whisper/ggml-small.en.bin'),
  '/opt/homebrew/share/whisper-cpp/ggml-base.en.bin',
].filter(Boolean)

function resolveModel(): string | null {
  for (const m of DEFAULT_MODELS) { if (m && fs.existsSync(m)) return m }
  return null
}

/** whisper-cli leest WAV 16kHz mono — converteer de voice (mp3) eerst. */
function toWav16k(ffmpeg: string, inPath: string, outWav: string): boolean {
  const r = spawnSync(ffmpeg, ['-y', '-i', inPath, '-ar', '16000', '-ac', '1', '-c:a', 'pcm_s16le', outWav],
    { timeout: 120_000, encoding: 'utf8' })
  return r.status === 0 && fs.existsSync(outWav)
}

export interface SubtitleResult {
  srtPath: string | null
  reason: string | null   // gezet wanneer geen SRT (geen binary/model/transcriptie)
}

/**
 * Maakt een SRT naast `outBase` (.srt) uit `voicePath`. `language` 'en'|'nl'|'es'.
 * Korte, op-woord-gesplitste cues (max ~`maxLen` tekens) voor een vlotte news-cadans.
 */
export async function generateSubtitles(voicePath: string, outBase: string, opts: { language?: string; maxLen?: number; brand?: string } = {}): Promise<SubtitleResult> {
  const whisper = resolveBin('whisper-cli', 'WHISPER_BIN') || resolveBin('whisper-cpp', 'WHISPER_BIN')
  if (!whisper) return { srtPath: null, reason: 'blocked_no_whisper_cli' }
  const model = resolveModel()
  if (!model) return { srtPath: null, reason: 'blocked_no_whisper_model' }
  const ffmpeg = resolveBin('ffmpeg', 'FFMPEG_BIN') || 'ffmpeg'

  const wav = `${outBase}.16k.wav`
  if (!toWav16k(ffmpeg, voicePath, wav)) return { srtPath: null, reason: 'blocked_wav_convert_failed' }

  const lang = (opts.language || 'en').slice(0, 2)
  const maxLen = opts.maxLen ?? 34   // kortere cues → laatste woord past op één regel
  const args = [
    '-m', model, '-f', wav,
    '-osrt', '-of', outBase,
    '-ml', String(maxLen), '-sow',        // korte cues, splits op woordgrens
    '-l', lang, '-np',                     // taal + geen log-spam
    '-t', String(Math.max(2, Math.min(8, os.cpus().length - 1))),
  ]
  // Aquier-content: geef whisper de merknaam vooraf mee → het transcribeert de brand consistent
  // als "Aquier" i.p.v. fonetische gokjes ("Aquire"/"Akhir"). Alleen voor de Aquier-promo.
  if (opts.brand === 'aquier') {
    args.push('--prompt', 'Aquier is an AI real estate acquisition platform. Aquier. Aquier.', '--carry-initial-prompt')
  }
  const r = spawnSync(whisper, args, { timeout: 600_000, encoding: 'utf8' })
  try { fs.unlinkSync(wav) } catch { /* */ }
  const srt = `${outBase}.srt`
  if (r.status !== 0 || !fs.existsSync(srt)) {
    return { srtPath: null, reason: `blocked_whisper_failed: ${(r.stderr || r.error?.message || ('status=' + r.status)).toString().slice(0, 160)}` }
  }
  applyBrandCorrections(srt, opts.brand)
  return { srtPath: srt, reason: null }
}

// Fonetische whisper-misspellingen van "Aquier" (whole-word, case-insensitive). Geen gewone
// Engelse woorden → veilig. Het werkwoord "acquire/acquired" staat er bewust NIET in.
const AQUIER_ALIASES = ['Aquire','Aquir','Aquiere','Aquiera','Aquair','Aquaire','Aqueer','Aquie','Aquia',
  'Akwier','Ackwier','Akwer','Akhir','Akhier','Akheer','Akeer','Akir','Aqueer','Aquiar']

/** Corrigeert merknaam-misspellingen in de SRT → "Aquier". Alleen voor Aquier-content (brand). */
function applyBrandCorrections(srtPath: string, brand?: string): void {
  if (brand !== 'aquier') return
  try {
    let s = fs.readFileSync(srtPath, 'utf8')
    const re = new RegExp('\\b(?:' + AQUIER_ALIASES.join('|') + ')\\b', 'gi')
    s = s.replace(re, 'Aquier')
    fs.writeFileSync(srtPath, s, 'utf8')
  } catch { /* niet-fataal */ }
}
