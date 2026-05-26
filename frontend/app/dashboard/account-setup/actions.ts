'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { AccountStatus, ProgramCategory, RunKind, HumanActionStatus, LoginStatus, DocKind, DocStatus } from '@/lib/affiliate-programs/types'

/**
 * Server actions voor Affiliate & Revenue Infrastructure.
 *
 * RLS (migratie 100): `authenticated` is read-only, `service_role` full access.
 * Schrijfacties draaien daarom via de admin-client (service-role, server-side).
 * actor_id wordt afgeleid uit de ingelogde sessie voor de immutable audit-log.
 */

const ALL_CATEGORIES: ProgramCategory[] = ['saas_ai', 'finance_crypto', 'vastgoed_data', 'affiliate_network', 'other']
const ALL_ACCOUNT_STATUS: AccountStatus[] = ['not_started', 'applied', 'pending', 'approved', 'active', 'payout_active', 'rejected', 'suspended']
const ALL_RUN_KINDS: RunKind[] = ['account_setup', 'affiliate_registration', 'verification', 'revenue_sync', 'reminder', 'terms_analysis']
const ALL_LOGIN_STATUS: LoginStatus[] = ['none', 'created', 'verified', 'mfa_pending', 'locked']
const ALL_DOC_KINDS: DocKind[] = ['kyc_id', 'proof_address', 'tax_form', 'contract', 'bank', 'other']
const ALL_DOC_STATUS: DocStatus[] = ['required', 'uploaded', 'verified', 'rejected']

const PATH = '/dashboard/account-setup'

async function currentUserId(): Promise<string | null> {
  const supabase = await createClient()
  const { data } = await supabase.auth.getUser()
  return data.user?.id ?? null
}

async function audit(
  programId: string | null,
  runId: string | null,
  action: string,
  detail: Record<string, unknown> = {},
) {
  const admin = createAdminClient()
  const actorId = await currentUserId()
  await admin.from('account_setup_audit_log').insert({
    program_id: programId,
    run_id: runId,
    action,
    actor: 'user',
    actor_id: actorId,
    detail,
  })
}

function revalidateAll() {
  revalidatePath(PATH)
  revalidatePath(`${PATH}/accounts`)
  revalidatePath(`${PATH}/requires-action`)
  revalidatePath(`${PATH}/revenue`)
  revalidatePath(`${PATH}/kyc`)
  revalidatePath(`${PATH}/links`)
  revalidatePath(`${PATH}/youtube`)
  revalidatePath(`${PATH}/aquier`)
}

// ── createProgram ──────────────────────────────────────────────────────────
export async function createProgram(formData: FormData) {
  const name = String(formData.get('name') ?? '').trim()
  const category = String(formData.get('category') ?? 'other').trim() as ProgramCategory
  const url = String(formData.get('url') ?? '').trim()
  const companySlug = String(formData.get('company_slug') ?? '').trim()

  if (!name) throw new Error('Naam is verplicht')
  if (!ALL_CATEGORIES.includes(category)) throw new Error('Ongeldige categorie')

  const admin = createAdminClient()

  let companyId: string | null = null
  if (companySlug) {
    const { data } = await admin.from('companies').select('id').eq('slug', companySlug).maybeSingle()
    companyId = data?.id ?? null
    if (!companyId) throw new Error(`Onbekende company slug: ${companySlug}`)
  }

  const { data: inserted, error } = await admin
    .from('affiliate_programs')
    .insert({ name, category, url: url || null, company_id: companyId })
    .select('id')
    .single()

  if (error || !inserted) throw new Error(error?.message ?? 'Aanmaken mislukt')

  await audit(inserted.id, null, 'program.created', { name, category })
  revalidateAll()
}

// ── setAccountStatus ─────────────────────────────────────────────────────────
export async function setAccountStatus(formData: FormData) {
  const programId = String(formData.get('program_id') ?? '').trim()
  const status = String(formData.get('account_status') ?? '').trim() as AccountStatus

  if (!programId) throw new Error('program_id ontbreekt')
  if (!ALL_ACCOUNT_STATUS.includes(status)) throw new Error('Ongeldige status')

  const admin = createAdminClient()
  const { error } = await admin
    .from('affiliate_programs')
    .update({ account_status: status, last_status_check_at: new Date().toISOString() })
    .eq('id', programId)

  if (error) throw new Error(error.message)

  await audit(programId, null, 'program.status_changed', { account_status: status })
  revalidateAll()
}

// ── enqueueRun ───────────────────────────────────────────────────────────────
export async function enqueueRun(formData: FormData) {
  const programId = String(formData.get('program_id') ?? '').trim()
  const runKind = String(formData.get('run_kind') ?? 'account_setup').trim() as RunKind

  if (!programId) throw new Error('program_id ontbreekt')
  if (!ALL_RUN_KINDS.includes(runKind)) throw new Error('Ongeldige run_kind')

  const admin = createAdminClient()
  const { data: run, error } = await admin
    .from('account_setup_runs')
    .insert({ program_id: programId, run_kind: runKind, status: 'queued', trigger_kind: 'manual' })
    .select('id')
    .single()

  if (error || !run) throw new Error(error?.message ?? 'Run aanmaken mislukt')

  await audit(programId, run.id, 'run.enqueued', { run_kind: runKind })
  revalidateAll()
}

// ── resolveHumanAction ───────────────────────────────────────────────────────
export async function resolveHumanAction(formData: FormData) {
  const actionId = String(formData.get('action_id') ?? '').trim()
  const decision = String(formData.get('decision') ?? 'resolved').trim() as HumanActionStatus

  if (!actionId) throw new Error('action_id ontbreekt')
  if (!['resolved', 'dismissed', 'in_progress'].includes(decision)) throw new Error('Ongeldige beslissing')

  const admin = createAdminClient()
  const actorId = await currentUserId()
  const patch: Record<string, unknown> = { status: decision }
  if (decision === 'resolved' || decision === 'dismissed') {
    patch.resolved_at = new Date().toISOString()
    patch.resolved_by = actorId
  }

  const { data: row, error } = await admin
    .from('account_setup_human_actions')
    .update(patch)
    .eq('id', actionId)
    .select('program_id, run_id')
    .single()

  if (error) throw new Error(error.message)

  await audit(row?.program_id ?? null, row?.run_id ?? null, 'human_action.resolved', { decision })
  revalidateAll()
}

// ── F2: addRevenueEntry — maandelijkse revenue boeken (rollup via DB-trigger) ─
export async function addRevenueEntry(formData: FormData) {
  const programId = String(formData.get('program_id') ?? '').trim()
  const month = String(formData.get('period_month') ?? '').trim()        // 'YYYY-MM'
  const gross = Number(formData.get('gross_revenue') ?? 0)
  const commission = Number(formData.get('commission_revenue') ?? 0)
  const currency = String(formData.get('currency') ?? 'USD').trim().toUpperCase().slice(0, 3) || 'USD'

  if (!programId) throw new Error('program_id ontbreekt')
  if (!/^\d{4}-\d{2}$/.test(month)) throw new Error('Maand moet YYYY-MM zijn')
  if (!Number.isFinite(gross) || !Number.isFinite(commission) || gross < 0 || commission < 0) {
    throw new Error('Ongeldige bedragen')
  }

  const admin = createAdminClient()
  const period = `${month}-01`
  // upsert per (program_id, period_month): trigger herberekent monthly/lifetime
  const { error } = await admin
    .from('affiliate_revenue_ledger')
    .upsert(
      { program_id: programId, period_month: period, gross_revenue: gross, commission_revenue: commission, currency, source: 'manual' },
      { onConflict: 'program_id,period_month' },
    )
  if (error) throw new Error(error.message)

  await audit(programId, null, 'revenue.recorded', { period_month: period, gross, commission, currency })
  revalidateAll()
}

// ── F2: updateProgramKeys — affiliate_link/referral_code/login_status/notes ──
// "Keys staan in notities": API-keys / credentials worden in het notes-veld bewaard.
export async function updateProgramKeys(formData: FormData) {
  const programId = String(formData.get('program_id') ?? '').trim()
  if (!programId) throw new Error('program_id ontbreekt')

  const affiliateLink = String(formData.get('affiliate_link') ?? '').trim()
  const referralCode = String(formData.get('referral_code') ?? '').trim()
  const loginStatus = String(formData.get('login_status') ?? '').trim() as LoginStatus
  const notes = String(formData.get('notes') ?? '')

  const patch: Record<string, unknown> = {
    affiliate_link: affiliateLink || null,
    referral_code: referralCode || null,
    notes: notes.trim() ? notes : null,
  }
  if (loginStatus) {
    if (!ALL_LOGIN_STATUS.includes(loginStatus)) throw new Error('Ongeldige login_status')
    patch.login_status = loginStatus
  }

  const admin = createAdminClient()
  const { error } = await admin.from('affiliate_programs').update(patch).eq('id', programId)
  if (error) throw new Error(error.message)

  // notes-inhoud (keys) niet in audit loggen — alleen welke velden gewijzigd zijn
  await audit(programId, null, 'program.keys_updated', {
    fields: Object.keys(patch).filter(k => k !== 'notes'),
    notes_changed: true,
  })
  revalidateAll()
}

// ── F2: addDocument — KYC/document-vereiste registreren ──────────────────────
export async function addDocument(formData: FormData) {
  const programId = String(formData.get('program_id') ?? '').trim()
  const docKind = String(formData.get('doc_kind') ?? 'other').trim() as DocKind
  const notes = String(formData.get('notes') ?? '').trim()

  if (!programId) throw new Error('program_id ontbreekt')
  if (!ALL_DOC_KINDS.includes(docKind)) throw new Error('Ongeldig document-type')

  const admin = createAdminClient()
  const { error } = await admin.from('account_setup_documents').insert({
    program_id: programId, doc_kind: docKind, status: 'required', notes: notes || null,
  })
  if (error) throw new Error(error.message)

  await audit(programId, null, 'document.added', { doc_kind: docKind })
  revalidateAll()
}

// ── F2: setDocStatus — document-status bijwerken ─────────────────────────────
export async function setDocStatus(formData: FormData) {
  const documentId = String(formData.get('document_id') ?? '').trim()
  const status = String(formData.get('status') ?? '').trim() as DocStatus

  if (!documentId) throw new Error('document_id ontbreekt')
  if (!ALL_DOC_STATUS.includes(status)) throw new Error('Ongeldige document-status')

  const admin = createAdminClient()
  const { data: row, error } = await admin
    .from('account_setup_documents')
    .update({ status })
    .eq('id', documentId)
    .select('program_id')
    .single()
  if (error) throw new Error(error.message)

  await audit(row?.program_id ?? null, null, 'document.status_changed', { document_id: documentId, status })
  revalidateAll()
}

// ── F4: setChannelLink — programma ↔ youtube_channel koppelen/ontkoppelen ────
export async function setChannelLink(formData: FormData) {
  const programId = String(formData.get('program_id') ?? '').trim()
  const channelId = String(formData.get('channel_id') ?? '').trim()
  const op = String(formData.get('op') ?? '').trim()

  if (!programId || !channelId) throw new Error('program_id en channel_id zijn verplicht')
  if (op !== 'add' && op !== 'remove') throw new Error('Ongeldige op')

  const admin = createAdminClient()
  const { data: prog, error: readErr } = await admin
    .from('affiliate_programs')
    .select('connected_channels')
    .eq('id', programId)
    .single()
  if (readErr || !prog) throw new Error(readErr?.message ?? 'Programma niet gevonden')

  const current: string[] = Array.isArray(prog.connected_channels) ? prog.connected_channels : []
  const next = op === 'add'
    ? Array.from(new Set([...current, channelId]))
    : current.filter(c => c !== channelId)

  const { error } = await admin.from('affiliate_programs').update({ connected_channels: next }).eq('id', programId)
  if (error) throw new Error(error.message)

  await audit(programId, null, 'channel.link_changed', { channel_id: channelId, op })
  revalidateAll()
}
