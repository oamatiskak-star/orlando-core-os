/**
 * Browser Registration Runner — Mac mini (CLI-L) PM2 service.
 *
 * Co-pilot voor affiliate-registratie: stuurt een ECHTE (headed) Chromium aan,
 * vult de bekende velden zelf in op de juiste plek, en PAUZEERT vóór elke submit
 * (of bij een ontbrekend veld) tot Orlando in het dashboard goedkeurt. CAPTCHA/2FA
 * doet Orlando in datzelfde Chrome-venster; daarna hervat de runner.
 *
 * Aparte PM2-service (NIET account-setup-runner) omdat een run minuten/uren kan
 * pauzeren op goedkeuring — dat mag de synchrone account-setup-loop niet blokkeren.
 *
 * Flow per run (run_kind='browser_registration'):
 *   navigate → per veld: fill + screenshot → await_approval (submit-gate) →
 *   submit → detect_result → terugschrijven (account_status/affiliate_link).
 *
 * Pauze-primitief: account_setup_runs.status = 'awaiting_approval' + een
 * account_setup_human_actions-rij (action_kind 'approve_submit'/'approve_action');
 * de runner polt tot die 'resolved' (hervat) of 'dismissed' (afbreken) is.
 *
 * GEEN mock: ontbrekende field-map of business-gegevens → expliciete human-action,
 * nooit verzonnen waarden. Wachtwoorden alleen in de credentialstore (notes),
 * nooit in step-output/audit/logs; type=password maskeert visueel in screenshots.
 */
import 'dotenv/config'
import { randomBytes } from 'crypto'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { chromium, Browser, Page } from 'playwright'
import { loadFieldMap, firstAvailable, FieldDescriptor } from './browser/field-map'
import { buildScreenshotPath, uploadScreenshot } from './browser/storage'

const SUPABASE_URL              = process.env.SUPABASE_URL!
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const SERVICE_ID                = process.env.BROWSER_REG_SERVICE_ID   ?? 'browser-registration-runner-macmini'
const SERVICE_NAME              = process.env.BROWSER_REG_SERVICE_NAME ?? 'Browser Registration Runner (Mac mini)'
const HOST_ID                   = process.env.WATCHDOG_HOST_ID         ?? 'cli-l'
const REGISTRATION_EMAIL        = process.env.REGISTRATION_EMAIL       ?? 'o.amatiskak@gmail.com'
const POLL_INTERVAL_MS          = parseInt(process.env.BROWSER_REG_POLL_INTERVAL_MS ?? '5000')
const SERVICE_HEARTBEAT_MS      = parseInt(process.env.BROWSER_REG_SERVICE_HEARTBEAT_MS ?? '60000')
const RUN_HEARTBEAT_MS          = parseInt(process.env.BROWSER_REG_RUN_HEARTBEAT_MS ?? '30000')
const APPROVAL_POLL_MS          = parseInt(process.env.BROWSER_REG_APPROVAL_POLL_MS ?? '3000')
const APPROVAL_TIMEOUT_MS       = parseInt(process.env.BROWSER_REG_APPROVAL_TIMEOUT_MS ?? `${2 * 60 * 60 * 1000}`)

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Browser-reg runner: SUPABASE_URL en SUPABASE_SERVICE_ROLE_KEY zijn verplicht.')
  process.exit(1)
}

const db: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
function log(msg: string, ...args: unknown[]) {
  console.log(`[${new Date().toISOString()}] [browser-reg] ${msg}`, ...args)
}

type RunRow = { id: string; program_id: string | null; run_kind: string; status: string; payload: Record<string, unknown> }
type ProgramRow = { id: string; name: string; company_id: string | null; account_status: string | null; notes: string | null }
type BusinessProfile = {
  legal_name: string | null; trade_name: string | null; kvk_number: string | null; vat_number: string | null
  address: string | null; postal_code: string | null; city: string | null; country: string | null
  website: string | null; contact_email: string | null; contact_phone: string | null; iban: string | null
}

type StepKind =
  | 'navigate' | 'fill_field' | 'capture_screenshot' | 'await_approval'
  | 'submit_form' | 'detect_result'
type StepStatus = 'started' | 'progress' | 'completed' | 'failed' | 'skipped'

let stepOrder = 0

// ── audit / step / heartbeat ────────────────────────────────────────────────
async function audit(programId: string | null, runId: string | null, action: string, detail: Record<string, unknown> = {}) {
  await db.from('account_setup_audit_log').insert({ program_id: programId, run_id: runId, action, actor: 'ai', detail })
}
async function recordStep(runId: string, stepKind: StepKind, status: StepStatus, output?: unknown, error?: unknown) {
  await db.from('account_setup_run_steps').insert({
    run_id: runId, order_idx: ++stepOrder, step_kind: stepKind, status,
    output: output ?? null, error: error ?? null,
    started_at: new Date().toISOString(), ended_at: new Date().toISOString(),
  })
}
async function serviceHeartbeat(): Promise<void> {
  await db.from('infra_watchdog_events').insert({
    service_id: SERVICE_ID, service_name: SERVICE_NAME,
    service_type: 'local-agent-browser-registration-runner', host_id: HOST_ID,
    kind: 'heartbeat', deploy_status: 'live',
    message: `Browser-reg runner alive @ ${new Date().toISOString()}`,
    metadata: { poll_ms: POLL_INTERVAL_MS, version: '1.0.0' },
  })
}

// ── claim 1 queued browser_registration run (atomic) ────────────────────────
async function claimNextRun(): Promise<RunRow | null> {
  const { data: candidates } = await db
    .from('account_setup_runs').select('id')
    .eq('status', 'queued').eq('run_kind', 'browser_registration')
    .order('started_at', { ascending: true }).limit(5)
  if (!candidates?.length) return null

  for (const c of candidates) {
    const { data: claimed } = await db
      .from('account_setup_runs')
      .update({
        status: 'running', claimed_by: SERVICE_ID, claimed_at: new Date().toISOString(),
        heartbeat_at: new Date().toISOString(), service_id: SERVICE_ID,
        started_at: new Date().toISOString(),
      })
      .eq('id', c.id).eq('status', 'queued')
      .select('id, program_id, run_kind, status, payload').maybeSingle()
    if (claimed) return claimed as RunRow
  }
  return null
}

// ── data laden ──────────────────────────────────────────────────────────────
async function loadProgram(programId: string): Promise<ProgramRow | null> {
  const { data } = await db.from('affiliate_programs')
    .select('id, name, company_id, account_status, notes').eq('id', programId).maybeSingle()
  return (data as ProgramRow) ?? null
}
async function loadBusinessProfile(companyId: string): Promise<BusinessProfile | null> {
  const { data } = await db.from('business_profiles')
    .select('legal_name, trade_name, kvk_number, vat_number, address, postal_code, city, country, website, contact_email, contact_phone, iban')
    .eq('company_id', companyId).maybeSingle()
  return (data as BusinessProfile) ?? null
}

/** Genereer een sterk wachtwoord (geen mocks: echt random per programma). */
function generatePassword(): string {
  const raw = randomBytes(18).toString('base64').replace(/[^a-zA-Z0-9]/g, '')
  return `Aff!${raw.slice(0, 16)}9`
}

/** Vertaal een field-map `source` naar de concrete waarde uit de gegevensbronnen. */
function resolveSource(source: string, bp: BusinessProfile | null, password: string): string | null {
  if (source === 'credential.generated_password') return password
  if (source === 'credential.email') return REGISTRATION_EMAIL
  if (source.startsWith('business_profiles.')) {
    const key = source.split('.')[1] as keyof BusinessProfile
    const val = bp?.[key]
    return val && String(val).trim() !== '' ? String(val) : null
  }
  return null
}

// ── screenshot (met defensieve maskering van wachtwoordvelden) ──────────────
async function captureAndUpload(page: Page, runId: string, programId: string, label: string): Promise<string> {
  // type=password rendert al als dots; extra defensief leegmaken zou de waarde
  // wissen, dus we vertrouwen op de password-masking van de browser zelf.
  const path = buildScreenshotPath(runId, programId, stepOrder + 1)
  const buf = await page.screenshot({ fullPage: false })
  await uploadScreenshot(db, path, buf)
  await recordStep(runId, 'capture_screenshot', 'completed', { label, screenshot_path: path })
  return path
}

// ── approval-gate: pauzeer run + human-action, poll tot resolved/dismissed ──
async function awaitApproval(
  runId: string, programId: string, actionKind: 'approve_submit' | 'approve_action' | 'captcha',
  title: string, description: string, screenshotPath: string | null,
): Promise<'approved' | 'rejected'> {
  await db.from('account_setup_runs').update({ status: 'awaiting_approval' }).eq('id', runId)
  const { data: inserted, error } = await db.from('account_setup_human_actions').insert({
    program_id: programId, run_id: runId, action_kind: actionKind, title, description, status: 'open',
    metadata: { gate: true, screenshot_path: screenshotPath },
  }).select('id').single()
  if (error || !inserted) throw new Error(`Human-action aanmaken faalde: ${error?.message}`)
  const actionId = (inserted as { id: string }).id
  await recordStep(runId, 'await_approval', 'progress', { action_id: actionId, screenshot_path: screenshotPath, title })
  await audit(programId, runId, 'browser.awaiting_approval', { action_id: actionId, kind: actionKind })

  const deadline = Date.now() + APPROVAL_TIMEOUT_MS
  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (Date.now() > deadline) throw new Error(`Goedkeuring time-out (${APPROVAL_TIMEOUT_MS}ms) op actie ${actionId}`)
    await sleep(APPROVAL_POLL_MS)
    const { data } = await db.from('account_setup_human_actions').select('status').eq('id', actionId).maybeSingle()
    const st = (data as { status: string } | null)?.status
    if (st === 'resolved') {
      await db.from('account_setup_runs').update({ status: 'running' }).eq('id', runId)
      await recordStep(runId, 'await_approval', 'completed', { action_id: actionId, decision: 'approved' })
      return 'approved'
    }
    if (st === 'dismissed') {
      await recordStep(runId, 'await_approval', 'completed', { action_id: actionId, decision: 'rejected' })
      return 'rejected'
    }
  }
}

// ── één veld invullen (skip + human-action als bron of selector ontbreekt) ──
async function fillField(page: Page, runId: string, programId: string, fd: FieldDescriptor, bp: BusinessProfile | null, password: string): Promise<void> {
  const value = resolveSource(fd.source, bp, password)
  if (value === null) {
    await recordStep(runId, 'fill_field', 'skipped', { field: fd.field, reason: 'bron leeg (nog invullen)' })
    await db.from('account_setup_human_actions').insert({
      program_id: programId, run_id: runId, action_kind: 'manual_review',
      title: `Ontbrekend gegeven: ${fd.field}`,
      description: `Bron ${fd.source} is leeg. Vul dit in bij business_profiles of handmatig in de browser.`,
      status: 'open', metadata: { field: fd.field, source: fd.source },
    })
    return
  }
  const selector = await firstAvailable(page, fd.selectors)
  if (!selector) {
    await recordStep(runId, 'fill_field', 'skipped', { field: fd.field, reason: 'selector niet gevonden op pagina' })
    return
  }
  try {
    if (fd.strategy === 'fill') await page.locator(selector).first().fill(value)
    else if (fd.strategy === 'select') await page.locator(selector).first().selectOption(value)
    else if (fd.strategy === 'check') await page.locator(selector).first().check()
    else if (fd.strategy === 'click') await page.locator(selector).first().click()
    await recordStep(runId, 'fill_field', 'completed', {
      field: fd.field, selector, value: fd.sensitive ? '***' : value,
    })
  } catch (e) {
    await recordStep(runId, 'fill_field', 'failed', { field: fd.field, selector }, { message: (e as Error).message })
  }
}

/** Sla credentials op in de credentialstore (notes) — nooit in audit/step/logs. */
async function storeCredentials(program: ProgramRow, password: string): Promise<void> {
  const block = `\n[browser_registration ${new Date().toISOString().slice(0, 10)}] login=${REGISTRATION_EMAIL} pw=${password}`
  await db.from('affiliate_programs').update({ notes: (program.notes ?? '') + block }).eq('id', program.id)
}

// ── hoofd-executor ───────────────────────────────────────────────────────────
async function executeRun(run: RunRow): Promise<void> {
  log(`Run ${run.id} — browser_registration program=${run.program_id ?? '—'}`)
  stepOrder = 0
  const hbTimer = setInterval(() => {
    db.from('account_setup_runs').update({ heartbeat_at: new Date().toISOString() }).eq('id', run.id)
      .then(({ error }) => { if (error) log(`Heartbeat fout ${run.id}: ${error.message}`) })
  }, RUN_HEARTBEAT_MS)

  let browser: Browser | null = null
  try {
    if (!run.program_id) throw new Error('browser_registration vereist program_id')
    const program = await loadProgram(run.program_id)
    if (!program) throw new Error(`Programma ${run.program_id} niet gevonden`)

    const fieldMap = await loadFieldMap(db, program.id)
    if (!fieldMap) {
      await db.from('account_setup_human_actions').insert({
        program_id: program.id, run_id: run.id, action_kind: 'manual_review',
        title: `Geen field-map voor ${program.name}`,
        description: 'Voeg een rij toe aan account_setup_field_maps (signup_url + velden) om automatisch invullen te activeren.',
        status: 'open',
      })
      throw new Error(`Geen field-map voor programma ${program.name}`)
    }

    const bp = program.company_id ? await loadBusinessProfile(program.company_id) : null
    const password = generatePassword()
    await storeCredentials(program, password)

    browser = await chromium.launch({ headless: false, args: ['--start-maximized'] })
    const context = await browser.newContext({ viewport: null })
    const page = await context.newPage()

    // 1) navigeren
    await page.goto(fieldMap.signup_url, { waitUntil: 'domcontentloaded', timeout: 60_000 })
    await recordStep(run.id, 'navigate', 'completed', { url: fieldMap.signup_url })
    await captureAndUpload(page, run.id, program.id, 'na navigeren')

    // 2) velden invullen (niet-gated automatisch; gated vraagt eerst goedkeuring)
    for (const fd of fieldMap.fields) {
      if (fd.gated) {
        const shot = await captureAndUpload(page, run.id, program.id, `vóór gated veld ${fd.field}`)
        const dec = await awaitApproval(run.id, program.id, 'approve_action',
          `Goedkeuren: veld ${fd.field}`, `Agent wil ${fd.field} invullen. Goedkeuren om door te gaan.`, shot)
        if (dec === 'rejected') { await finishCancelled(run.id, program.id, 'gated veld afgewezen'); return }
      }
      await fillField(page, run.id, program.id, fd, bp, password)
      await captureAndUpload(page, run.id, program.id, `na veld ${fd.field}`)
    }

    // 3) submit-gate: agent vult, mens keurt verzending goed (CAPTCHA/2FA doe je hier in de echte browser)
    const preSubmitShot = await captureAndUpload(page, run.id, program.id, 'klaar om te verzenden')
    const decision = await awaitApproval(run.id, program.id, 'approve_submit',
      `Verzenden goedkeuren: ${program.name}`,
      'Alle bekende velden zijn ingevuld. Doe eventueel CAPTCHA/2FA in het Chrome-venster op de Mac en keur daarna verzending goed.',
      preSubmitShot)
    if (decision === 'rejected') { await finishCancelled(run.id, program.id, 'verzending afgewezen'); return }

    // 4) submit
    const submitSel = await firstAvailable(page, fieldMap.submit_selectors)
    if (submitSel) {
      await page.locator(submitSel).first().click().catch(() => { /* anti-bot kan klik blokkeren */ })
      await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => { /* SPA */ })
      await recordStep(run.id, 'submit_form', 'completed', { selector: submitSel })
    } else {
      await recordStep(run.id, 'submit_form', 'skipped', { reason: 'submit-selector niet gevonden — handmatig verzenden in de browser' })
    }
    await captureAndUpload(page, run.id, program.id, 'na verzenden')

    // 5) resultaat detecteren
    const url = page.url()
    const html = (await page.content()).toLowerCase()
    const matched = fieldMap.success_patterns.some(p => url.toLowerCase().includes(p.toLowerCase()) || html.includes(p.toLowerCase()))
    await recordStep(run.id, 'detect_result', 'completed', { matched, final_url: url })
    if (matched) {
      await db.from('affiliate_programs').update({
        account_status: 'applied', login_status: 'created', last_status_check_at: new Date().toISOString(),
      }).eq('id', program.id)
      await audit(program.id, run.id, 'browser.registration_submitted', { final_url: url })
    } else {
      await db.from('account_setup_human_actions').insert({
        program_id: program.id, run_id: run.id, action_kind: 'manual_review',
        title: `Verifieer registratie: ${program.name}`,
        description: `Geen succespatroon herkend op ${url}. Controleer handmatig en zet de status zo nodig op 'applied'.`,
        status: 'open', metadata: { final_url: url },
      })
    }

    await db.from('account_setup_runs').update({ status: 'completed', ended_at: new Date().toISOString(), error: null }).eq('id', run.id)
    log(`Run ${run.id} ✓ completed (matched=${matched})`)
  } catch (e) {
    const err = e as Error
    await recordStep(run.id, 'detect_result', 'failed', undefined, { message: err.message }).catch(() => {})
    await db.from('account_setup_runs').update({ status: 'failed', ended_at: new Date().toISOString(), error: { message: err.message } }).eq('id', run.id)
    await audit(run.program_id ?? null, run.id, 'run.failed', { run_kind: run.run_kind, error: err.message })
    log(`Run ${run.id} ✗ FAILED: ${err.message}`)
  } finally {
    clearInterval(hbTimer)
    await browser?.close().catch(() => {})
  }
}

async function finishCancelled(runId: string, programId: string, reason: string): Promise<void> {
  await db.from('account_setup_runs').update({ status: 'cancelled', ended_at: new Date().toISOString(), error: { message: reason } }).eq('id', runId)
  await audit(programId, runId, 'browser.cancelled', { reason })
  log(`Run ${runId} ⊘ cancelled: ${reason}`)
}

// ── main loop ─────────────────────────────────────────────────────────────────
async function main() {
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  log(`  Browser Registration Runner — ${SERVICE_ID}`)
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  log(`Poll: ${POLL_INTERVAL_MS}ms · Approval-poll: ${APPROVAL_POLL_MS}ms · e-mail: ${REGISTRATION_EMAIL}`)

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
    await sleep(POLL_INTERVAL_MS)
  }
}

main().catch(err => {
  console.error('Fatal in browser-registration runner:', err)
  process.exit(1)
})
