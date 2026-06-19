/**
 * Live Assist Runner — Mac mini PM2 service.
 *
 * Spiegel van de browser-registration-runner: daar VULT de agent en keurt de
 * mens goed; hier vult de MENS de affiliate-aanmeldformulieren in en kijkt de
 * Setup Agent LIVE mee + beantwoordt zijn vragen. Eén globale co-watch-sessie
 * (program_id null) loopt over álle aanmeldingen heen.
 *
 * Claimt `account_setup_runs` met run_kind='live_assist' (de account-setup-runner
 * sluit deze expliciet uit). Per sessie:
 *   1. status queued → running (atomic) + "aangehaakt"-bericht als run-step.
 *   2. Pollt open vragen (account_setup_human_actions, metadata.mode='live_assist').
 *   3. Beantwoordt elke vraag via lokale LLM (LM Studio → Ollama fallback) en
 *      schrijft het antwoord terug als run-step (output {role:'agent',agent,message})
 *      — exact wat de LiveAssistSession-feed in het dashboard rendert.
 *   4. Resolved de vraag, heartbeat elke 30s, eindigt wanneer de mens de sessie
 *      sluit (status→completed via dashboard) of na MAX_SESSION_MS.
 *
 * MCP Agent: dit proces = de Setup Agent (lokale LLM). Een MCP-tool-agent kan
 * later op dezelfde run aanhaken (screenshots/browser-MCP) en guidance posten
 * als agent='mcp_agent'; de feed toont beide rollen al.
 *
 * GEEN mock-data: ontbrekende LLM → de vraag wordt gemarkeerd als 'failed' step
 * met de fout (geen verzonnen antwoord).
 */

import 'dotenv/config'
import axios from 'axios'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL              = process.env.SUPABASE_URL!
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const SERVICE_ID                = process.env.LIVE_ASSIST_SERVICE_ID   ?? 'live-assist-runner-macmini'
const SERVICE_NAME              = process.env.LIVE_ASSIST_SERVICE_NAME ?? 'Live Assist Runner (Mac mini)'
const HOST_ID                   = process.env.WATCHDOG_HOST_ID         ?? 'cli-l'
const POLL_INTERVAL_MS          = parseInt(process.env.LIVE_ASSIST_POLL_INTERVAL_MS ?? '5000')
const SESSION_POLL_MS           = parseInt(process.env.LIVE_ASSIST_SESSION_POLL_MS ?? '3000')
const SERVICE_HEARTBEAT_MS      = parseInt(process.env.LIVE_ASSIST_SERVICE_HEARTBEAT_MS ?? '60000')
const RUN_HEARTBEAT_MS          = parseInt(process.env.LIVE_ASSIST_RUN_HEARTBEAT_MS ?? '30000')
const MAX_SESSION_MS            = parseInt(process.env.LIVE_ASSIST_MAX_SESSION_MS ?? String(4 * 60 * 60 * 1000))

const USE_LM_STUDIO   = process.env.USE_LM_STUDIO !== 'false'
const LM_STUDIO_URL   = process.env.LM_STUDIO_URL   || 'http://localhost:1234'
const LM_STUDIO_MODEL = process.env.LM_STUDIO_MODEL || 'default'
const OLLAMA_URL      = process.env.OLLAMA_URL      || 'http://localhost:11434'
const OLLAMA_MODEL    = process.env.OLLAMA_MODEL    || 'llama3.2'

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Live-assist runner: SUPABASE_URL en SUPABASE_SERVICE_ROLE_KEY zijn verplicht.')
  process.exit(1)
}

const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

function log(msg: string, ...args: unknown[]) {
  console.log(`[${new Date().toISOString()}] [live-assist] ${msg}`, ...args)
}

type RunRow = { id: string; program_id: string | null; run_kind: string; status: string; payload: Record<string, unknown> }
type QuestionRow = { id: string; title: string; description: string | null; metadata: Record<string, unknown> | null; created_at: string }

// ── helpers ──────────────────────────────────────────────────────────────────
async function audit(programId: string | null, runId: string | null, action: string, detail: Record<string, unknown> = {}) {
  await db.from('account_setup_audit_log').insert({ program_id: programId, run_id: runId, action, actor: 'ai', detail })
}

// Guidance-bericht in de feed = run-step met output {role:'agent', agent, message}.
async function postGuidance(runId: string, agent: string, message: string, status: 'completed' | 'failed' = 'completed', error?: unknown) {
  await db.from('account_setup_run_steps').insert({
    run_id: runId, step_kind: 'generate_followup', status,
    output: { role: 'agent', agent, message }, error: error ?? null, ended_at: new Date().toISOString(),
  })
}

async function serviceHeartbeat(): Promise<void> {
  await db.from('infra_watchdog_events').insert({
    service_id: SERVICE_ID, service_name: SERVICE_NAME,
    service_type: 'local-agent-live-assist-runner', host_id: HOST_ID,
    kind: 'heartbeat', deploy_status: 'live',
    message: `Live-assist runner alive @ ${new Date().toISOString()}`,
    metadata: { poll_ms: POLL_INTERVAL_MS, version: '1.0.0' },
  })
}

// Lokale LLM — platte tekst (geen JSON-format, anders forceert Ollama JSON).
async function callLLMText(prompt: string): Promise<string> {
  if (USE_LM_STUDIO) {
    try {
      const res = await axios.post(`${LM_STUDIO_URL}/v1/chat/completions`, {
        model: LM_STUDIO_MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3, max_tokens: 700,
      }, { timeout: 120_000 })
      return String(res.data.choices[0].message.content).trim()
    } catch (e) {
      log('LM Studio mislukt, fallback Ollama:', (e as Error).message)
    }
  }
  const res = await axios.post(`${OLLAMA_URL}/api/generate`, {
    model: OLLAMA_MODEL, prompt, stream: false,
    options: { temperature: 0.3, num_predict: 700, num_ctx: 8192 },
  }, { timeout: 300_000 })
  return String(res.data.response).trim()
}

function answerPrompt(program: string | null, question: string): string {
  return `Je bent de Setup Agent die LIVE meekijkt terwijl Orlando een affiliate-programma aanmeldt voor `
    + `Modiwerijo Financial Management B.V. — een finance/vastgoed/crypto YouTube-netwerk (NL/EN/DE/ES) + aquier.com.\n`
    + `Hij vult een aanmeldformulier in en stelt je een vraag.\n\n`
    + (program ? `Programma: ${program}\n` : '')
    + `Vraag: ${question}\n\n`
    + `Geef een KORT, concreet antwoord in het Nederlands: wat moet hij precies invullen of kiezen? `
    + `Noem indien relevant de compliance-vlag (MiCA/FCA/ASIC/MAS/VARA) en de vaste regel dat affiliate-links `
    + `alleen in video-beschrijvingen/nieuwsbrief mogen, nooit als on-screen advies. Maximaal 4 zinnen.`
}

// ── claim 1 live_assist run (atomic) ──────────────────────────────────────────
async function claimNextRun(): Promise<RunRow | null> {
  const { data: candidates } = await db
    .from('account_setup_runs')
    .select('id')
    .eq('status', 'queued')
    .eq('run_kind', 'live_assist')
    .order('started_at', { ascending: true })
    .limit(5)
  if (!candidates?.length) return null

  for (const c of candidates) {
    const { data: claimed } = await db
      .from('account_setup_runs')
      .update({
        status: 'running', claimed_by: SERVICE_ID, claimed_at: new Date().toISOString(),
        heartbeat_at: new Date().toISOString(), service_id: SERVICE_ID,
      })
      .eq('id', c.id).eq('status', 'queued')
      .select('id, program_id, run_kind, status, payload').maybeSingle()
    if (claimed) return claimed as RunRow
  }
  return null
}

async function runStatus(runId: string): Promise<string | null> {
  const { data } = await db.from('account_setup_runs').select('status').eq('id', runId).maybeSingle()
  return (data?.status as string) ?? null
}

// ── sessie ────────────────────────────────────────────────────────────────────
async function handleSession(run: RunRow): Promise<void> {
  log(`Sessie ${run.id} gestart — co-watch actief`)
  await postGuidance(run.id, 'setup_agent',
    'Setup Agent aangehaakt en kijkt mee. Plak hieronder de aanmeldvraag die je nu moet beantwoorden, dan geef ik je het concrete antwoord (incl. compliance-check).')
  await audit(null, run.id, 'live_assist.attached', { agent: 'setup_agent' })

  const start = Date.now()
  let lastHeartbeat = 0

  // eslint-disable-next-line no-constant-condition
  while (true) {
    // sessie geëindigd door de mens (dashboard zet status → completed/cancelled)?
    const status = await runStatus(run.id)
    if (status !== 'running') { log(`Sessie ${run.id} afgesloten (status=${status})`); break }

    // max-duur veiligheidsnet
    if (Date.now() - start > MAX_SESSION_MS) {
      await postGuidance(run.id, 'setup_agent', 'Sessie automatisch beëindigd na de maximale duur. Start een nieuwe sessie als je verder wilt.')
      await db.from('account_setup_runs').update({ status: 'completed', ended_at: new Date().toISOString() }).eq('id', run.id)
      await audit(null, run.id, 'live_assist.timeout', {})
      break
    }

    // run-heartbeat
    if (Date.now() - lastHeartbeat > RUN_HEARTBEAT_MS) {
      await db.from('account_setup_runs').update({ heartbeat_at: new Date().toISOString() }).eq('id', run.id)
      lastHeartbeat = Date.now()
    }

    // open vragen voor deze sessie
    const { data: qs } = await db
      .from('account_setup_human_actions')
      .select('id, title, description, metadata, created_at')
      .eq('run_id', run.id)
      .eq('status', 'open')
      .order('created_at', { ascending: true })
      .limit(5)

    for (const q of (qs as QuestionRow[] | null) ?? []) {
      const question = (q.description ?? q.title ?? '').trim()
      const program = typeof q.metadata?.['program'] === 'string' ? (q.metadata!['program'] as string) : null
      if (!question) { await db.from('account_setup_human_actions').update({ status: 'dismissed' }).eq('id', q.id); continue }

      try {
        const answer = await callLLMText(answerPrompt(program, question))
        await postGuidance(run.id, 'setup_agent', answer || 'Geen antwoord gegenereerd.')
        await db.from('account_setup_human_actions')
          .update({ status: 'resolved', resolved_at: new Date().toISOString() })
          .eq('id', q.id)
        await audit(null, run.id, 'live_assist.answered', { program })
      } catch (e) {
        const msg = (e as Error).message
        await postGuidance(run.id, 'setup_agent', `Kon deze vraag niet beantwoorden (LLM-fout: ${msg}). Probeer opnieuw of beantwoord hem zelf.`, 'failed', { message: msg })
        await db.from('account_setup_human_actions')
          .update({ status: 'in_progress' }).eq('id', q.id)
        log(`Vraag ${q.id} faalde: ${msg}`)
      }
    }

    await new Promise(r => setTimeout(r, SESSION_POLL_MS))
  }
}

// ── main loop ─────────────────────────────────────────────────────────────────
async function main() {
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  log(`  Live Assist Runner — ${SERVICE_ID}`)
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  log(`Poll: ${POLL_INTERVAL_MS}ms · Sessie-poll: ${SESSION_POLL_MS}ms · LLM: ${USE_LM_STUDIO ? 'LM Studio' : 'Ollama'}`)

  await serviceHeartbeat().catch(e => log('Initial heartbeat fout:', (e as Error).message))
  setInterval(() => { serviceHeartbeat().catch(e => log('Heartbeat fout:', (e as Error).message)) }, SERVICE_HEARTBEAT_MS)

  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      const run = await claimNextRun()
      if (run) await handleSession(run)
    } catch (err) {
      log('Poll fout:', (err as Error).message)
    }
    await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS))
  }
}

main().catch(err => {
  console.error('Fatal in live-assist runner:', err)
  process.exit(1)
})
