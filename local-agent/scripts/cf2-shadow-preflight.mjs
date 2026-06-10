/**
 * cf2:shadow — host-readiness preflight voor de eerste CF2 shadow-run.
 *
 * Doet ALLEEN: env controleren, Ollama/LM Studio/TTS/FFmpeg/font/music/pexels readiness
 * controleren, build uitvoeren/controleren, en het shadow-run command VOORBEREIDEN (printen).
 *
 * Doet NIET: uploaden, publiceren, CF2_PUBLISH=1 zetten, engines enabled=true zetten, of de
 * producer draaien. Harde stop als CF2_PUBLISH=1 (of 'true') staat.
 */
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import process from 'node:process'

try { const d = await import('dotenv'); d.config() } catch { /* dotenv optioneel */ }

const env = process.env
const C = { ok: '\x1b[32m', bad: '\x1b[31m', warn: '\x1b[33m', dim: '\x1b[2m', off: '\x1b[0m' }

// ── SAFETY GUARD: shadow mag NOOIT publiceren ────────────────────────────────
if (env.CF2_PUBLISH === '1' || String(env.CF2_PUBLISH).toLowerCase() === 'true') {
  console.error(`${C.bad}✖ HARD STOP: CF2_PUBLISH=${env.CF2_PUBLISH}. cf2:shadow mag NOOIT publiceren.${C.off}`)
  console.error(`  Zet CF2_PUBLISH=0 in .env. Publicatie is een aparte, expliciete stap (privé).`)
  process.exit(2)
}
if (env.CF2_PRODUCER_MODE && env.CF2_PRODUCER_MODE !== 'prepared' && env.CF2_PRODUCER_MODE !== 'live') {
  console.error(`${C.bad}✖ Ongeldige CF2_PRODUCER_MODE='${env.CF2_PRODUCER_MODE}' (verwacht: prepared|live).${C.off}`)
  process.exit(2)
}

const hasBin = (b) => { try { return spawnSync('which', [b], { encoding: 'utf8' }).status === 0 } catch { return false } }
async function reachable(url, path) {
  if (!url) return false
  try {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 2500)
    const r = await fetch(`${url}${path}`, { signal: ctl.signal }); clearTimeout(t); return r.ok
  } catch { return false }
}

const OLLAMA = env.OLLAMA_BASE_URL || env.OLLAMA_URL || 'http://localhost:11434'
const LMSTUDIO = env.LM_STUDIO_BASE_URL || env.LM_STUDIO_URL || 'http://localhost:1234'
const TTS = (env.TTS_PROVIDER || 'edge_tts').toLowerCase()

function ttsReady() {
  switch (TTS) {
    case 'edge_tts': return hasBin('edge-tts')
    case 'piper': return !!env.PIPER_BIN || hasBin('piper')
    case 'espeak': return hasBin('espeak')
    case 'local_xtts': return !!env.XTTS_URL || hasBin('tts')
    case 'openai_tts': return !!env.OPENAI_API_KEY
    case 'elevenlabs': return !!env.ELEVENLABS_API_KEY
    default: return false
  }
}

const checks = []
const add = (id, label, ok, hint) => checks.push({ id, label, ok, hint })

// B5: lokale modellen
add('B5a', 'Ollama bereikbaar', await reachable(OLLAMA, '/api/tags'), `start: ollama serve  (${OLLAMA})`)
add('B5b', 'LM Studio bereikbaar', await reachable(LMSTUDIO, '/v1/models'), `start LM Studio server (${LMSTUDIO})`)
// B1: TTS
add('B1', `TTS-provider (${TTS})`, ttsReady(), `installeer: pipx install edge-tts  (of piper/espeak)`) // local TTS
// FFmpeg (al klaar verwacht)
add('FF', 'FFmpeg', hasBin('ffmpeg'), 'brew install ffmpeg')
// B2/B3/B4: keys/font/music
add('B2', 'PEXELS_API_KEY', !!env.PEXELS_API_KEY, 'gratis key op pexels.com/api → .env')
add('B3', 'MUSIC_CATALOG', !!env.MUSIC_CATALOG, 'royalty-free muziekbron (bucket/pad) → .env')
add('B4', 'CAPTION_FONT bestaat', !!env.CAPTION_FONT && existsSync(env.CAPTION_FONT), 'geldig .ttf-pad → .env')
add('ENV', 'Supabase env', !!env.SUPABASE_URL && !!env.SUPABASE_SERVICE_ROLE_KEY, 'SUPABASE_URL + SERVICE_ROLE_KEY → .env')

// B6: build (uitvoeren of controleren)
let buildOk = existsSync('dist/cf2-producer.js')
if (!buildOk) {
  console.log(`${C.dim}dist ontbreekt — npm run build…${C.off}`)
  const b = spawnSync('npm', ['run', 'build'], { stdio: 'inherit' })
  buildOk = b.status === 0 && existsSync('dist/cf2-producer.js')
}
add('B6', 'Build (dist/cf2-producer.js)', buildOk, 'npm ci && npm run build')

// ── rapport ──────────────────────────────────────────────────────────────────
console.log(`\n${C.dim}CF2 shadow-run readiness — mode=${env.CF2_PRODUCER_MODE || 'prepared'} · publish=${env.CF2_PUBLISH || '0'}${C.off}`)
for (const c of checks) {
  const mark = c.ok ? `${C.ok}✅${C.off}` : `${C.bad}❌${C.off}`
  console.log(`  ${mark} [${c.id}] ${c.label}${c.ok ? '' : `  ${C.dim}→ ${c.hint}${C.off}`}`)
}

const blockers = checks.filter((c) => !c.ok)
if (blockers.length) {
  console.log(`\n${C.warn}${blockers.length} blokkade(s) — los op vóór de shadow-run.${C.off}`)
  console.log(`${C.dim}(Geen productie/upload uitgevoerd. Niets is gestart.)${C.off}`)
  process.exit(1)
}

// Alles klaar → shadow-run command VOORBEREIDEN (niet uitvoeren)
console.log(`\n${C.ok}Alle checks groen. Voer de shadow-run zelf uit (lokaal, GEEN upload):${C.off}`)
console.log(`\n  ${C.dim}# produceert lokaal, vult cf2_job_steps, publiceert NIET (CF2_PUBLISH blijft 0)${C.off}`)
console.log(`  CF2_PRODUCER_MODE=live CF2_PRODUCER_RUN=1 node dist/cf2-producer.js\n`)
console.log(`${C.dim}cf2:shadow voert dit bewust NIET zelf uit — geen auto-productie. Stop: Ctrl-C.${C.off}`)
process.exit(0)
