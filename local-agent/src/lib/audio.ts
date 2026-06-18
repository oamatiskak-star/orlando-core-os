import fs from 'fs'
import { spawnSync } from 'child_process'
import { generateTTS, resolveBin, chunkText, concatAudio } from './tts'

/**
 * VOICE PROVIDER ROUTER (Content Factory 2.0 — FASE 2).
 *
 * Provider-onafhankelijk, kostenbewust, geen vendor lock-in.
 * - Lokaal (gratis, voor bulk/shadow/test): local_xtts → piper → edge_tts.
 * - Premium (publish): openai_tts / elevenlabs — ALLEEN ingezet wanneer de
 *   lokale voice_score < 95 (anders blijft het lokaal = goedkoop).
 *
 * Productie-publish vereist voice_score >= 95 ongeacht provider. Een audio die
 * die lat niet haalt levert een gateReason en mag NOOIT upload_ready worden.
 */

export type VoiceProvider = 'local_xtts' | 'piper' | 'edge_tts' | 'openai_tts' | 'elevenlabs'
export type VoiceMode = 'shadow' | 'bulk' | 'premium'

export const VOICE_GATE_PREMIUM = 'blocked_voice_below_95'          // gescoord <95, geen premium-escalatie mogelijk
export const VOICE_GATE_NO_PROVIDER = 'blocked_no_voice_provider'    // geen enkele provider beschikbaar

const LOCAL_ORDER:   VoiceProvider[] = ['local_xtts', 'piper', 'edge_tts']
// OpenAI-TTS eerst (gefund + betrouwbaar); ElevenLabs secundair (betere kwaliteit zodra opgewaardeerd).
const PREMIUM_ORDER: VoiceProvider[] = ['elevenlabs', 'openai_tts']

// edge-tts vereist een geldige stemnaam ('default' → ValueError). Map per taal naar
// een echte neural-stem (ook espeak-vriendelijk: leidt 'nl'/'en'-prefix af).
function defaultVoiceFor(language?: string): string {
  const l = (language || 'en').toLowerCase()
  if (l.startsWith('nl')) return 'nl-NL-ColetteNeural'
  if (l.startsWith('es')) return 'es-ES-ElviraNeural'
  return 'en-US-JennyNeural'
}
/** Lost 'default'/leeg op naar een echte stem per taal; expliciete stemnaam blijft behouden. */
function resolveVoice(requested: string | undefined, language?: string): string {
  return (!requested || requested === 'default') ? defaultVoiceFor(language) : requested
}

export interface VoiceResult {
  provider: VoiceProvider | null
  outputPath: string | null
  productionReady: boolean        // alleen true bij premium-kwaliteit of lokaal met voice_score>=95
  gateReason: string | null       // gezet wanneer NIET productie-klaar
}

export interface SynthOptions {
  voice: string                   // edge-tts/xtts/piper-stemnaam of premium voiceId
  mode: VoiceMode
  localVoiceScore?: number | null // QC voice-score van een eerdere lokale render (>=95 → premium overslaan)
  language?: string
}

// ── beschikbaarheid (geen aannames: detecteer per binary/env) ────────────────
// resolveBin zoekt ook in ~/.local/bin (pipx) + homebrew — robuust onder scheduler/PM2.
function hasBinary(bin: string, envVar?: string): boolean {
  return resolveBin(bin, envVar) !== null
}
export function providerAvailable(p: VoiceProvider): boolean {
  switch (p) {
    case 'local_xtts':  return !!process.env.XTTS_URL || hasBinary('tts')          // coqui XTTS-server of CLI
    case 'piper':       return !!process.env.PIPER_BIN || hasBinary('piper')
    case 'edge_tts':    return hasBinary('edge-tts', 'EDGE_TTS_BIN') || hasBinary('espeak', 'ESPEAK_BIN')  // espeak = laatste lokale fallback
    case 'openai_tts':  return !!process.env.OPENAI_API_KEY
    case 'elevenlabs':  return !!process.env.ELEVENLABS_API_KEY
  }
}

// ── provider-implementaties (draaien alleen als available) ───────────────────
async function synthLocalXtts(text: string, out: string, voice: string): Promise<void> {
  const base = process.env.XTTS_URL
  if (base) {
    const axios = (await import('axios')).default
    const res = await axios.post(`${base}/api/tts`, { text, speaker: voice, language: 'auto' },
      { responseType: 'arraybuffer', timeout: 180_000 })
    fs.writeFileSync(out, Buffer.from(res.data)); return
  }
  const r = spawnSync('tts', ['--text', text, '--out_path', out], { encoding: 'utf8' })
  if (r.status !== 0) throw new Error(`xtts faalde: ${r.stderr ?? ''}`)
}
async function synthPiper(text: string, out: string): Promise<void> {
  const bin = process.env.PIPER_BIN || 'piper'
  const model = process.env.PIPER_MODEL
  const args = model ? ['--model', model, '--output_file', out] : ['--output_file', out]
  const r = spawnSync(bin, args, { input: text, encoding: 'utf8' })
  if (r.status !== 0) throw new Error(`piper faalde: ${r.stderr ?? ''}`)
}
const OPENAI_TTS_VOICES = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer', 'ash', 'sage', 'coral']
async function synthOpenAi(text: string, out: string, voice: string): Promise<void> {
  const axios = (await import('axios')).default
  // OpenAI accepteert alleen vaste stemnamen; map onbekende (bv. 'default'/edge-tts-naam) → 'onyx'.
  const oaVoice = OPENAI_TTS_VOICES.includes(voice) ? voice : 'onyx'
  const res = await axios.post('https://api.openai.com/v1/audio/speech',
    { model: process.env.OPENAI_TTS_MODEL || 'tts-1-hd', voice: oaVoice, input: text },
    { headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` }, responseType: 'arraybuffer', timeout: 120_000 })
  fs.writeFileSync(out, Buffer.from(res.data))
}
async function synthElevenLabs(text: string, out: string, voiceId: string): Promise<void> {
  const axios = (await import('axios')).default
  // 'default'/edge-tts-naam is geen geldige ElevenLabs voice-id → val terug op env of standaardstem.
  const vid = /^[A-Za-z0-9]{20,}$/.test(voiceId) ? voiceId : (process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM')
  const res = await axios.post(`https://api.elevenlabs.io/v1/text-to-speech/${vid}`,
    { text, model_id: 'eleven_multilingual_v2', voice_settings: { stability: 0.5, similarity_boost: 0.75 } },
    { headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY!, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
      responseType: 'arraybuffer', timeout: 120_000 })
  fs.writeFileSync(out, Buffer.from(res.data))
}

async function runProvider(p: VoiceProvider, text: string, out: string, voice: string): Promise<void> {
  switch (p) {
    case 'local_xtts':  return synthLocalXtts(text, out, voice)
    case 'piper':       return synthPiper(text, out)
    case 'edge_tts':    return generateTTS(text, out, voice)   // bestaande edge-tts/espeak
    case 'openai_tts':  return synthOpenAi(text, out, voice)
    case 'elevenlabs':  return synthElevenLabs(text, out, voice)
  }
}

/** Long-form-veilige TTS: ElevenLabs/OpenAI hebben tekstlimieten per request. Chunk op
 *  zin-grenzen, synth elk stuk, concat met ffmpeg. (edge-tts chunkt zelf al → 1 sub-chunk.) */
async function synthChunked(p: VoiceProvider, text: string, out: string, voice: string): Promise<void> {
  const chunks = chunkText(text, 2200)
  if (chunks.length <= 1) { await runProvider(p, text, out, voice); return }
  const parts: string[] = []
  for (let i = 0; i < chunks.length; i++) {
    const part = `${out}.part${i}.mp3`
    await runProvider(p, chunks[i], part, voice)
    parts.push(part)
  }
  if (!concatAudio(parts, out)) throw new Error(`TTS-concat faalde (${p}, ${chunks.length} chunks)`)
  for (const pp of parts) { try { fs.unlinkSync(pp) } catch { /* */ } }
}

/**
 * Kiest een provider volgens de kostenregel en synthetiseert.
 * - shadow/bulk → eerste beschikbare LOKALE provider (gratis).
 * - premium     → lokaal mag blijven als localVoiceScore>=95; anders escaleer
 *                 naar premium (elevenlabs vóór openai). Geen premium beschikbaar
 *                 + lokaal<95 → gateReason, NIET productie-klaar.
 */
export async function synthVoice(text: string, outputPath: string, opts: SynthOptions): Promise<VoiceResult> {
  const localScore = opts.localVoiceScore ?? null
  const localOk = localScore != null && localScore >= 95

  // Premium-publish met onvoldoende lokale score → probeer premium-providers.
  if (opts.mode === 'premium' && !localOk) {
    for (const p of PREMIUM_ORDER) {
      if (!providerAvailable(p)) continue
      try {
        await synthChunked(p, text, outputPath, opts.voice)
        return { provider: p, outputPath, productionReady: true, gateReason: null }
      } catch (e) {
        // bv. ElevenLabs 402 (geen credits) → probeer de volgende premium-provider (OpenAI-TTS).
        console.warn(`premium TTS ${p} faalde (${(e as { response?: { status?: number } })?.response?.status ?? (e as Error).message}) → volgende provider`)
      }
    }
    // Geen premium beschikbaar → val terug op lokaal maar markeer geblokkeerd.
    for (const p of LOCAL_ORDER) {
      if (providerAvailable(p)) {
        await runProvider(p, text, outputPath, resolveVoice(opts.voice, opts.language))
        return { provider: p, outputPath, productionReady: false, gateReason: VOICE_GATE_PREMIUM }
      }
    }
    return { provider: null, outputPath: null, productionReady: false, gateReason: VOICE_GATE_NO_PROVIDER }
  }

  // shadow/bulk (of premium met lokaal>=95) → lokale provider.
  for (const p of LOCAL_ORDER) {
    if (providerAvailable(p)) {
      await runProvider(p, text, outputPath, resolveVoice(opts.voice, opts.language))
      // Productie-klaar alleen als premium-modus mét bewezen lokale score>=95.
      const productionReady = opts.mode === 'premium' && localOk
      return { provider: p, outputPath, productionReady, gateReason: productionReady ? null : VOICE_GATE_PREMIUM }
    }
  }
  return { provider: null, outputPath: null, productionReady: false, gateReason: VOICE_GATE_NO_PROVIDER }
}
