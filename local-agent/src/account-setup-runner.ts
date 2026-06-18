/**
 * Account Setup Runner — Mac mini PM2 service (Fase 3).
 *
 * Polled `account_setup_runs` voor `status='queued'`, claimed één per tick
 * (atomic via re-check op status), voert uit op basis van `run_kind`, en
 * schrijft `account_setup_run_steps` + `account_setup_audit_log` + heartbeat.
 *
 * run_kind handlers:
 *   - terms_analysis        → lokale LLM (LM Studio/Ollama) vat affiliate-
 *                             voorwaarden + payout-structuur samen en schrijft
 *                             gestructureerde velden terug naar affiliate_programs.
 *   - reminder              → zorgt dat er een open human-action bestaat.
 *   - account_setup /
 *     affiliate_registration → genereert onboarding-checklist (prepare_onboarding).
 *   - verification          → check_login stub (markeert te verifiëren).
 *   - revenue_sync          → revenue_sync stub (placeholder voor API-koppeling).
 *
 * Heartbeat: account_setup_runs.heartbeat_at elke 30s tijdens execution +
 * infra_watchdog_events service-heartbeat elke 60s (org-watchdog detectie).
 *
 * GEEN mock-data: ontbrekende LLM → run faalt expliciet (recorded), geen verzonnen velden.
 */

import './ws-shim'
import 'dotenv/config'
import axios from 'axios'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL              = process.env.SUPABASE_URL!
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const SERVICE_ID                = process.env.ACCOUNT_SETUP_SERVICE_ID   ?? 'account-setup-runner-macmini'
const SERVICE_NAME              = process.env.ACCOUNT_SETUP_SERVICE_NAME ?? 'Account Setup Runner (Mac mini)'
const HOST_ID                   = process.env.WATCHDOG_HOST_ID           ?? 'cli-l'
const POLL_INTERVAL_MS          = parseInt(process.env.ACCOUNT_SETUP_POLL_INTERVAL_MS ?? '5000')
const SERVICE_HEARTBEAT_MS      = parseInt(process.env.ACCOUNT_SETUP_SERVICE_HEARTBEAT_MS ?? '60000')
const RUN_HEARTBEAT_MS          = parseInt(process.env.ACCOUNT_SETUP_RUN_HEARTBEAT_MS ?? '30000')

const USE_LM_STUDIO  = process.env.USE_LM_STUDIO !== 'false'
const LM_STUDIO_URL  = process.env.LM_STUDIO_URL  || 'http://localhost:1234'
const LM_STUDIO_MODEL= process.env.LM_STUDIO_MODEL || 'default'
const OLLAMA_URL     = process.env.OLLAMA_URL      || 'http://localhost:11434'
const OLLAMA_MODEL   = process.env.OLLAMA_MODEL    || 'llama3.2'

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Account-setup runner: SUPABASE_URL en SUPABASE_SERVICE_ROLE_KEY zijn verplicht.')
  process.exit(1)
}

const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

function log(msg: string, ...args: unknown[]) {
  console.log(`[${new Date().toISOString()}] [account-setup] ${msg}`, ...args)
}

type RunRow = {
  id: string
  program_id: string | null
  run_kind: string
  status: string
  payload: Record<string, unknown>
}

type ProgramRow = {
  id: string
  name: string
  category: string
  account_type: string
  url: string | null
  notes: string | null
  payout_model: string | null
  recurring: boolean | null
  kyc_requirements: string | null
  country_availability: string[] | null
}

type AccountTypeRow = {
  type_key: string
  label: string
  checklist: { step: string; action_kind: string }[]
  required_docs: string[]
}

type StepKind =
  | 'analyze_terms' | 'summarize_payout' | 'prepare_onboarding' | 'detect_documents'
  | 'generate_followup' | 'check_login' | 'store_link' | 'revenue_sync'
  | 'request_human_action' | 'delay'

// ── Audit + step helpers ──────────────────────────────────────────────────
async function audit(programId: string | null, runId: string | null, action: string, detail: Record<string, unknown> = {}) {
  await db.from('account_setup_audit_log').insert({ program_id: programId, run_id: runId, action, actor: 'ai', detail })
}

async function recordStep(runId: string, stepKind: StepKind, status: 'completed' | 'failed' | 'skipped', output?: unknown, error?: unknown) {
  await db.from('account_setup_run_steps').insert({
    run_id: runId, step_kind: stepKind, status,
    output: output ?? null, error: error ?? null, ended_at: new Date().toISOString(),
  })
}

// ── Service heartbeat ──────────────────────────────────────────────────────
async function serviceHeartbeat(): Promise<void> {
  await db.from('infra_watchdog_events').insert({
    service_id:    SERVICE_ID,
    service_name:  SERVICE_NAME,
    service_type:  'local-agent-account-setup-runner',
    host_id:       HOST_ID,
    kind:          'heartbeat',
    deploy_status: 'live',
    message:       `Account-setup runner alive @ ${new Date().toISOString()}`,
    metadata:      { poll_ms: POLL_INTERVAL_MS, version: '1.0.0' },
  })
}

// ── Local LLM call (LM Studio primair, Ollama fallback) ─────────────────────
async function callLLM(prompt: string): Promise<string> {
  if (USE_LM_STUDIO) {
    try {
      const res = await axios.post(`${LM_STUDIO_URL}/v1/chat/completions`, {
        model: LM_STUDIO_MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 2048,
      }, { timeout: 120_000 })
      return res.data.choices[0].message.content as string
    } catch (e) {
      log('LM Studio mislukt, fallback Ollama:', (e as Error).message)
    }
  }
  const res = await axios.post(`${OLLAMA_URL}/api/generate`, {
    model: OLLAMA_MODEL, prompt, stream: false, format: 'json',
    options: { temperature: 0.3, num_predict: 2048, num_ctx: 8192 },
  }, { timeout: 300_000 })
  return res.data.response as string
}

function extractJson(raw: string): Record<string, unknown> {
  const stripped = raw.replace(/```(?:json)?/g, '').replace(/```/g, '')
  const match = stripped.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('LLM gaf geen geldige JSON terug')
  return JSON.parse(match[0]) as Record<string, unknown>
}

// ── Claim 1 queued run (atomic) ─────────────────────────────────────────────
async function claimNextRun(): Promise<RunRow | null> {
  const { data: candidates } = await db
    .from('account_setup_runs')
    .select('id')
    .eq('status', 'queued')
    .neq('run_kind', 'browser_registration') // browser-registration heeft een eigen headed runner
    .order('started_at', { ascending: true })
    .limit(5)

  if (!candidates?.length) return null

  for (const c of candidates) {
    const { data: claimed } = await db
      .from('account_setup_runs')
      .update({
        status: 'running',
        claimed_by: SERVICE_ID,
        claimed_at: new Date().toISOString(),
        heartbeat_at: new Date().toISOString(),
        service_id: SERVICE_ID,
      })
      .eq('id', c.id)
      .eq('status', 'queued')
      .select('id, program_id, run_kind, status, payload')
      .maybeSingle()

    if (claimed) return claimed as RunRow
  }
  return null
}

// ── run_kind handlers ───────────────────────────────────────────────────────
async function loadProgram(programId: string): Promise<ProgramRow | null> {
  const { data } = await db
    .from('affiliate_programs')
    .select('id, name, category, account_type, url, notes, payout_model, recurring, kyc_requirements, country_availability')
    .eq('id', programId)
    .maybeSingle()
  return (data as ProgramRow) ?? null
}

async function loadAccountType(typeKey: string): Promise<AccountTypeRow | null> {
  const { data } = await db
    .from('account_setup_types')
    .select('type_key, label, checklist, required_docs')
    .eq('type_key', typeKey)
    .maybeSingle()
  return (data as AccountTypeRow) ?? null
}

// human-action aanmaken per UNIEKE titel (niet dedupe op kind — een template
// kan meerdere 'manual_review'-stappen hebben).
async function ensureHumanActionByTitle(programId: string, runId: string, kind: string, title: string, description: string) {
  const { data: existing } = await db
    .from('account_setup_human_actions')
    .select('id')
    .eq('program_id', programId)
    .eq('title', title)
    .in('status', ['open', 'in_progress'])
    .maybeSingle()
  if (existing) return false
  await db.from('account_setup_human_actions').insert({
    program_id: programId, run_id: runId, action_kind: kind, title, description, status: 'open',
  })
  return true
}

async function ensureRequiredDoc(programId: string, docKind: string) {
  const { data: existing } = await db
    .from('account_setup_documents')
    .select('id')
    .eq('program_id', programId)
    .eq('doc_kind', docKind)
    .maybeSingle()
  if (existing) return false
  await db.from('account_setup_documents').insert({ program_id: programId, doc_kind: docKind, status: 'required' })
  return true
}

async function handleTermsAnalysis(run: RunRow): Promise<void> {
  if (!run.program_id) throw new Error('terms_analysis vereist program_id')
  const program = await loadProgram(run.program_id)
  if (!program) throw new Error(`Programma ${run.program_id} niet gevonden`)

  const prompt = `Je bent een affiliate-programma analist. Analyseer het affiliate-programma "${program.name}" (${program.url ?? 'geen url'}).
Vat op basis van algemeen bekende publieke informatie de programmavoorwaarden samen. Verzin NIETS — laat onbekende velden leeg (null).

Geef ALLEEN geldige JSON terug (geen markdown):
{
  "payout_model": "korte omschrijving payout-model (bijv. 'CPA $X', 'RevShare 30% recurring 12mnd') of null",
  "recurring": true of false of null,
  "payout_threshold_usd": getal of null,
  "kyc_requirements": "korte omschrijving KYC/verificatie-eisen of null",
  "country_availability": ["ISO-landcodes of regio's"] of [],
  "api_available": true of false of null,
  "summary": "2-3 zinnen samenvatting voor onboarding"
}`

  const raw = await callLLM(prompt)
  const parsed = extractJson(raw)

  const update: Record<string, unknown> = { last_status_check_at: new Date().toISOString() }
  if (typeof parsed.payout_model === 'string') update.payout_model = parsed.payout_model
  if (typeof parsed.recurring === 'boolean') update.recurring = parsed.recurring
  if (typeof parsed.payout_threshold_usd === 'number') update.payout_threshold = parsed.payout_threshold_usd
  if (typeof parsed.kyc_requirements === 'string') update.kyc_requirements = parsed.kyc_requirements
  if (Array.isArray(parsed.country_availability)) update.country_availability = parsed.country_availability.map(String)
  if (typeof parsed.api_available === 'boolean') update.api_available = parsed.api_available
  if (typeof parsed.summary === 'string') {
    const stamp = `\n[terms_analysis ${new Date().toISOString().slice(0, 10)}] ${parsed.summary}`
    update.notes = (program.notes ?? '') + stamp
  }

  const { error } = await db.from('affiliate_programs').update(update).eq('id', program.id)
  if (error) throw new Error(`Update affiliate_programs faalde: ${error.message}`)

  await recordStep(run.id, 'analyze_terms', 'completed', { fields_updated: Object.keys(update) })
  await audit(program.id, run.id, 'terms_analysis.completed', { fields_updated: Object.keys(update) })
}

async function ensureHumanAction(programId: string, runId: string, kind: string, title: string, description: string) {
  const { data: existing } = await db
    .from('account_setup_human_actions')
    .select('id')
    .eq('program_id', programId)
    .eq('action_kind', kind)
    .in('status', ['open', 'in_progress'])
    .maybeSingle()
  if (existing) return
  await db.from('account_setup_human_actions').insert({
    program_id: programId, run_id: runId, action_kind: kind, title, description, status: 'open',
  })
}

async function handleReminder(run: RunRow): Promise<void> {
  if (!run.program_id) { await recordStep(run.id, 'generate_followup', 'completed', { note: 'geen program_id' }); return }
  const program = await loadProgram(run.program_id)
  if (!program) throw new Error(`Programma ${run.program_id} niet gevonden`)
  await ensureHumanAction(program.id, run.id, 'manual_review',
    `Follow-up: ${program.name}`, 'Reminder-engine: programma vereist een handmatige vervolgactie.')
  await recordStep(run.id, 'generate_followup', 'completed', { program: program.name })
  await audit(program.id, run.id, 'reminder.processed', {})
}

// Template-gedreven onboarding: leest het account_setup_types-template van het
// account-type en genereert per checklist-stap een human-action + per vereist
// document een 'required'-rij. Zo schaalt onboarding naar elk type zonder code.
async function handleOnboarding(run: RunRow): Promise<void> {
  if (!run.program_id) throw new Error('onboarding vereist program_id')
  const program = await loadProgram(run.program_id)
  if (!program) throw new Error(`Programma ${run.program_id} niet gevonden`)

  const tmpl = await loadAccountType(program.account_type)
  if (!tmpl) {
    // fallback: onbekend type → één generieke actie
    await ensureHumanActionByTitle(program.id, run.id, 'manual_review',
      `Onboarding voorbereiden: ${program.name}`, 'Account-type zonder template — handmatige onboarding.')
    await recordStep(run.id, 'prepare_onboarding', 'completed', { account_type: program.account_type, template: false })
    await audit(program.id, run.id, 'onboarding.prepared', { account_type: program.account_type, template: false })
    return
  }

  let actionsCreated = 0
  for (const item of tmpl.checklist ?? []) {
    const created = await ensureHumanActionByTitle(
      program.id, run.id, item.action_kind || 'manual_review',
      `${tmpl.label}: ${item.step} — ${program.name}`,
      `Onboarding-stap voor ${tmpl.label}. Handmatige actie vereist (agent verzendt niet autonoom).`,
    )
    if (created) actionsCreated++
  }

  let docsCreated = 0
  for (const docKind of tmpl.required_docs ?? []) {
    if (await ensureRequiredDoc(program.id, docKind)) docsCreated++
  }

  await recordStep(run.id, 'prepare_onboarding', 'completed', {
    account_type: program.account_type, template: tmpl.label, actions_created: actionsCreated, docs_created: docsCreated,
  })
  await audit(program.id, run.id, 'onboarding.prepared', {
    account_type: program.account_type, actions_created: actionsCreated, docs_created: docsCreated,
  })
}

async function handleVerification(run: RunRow): Promise<void> {
  if (!run.program_id) throw new Error('verification vereist program_id')
  await db.from('affiliate_programs').update({ last_status_check_at: new Date().toISOString() }).eq('id', run.program_id)
  await recordStep(run.id, 'check_login', 'completed', { checked_at: new Date().toISOString() })
  await audit(run.program_id, run.id, 'verification.checked', {})
}

type ConnectorRow = {
  id: string
  provider: string | null
  base_url: string | null
  auth_type: 'none' | 'bearer' | 'api_key' | 'basic'
  credential_env: string | null
  config: Record<string, unknown>
  enabled: boolean
}

// Dynamische datum-tokens in endpoint-URL. Awin (en vergelijkbare) eisen een
// startDate/endDate-range; we vullen die per sync automatisch in.
// Tokens: {startDate} {endDate} {startOfMonth} {endOfMonth} {now}
// config.date_window: 'current_month' (default) | 'last_31_days' | 'last_7_days'
function fmtDateTime(d: Date): string {
  return d.toISOString().slice(0, 19) // YYYY-MM-DDTHH:mm:ss (UTC)
}
function applyDateTemplate(url: string, cfg: Record<string, unknown>): string {
  if (!/\{(startDate|endDate|startOfMonth|endOfMonth|now)\}/.test(url)) return url
  const now = new Date()
  const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0))
  const endOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59))
  const windowKind = String(cfg.date_window ?? 'current_month')
  let start = startOfMonth
  const end = now // nooit in de toekomst → API's accepteren dit
  if (windowKind === 'last_31_days') start = new Date(now.getTime() - 31 * 86_400_000)
  else if (windowKind === 'last_7_days') start = new Date(now.getTime() - 7 * 86_400_000)
  return url
    .split('{startDate}').join(fmtDateTime(start))
    .split('{endDate}').join(fmtDateTime(end))
    .split('{startOfMonth}').join(fmtDateTime(startOfMonth))
    .split('{endOfMonth}').join(fmtDateTime(endOfMonth))
    .split('{now}').join(fmtDateTime(now))
}

function dotGet(obj: unknown, path: string | undefined): unknown {
  if (!path) return obj
  return path.split('.').reduce<unknown>((acc, k) => {
    if (acc && typeof acc === 'object' && k in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[k]
    }
    return undefined
  }, obj)
}

// Generieke revenue-sync via affiliate_api_connectors. Secret komt uit env-var
// (credential_env) op de runner-host — NOOIT uit de DB. Uit zolang niet enabled.
async function handleRevenueSync(run: RunRow): Promise<void> {
  if (!run.program_id) { await recordStep(run.id, 'revenue_sync', 'completed', { note: 'geen program_id' }); return }

  const { data: connData } = await db
    .from('affiliate_api_connectors')
    .select('id, provider, base_url, auth_type, credential_env, config, enabled')
    .eq('program_id', run.program_id)
    .maybeSingle()
  const conn = connData as ConnectorRow | null

  if (!conn || !conn.enabled) {
    await recordStep(run.id, 'revenue_sync', 'skipped', { reason: conn ? 'connector_disabled' : 'no_connector' })
    await audit(run.program_id, run.id, 'revenue_sync.skipped', { has_connector: !!conn })
    return
  }

  const cfg = conn.config ?? {}
  const url = applyDateTemplate(String(cfg.endpoint ?? conn.base_url ?? ''), cfg)
  if (!url) throw new Error('connector zonder endpoint/base_url')

  // auth
  const headers: Record<string, string> = { 'Accept': 'application/json' }
  if (conn.auth_type !== 'none') {
    const secret = conn.credential_env ? process.env[conn.credential_env] : undefined
    if (!secret) throw new Error(`credential_env '${conn.credential_env}' niet gezet op runner-host`)
    if (conn.auth_type === 'bearer') headers['Authorization'] = `Bearer ${secret}`
    else if (conn.auth_type === 'basic') headers['Authorization'] = `Basic ${Buffer.from(secret).toString('base64')}`
    else if (conn.auth_type === 'api_key') headers[String(cfg.header_name ?? 'X-API-Key')] = secret
  }

  let synced = 0
  try {
    const res = await axios.request({
      url, method: String(cfg.method ?? 'GET'), headers, timeout: 60_000,
    })
    const arr = dotGet(res.data, cfg.array_path as string | undefined)
    const rows: unknown[] = Array.isArray(arr) ? arr : [res.data]
    const month = new Date().toISOString().slice(0, 7) + '-01'
    // amount_divisor: API's die in minor units (cents) teruggeven, bijv. PartnerStack → 100
    const divisor = Number(cfg.amount_divisor) > 0 ? Number(cfg.amount_divisor) : 1

    // Som commissie per maand (een API-call geeft meerdere line-items per periode).
    const byPeriod = new Map<string, number>()
    for (const r of rows) {
      const raw = Number(dotGet(r, cfg.commission_path as string | undefined) ?? 0)
      if (!Number.isFinite(raw)) continue
      const commission = raw / divisor
      const periodRaw = dotGet(r, cfg.period_path as string | undefined)
      let period = month
      if (typeof periodRaw === 'string' && /^\d{4}-\d{2}/.test(periodRaw)) period = periodRaw.slice(0, 7) + '-01'
      else if (typeof periodRaw === 'number' && periodRaw > 0) {
        // unix epoch (s of ms) → maand
        const d = new Date(periodRaw < 1e12 ? periodRaw * 1000 : periodRaw)
        if (!isNaN(d.getTime())) period = d.toISOString().slice(0, 7) + '-01'
      }
      byPeriod.set(period, (byPeriod.get(period) ?? 0) + commission)
    }

    for (const [period, total] of byPeriod) {
      const { error } = await db.from('affiliate_revenue_ledger').upsert(
        { program_id: run.program_id, period_month: period, commission_revenue: Number(total.toFixed(2)), source: 'api' },
        { onConflict: 'program_id,period_month' },
      )
      if (!error) synced++
    }

    await db.from('affiliate_api_connectors').update({
      last_sync_at: new Date().toISOString(), last_sync_status: 'ok', last_error: null,
    }).eq('id', conn.id)
    await recordStep(run.id, 'revenue_sync', 'completed', { provider: conn.provider, rows_synced: synced })
    await audit(run.program_id, run.id, 'revenue_sync.ok', { provider: conn.provider, rows_synced: synced })
  } catch (e) {
    const msg = (e as Error).message
    await db.from('affiliate_api_connectors').update({
      last_sync_at: new Date().toISOString(), last_sync_status: 'error', last_error: msg,
    }).eq('id', conn.id)
    throw new Error(`revenue_sync API-fout: ${msg}`)
  }
}

// ── Run executor ─────────────────────────────────────────────────────────────
async function executeRun(run: RunRow): Promise<void> {
  log(`Run ${run.id} — kind=${run.run_kind} program=${run.program_id ?? '—'}`)

  const hbTimer = setInterval(() => {
    db.from('account_setup_runs').update({ heartbeat_at: new Date().toISOString() }).eq('id', run.id)
      .then(({ error }) => { if (error) log(`Heartbeat fout ${run.id}: ${error.message}`) })
  }, RUN_HEARTBEAT_MS)

  try {
    switch (run.run_kind) {
      case 'terms_analysis':        await handleTermsAnalysis(run); break
      case 'reminder':              await handleReminder(run); break
      case 'account_setup':
      case 'affiliate_registration':await handleOnboarding(run); break
      case 'verification':          await handleVerification(run); break
      case 'revenue_sync':          await handleRevenueSync(run); break
      default: throw new Error(`Onbekende run_kind: ${run.run_kind}`)
    }

    await db.from('account_setup_runs').update({ status: 'completed', ended_at: new Date().toISOString(), error: null }).eq('id', run.id)
    log(`Run ${run.id} ✓ completed`)
  } catch (e) {
    const err = e as Error
    await recordStep(run.id, 'analyze_terms', 'failed', undefined, { message: err.message })
    await db.from('account_setup_runs').update({
      status: 'failed', ended_at: new Date().toISOString(), error: { message: err.message },
    }).eq('id', run.id)
    await audit(run.program_id ?? null, run.id, 'run.failed', { run_kind: run.run_kind, error: err.message })
    log(`Run ${run.id} ✗ FAILED: ${err.message}`)
  } finally {
    clearInterval(hbTimer)
  }
}

// ── Main loop ──────────────────────────────────────────────────────────────
async function main() {
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  log(`  Account Setup Runner — ${SERVICE_ID}`)
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  log(`Poll: ${POLL_INTERVAL_MS}ms · Service HB: ${SERVICE_HEARTBEAT_MS}ms · LLM: ${USE_LM_STUDIO ? 'LM Studio' : 'Ollama'}`)

  await serviceHeartbeat().catch(e => log('Initial heartbeat fout:', (e as Error).message))
  setInterval(() => { serviceHeartbeat().catch(e => log('Heartbeat fout:', (e as Error).message)) }, SERVICE_HEARTBEAT_MS)

  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      const run = await claimNextRun()
      if (run) await executeRun(run)
    } catch (err) {
      log('Poll fout:', (err as Error).message)
    }
    await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS))
  }
}

main().catch(err => {
  console.error('Fatal in account-setup runner:', err)
  process.exit(1)
})
