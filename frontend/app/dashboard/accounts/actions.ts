'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import {
  ACCOUNT_STATUS_VALUES,
  computeMissingFields,
  generateApplicationTexts,
  buildRequiredDocuments,
  deriveStatusAfterPrepare,
  type BusinessProfile,
  type TaskContext,
} from '@/lib/account-setup'

type Result = { ok: true; id?: string } | { ok: false; error: string }

function nowISO() {
  return new Date().toISOString()
}

async function loadTaskBundle(buildTaskId: string) {
  const supabase = await createClient()

  const { data: task, error: taskErr } = await supabase
    .from('build_tracker')
    .select('id, company_id, name, description, current_milestone, account_platform, account_type, expected_revenue_model')
    .eq('id', buildTaskId)
    .maybeSingle()

  if (taskErr || !task) return { supabase, task: null, profile: null }

  let profile: BusinessProfile | null = null
  if (task.company_id) {
    const { data: prof } = await supabase
      .from('business_profiles')
      .select('legal_name, trade_name, kvk_number, vat_number, address, postal_code, city, country, website, contact_email, contact_phone, iban, business_description, short_pitch')
      .eq('company_id', task.company_id)
      .maybeSingle()
    profile = (prof as BusinessProfile) ?? null
  }
  return { supabase, task, profile }
}

// ── "Maak account aan" → laad/maak account-setup en bereid alles voor ─────
export async function prepareAccountSetup(buildTaskId: string): Promise<Result> {
  const id = (buildTaskId ?? '').trim()
  if (!id) return { ok: false, error: 'Build task id ontbreekt' }

  const { supabase, task, profile } = await loadTaskBundle(id)
  if (!task) return { ok: false, error: 'Build-taak niet gevonden' }

  const ctx: TaskContext = {
    taskName: task.name,
    taskDescription: task.description,
    milestone: task.current_milestone,
    platformName: task.account_platform,
    accountType: task.account_type,
    revenueModel: task.expected_revenue_model,
  }

  const missing = computeMissingFields(profile)
  const texts = generateApplicationTexts(profile, ctx)
  const docs = buildRequiredDocuments(task.account_type)
  const status = deriveStatusAfterPrepare(missing)

  // Bestaande setup? (uniek per build_task_id) → bijwerken, anders aanmaken.
  const { data: existing } = await supabase
    .from('account_setups')
    .select('id, status, generated_application_text, setup_notes')
    .eq('build_task_id', id)
    .maybeSingle()

  const basePatch = {
    company_id: task.company_id ?? null,
    milestone_id: task.current_milestone ?? null,
    platform_name: task.account_platform ?? null,
    account_type: task.account_type ?? null,
    expected_revenue_model: task.expected_revenue_model ?? null,
    required_documents: docs,
    missing_fields: missing,
    updated_at: nowISO(),
  }

  if (existing) {
    // Bewust géén overschrijven van handmatig bewerkte tekst/status zodra
    // de gebruiker verder is dan voorbereiden.
    const advanced = ['handmatig_ingediend', 'wacht_op_goedkeuring', 'actief'].includes(existing.status)
    const patch: Record<string, unknown> = { ...basePatch }
    if (!advanced) patch.status = status
    if (!existing.generated_application_text) patch.generated_application_text = texts.affiliate_application
    const { error } = await supabase.from('account_setups').update(patch).eq('id', existing.id)
    if (error) return { ok: false, error: error.message }
    await syncTaskAccountStatus(supabase, id, (patch.status as string) ?? existing.status)
    revalidatePaths(id, existing.id)
    return { ok: true, id: existing.id }
  }

  const { data: inserted, error } = await supabase
    .from('account_setups')
    .insert({
      build_task_id: id,
      ...basePatch,
      status,
      generated_application_text: texts.affiliate_application,
      approval_required: true,
    })
    .select('id')
    .single()

  if (error) return { ok: false, error: error.message }
  await syncTaskAccountStatus(supabase, id, status)
  revalidatePaths(id, inserted.id)
  return { ok: true, id: inserted.id }
}

type UpdateSetupInput = {
  id: string
  platform_name?: string | null
  platform_url?: string | null
  account_type?: string | null
  login_email?: string | null
  setup_notes?: string | null
  generated_application_text?: string | null
}

export async function updateAccountSetup(input: UpdateSetupInput): Promise<Result> {
  const id = (input.id ?? '').trim()
  if (!id) return { ok: false, error: 'Account-setup id ontbreekt' }

  const patch: Record<string, unknown> = { updated_at: nowISO() }
  for (const k of ['platform_name', 'platform_url', 'account_type', 'login_email', 'setup_notes', 'generated_application_text'] as const) {
    if (input[k] !== undefined) patch[k] = input[k]?.toString().trim() || null
  }

  const supabase = await createClient()
  const { data: setup, error } = await supabase
    .from('account_setups')
    .update(patch)
    .eq('id', id)
    .select('build_task_id')
    .single()
  if (error) return { ok: false, error: error.message }

  revalidatePaths(setup.build_task_id, id)
  return { ok: true, id }
}

export async function setAccountStatus(setupId: string, status: string): Promise<Result> {
  const id = (setupId ?? '').trim()
  if (!id) return { ok: false, error: 'Account-setup id ontbreekt' }
  if (!ACCOUNT_STATUS_VALUES.includes(status as never)) return { ok: false, error: `Ongeldige status "${status}"` }

  const patch: Record<string, unknown> = { status, updated_at: nowISO() }
  if (status === 'handmatig_ingediend') patch.submitted_at = nowISO()
  if (status === 'actief') patch.approved_at = nowISO()
  if (status === 'afgewezen') patch.rejected_at = nowISO()

  const supabase = await createClient()
  const { data: setup, error } = await supabase
    .from('account_setups')
    .update(patch)
    .eq('id', id)
    .select('build_task_id')
    .single()
  if (error) return { ok: false, error: error.message }

  await syncTaskAccountStatus(supabase, setup.build_task_id, status)
  revalidatePaths(setup.build_task_id, id)
  return { ok: true, id }
}

// ── Centrale bedrijfsgegevens bijwerken ───────────────────────────────────
const PROFILE_FIELDS = [
  'legal_name', 'trade_name', 'kvk_number', 'vat_number', 'address', 'postal_code',
  'city', 'country', 'website', 'contact_email', 'contact_phone', 'iban',
  'business_description', 'short_pitch',
] as const

export async function updateBusinessProfile(companyId: string, patch: Partial<Record<(typeof PROFILE_FIELDS)[number], string | null>>): Promise<Result> {
  const cid = (companyId ?? '').trim()
  if (!cid) return { ok: false, error: 'Company id ontbreekt' }

  const clean: Record<string, unknown> = { company_id: cid, updated_at: nowISO() }
  for (const k of PROFILE_FIELDS) {
    if (patch[k] !== undefined) clean[k] = patch[k]?.toString().trim() || null
  }

  const supabase = await createClient()
  const { error } = await supabase.from('business_profiles').upsert(clean, { onConflict: 'company_id' })
  if (error) return { ok: false, error: error.message }

  revalidatePath('/dashboard/accounts')
  return { ok: true }
}

// ── Verdiensten (account_revenues) ────────────────────────────────────────
type RevenueInput = {
  account_setup_id: string
  revenue_type?: string | null
  expected_amount?: number | null
  actual_amount?: number | null
  currency?: string
  commission_percentage?: number | null
  payout_frequency?: string | null
  payout_status?: string | null
  first_payout_date?: string | null
  last_payout_date?: string | null
  notes?: string | null
}

export async function addRevenue(input: RevenueInput): Promise<Result> {
  const setupId = (input.account_setup_id ?? '').trim()
  if (!setupId) return { ok: false, error: 'Account-setup id ontbreekt' }

  const supabase = await createClient()
  const { error } = await supabase.from('account_revenues').insert({
    account_setup_id: setupId,
    revenue_type: input.revenue_type?.trim() || null,
    expected_amount: numOrNull(input.expected_amount),
    actual_amount: numOrNull(input.actual_amount),
    currency: input.currency?.trim() || 'EUR',
    commission_percentage: numOrNull(input.commission_percentage),
    payout_frequency: input.payout_frequency?.trim() || null,
    payout_status: input.payout_status?.trim() || 'geen',
    first_payout_date: input.first_payout_date || null,
    last_payout_date: input.last_payout_date || null,
    notes: input.notes?.trim() || null,
  })
  if (error) return { ok: false, error: error.message }

  const { data: setup } = await supabase.from('account_setups').select('build_task_id').eq('id', setupId).maybeSingle()
  revalidatePath('/dashboard/accounts')
  if (setup?.build_task_id) revalidatePaths(setup.build_task_id, setupId)
  return { ok: true }
}

export async function deleteRevenue(revenueId: string): Promise<Result> {
  const id = (revenueId ?? '').trim()
  if (!id) return { ok: false, error: 'Revenue id ontbreekt' }
  const supabase = await createClient()
  const { error } = await supabase.from('account_revenues').delete().eq('id', id)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/dashboard/accounts')
  return { ok: true }
}

// ── helpers ───────────────────────────────────────────────────────────────
function numOrNull(v: number | null | undefined): number | null {
  if (v === null || v === undefined || Number.isNaN(Number(v))) return null
  return Number(v)
}

async function syncTaskAccountStatus(
  supabase: Awaited<ReturnType<typeof createClient>>,
  buildTaskId: string,
  status: string,
) {
  await supabase
    .from('build_tracker')
    .update({ account_status: status, updated_at: nowISO() })
    .eq('id', buildTaskId)
}

function revalidatePaths(buildTaskId: string, setupId?: string) {
  revalidatePath('/dashboard/build-tracker')
  revalidatePath(`/dashboard/build-tracker/${buildTaskId}`)
  revalidatePath(`/dashboard/build-tracker/${buildTaskId}/account-setup`)
  revalidatePath('/dashboard/accounts')
  if (setupId) revalidatePath('/dashboard/accounts')
}
