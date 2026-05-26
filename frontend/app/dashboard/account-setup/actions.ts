'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { AccountStatus, ProgramCategory, RunKind, HumanActionStatus } from '@/lib/affiliate-programs/types'

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
