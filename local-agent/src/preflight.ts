import 'dotenv/config'
import axios from 'axios'
import { spawnSync } from 'child_process'

/**
 * CF2 SHADOW-RUN PREFLIGHT (poort vóór de runner).
 *
 * Controleert of de runtime klaar is om ECHTE records te produceren. Geeft PASS
 * of een expliciete BLOCKED_*-reden — fabriceert NOOIT records. De record-
 * producerende shadow-run mag alleen draaien als preflight PASS geeft.
 */

export interface PreflightResult { ok: boolean; blocked: string[]; checks: Record<string, boolean> }

async function reachable(url: string): Promise<boolean> {
  try { const r = await axios.get(url, { timeout: 4000 }); return r.status < 500 } catch { return false }
}
function hasBin(b: string): boolean { try { return spawnSync('which', [b]).status === 0 } catch { return false } }

export async function runPreflight(): Promise<PreflightResult> {
  const checks: Record<string, boolean> = {}
  const blocked: string[] = []

  // ── HARD vereist voor een record-producerende run ──
  checks.supabase_env = !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
  if (!checks.supabase_env) blocked.push('BLOCKED_MISSING_SUPABASE_ENV')

  const lmUrl = process.env.LM_STUDIO_URL || 'http://localhost:1234'
  const ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434'
  checks.llm_runtime = (await reachable(`${lmUrl}/v1/models`)) || (await reachable(`${ollamaUrl}/api/tags`))
  if (!checks.llm_runtime) blocked.push('BLOCKED_MISSING_LLM_RUNTIME')

  checks.ffmpeg = hasBin('ffmpeg')
  if (!checks.ffmpeg) blocked.push('BLOCKED_MISSING_FFMPEG')

  // ── Advisory (NIET preflight-blokkerend; leiden per stap tot blocked_*-reden) ──
  checks.pexels_key = !!process.env.PEXELS_API_KEY
  checks.voice_provider = hasBin('edge-tts') || hasBin('espeak') || !!process.env.XTTS_URL || hasBin('piper') || !!process.env.OPENAI_API_KEY || !!process.env.ELEVENLABS_API_KEY
  checks.frontend_qc_url = !!process.env.FRONTEND_QC_URL
  checks.music_catalog = !!process.env.MUSIC_CATALOG

  return { ok: blocked.length === 0, blocked, checks }
}

if (require.main === module) {
  runPreflight().then((r) => {
    console.log('PREFLIGHT:', JSON.stringify(r, null, 2))
    console.log(r.ok ? 'PREFLIGHT: PASS' : `PREFLIGHT: ${r.blocked.join(', ')}`)
    process.exit(r.ok ? 0 : 2)
  }).catch((e) => { console.error('PREFLIGHT-FOUT:', e?.message ?? e); process.exit(1) })
}
