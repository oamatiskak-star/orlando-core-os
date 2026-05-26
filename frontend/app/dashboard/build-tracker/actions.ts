'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getActiveCompanyId } from '@/lib/active-company-server'

type AccountConfig = {
  requires_account_setup?: boolean
  account_platform?: string | null
  account_type?: string | null
  expected_revenue_model?: string | null
  expected_revenue_amount?: number | null
  revenue_currency?: string | null
}

type CreateBuildInput = {
  name: string
  description: string | null
  status: string
  progress_pct: number
  owner: string | null
  current_milestone: string | null
  started_at: string | null
  target_at: string | null
} & AccountConfig

const VALID_STATUS = ['planned', 'building', 'testing', 'deploying', 'live', 'paused', 'failed']

// Vertaalt account-config velden naar een DB-patch. Pure helper, geen status-trigger:
// het aanmaken van het account gebeurt alleen via de expliciete "Maak account aan"-actie.
function accountConfigPatch(input: AccountConfig): Record<string, unknown> {
  const patch: Record<string, unknown> = {}
  if (input.requires_account_setup !== undefined) patch.requires_account_setup = !!input.requires_account_setup
  if (input.account_platform !== undefined) patch.account_platform = input.account_platform?.toString().trim() || null
  if (input.account_type !== undefined) patch.account_type = input.account_type?.toString().trim() || null
  if (input.expected_revenue_model !== undefined) patch.expected_revenue_model = input.expected_revenue_model?.toString().trim() || null
  if (input.expected_revenue_amount !== undefined) {
    const n = Number(input.expected_revenue_amount)
    patch.expected_revenue_amount = Number.isFinite(n) && input.expected_revenue_amount !== null ? n : null
  }
  if (input.revenue_currency !== undefined) patch.revenue_currency = input.revenue_currency?.toString().trim() || 'EUR'
  return patch
}

export async function createBuild(input: CreateBuildInput) {
  const name = (input.name ?? '').trim()
  if (!name) return { ok: false, error: 'Naam is verplicht' }

  const status = VALID_STATUS.includes(input.status) ? input.status : 'planned'
  const progress = Math.max(0, Math.min(100, Number(input.progress_pct) || 0))

  const slug = await getActiveCompanyId()
  const supabase = await createClient()

  const { data: company, error: companyErr } = await supabase
    .from('companies')
    .select('id')
    .eq('slug', slug)
    .single()

  if (companyErr || !company) {
    return { ok: false, error: `Company niet gevonden voor slug "${slug}"` }
  }

  const { error: insertErr } = await supabase.from('build_tracker').insert({
    company_id: company.id,
    name,
    description: input.description?.trim() || null,
    status,
    progress_pct: progress,
    owner: input.owner?.trim() || null,
    current_milestone: input.current_milestone?.trim() || null,
    started_at: input.started_at || null,
    target_at: input.target_at || null,
    ...accountConfigPatch(input),
  })

  if (insertErr) {
    return { ok: false, error: insertErr.message }
  }

  revalidatePath('/dashboard/build-tracker')
  return { ok: true }
}

type UpdateBuildInput = {
  id: string
  status?: string
  progress_pct?: number
  current_milestone?: string | null
  description?: string | null
  target_at?: string | null
  owner?: string | null
} & AccountConfig

export async function updateBuild(input: UpdateBuildInput) {
  const id = (input.id ?? '').trim()
  if (!id) return { ok: false, error: 'Build id ontbreekt' }

  const patch: Record<string, unknown> = {
    last_update_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  if (input.status !== undefined) {
    if (!VALID_STATUS.includes(input.status)) return { ok: false, error: `Ongeldige status "${input.status}"` }
    patch.status = input.status
  }
  if (input.progress_pct !== undefined) {
    patch.progress_pct = Math.max(0, Math.min(100, Number(input.progress_pct) || 0))
  }
  if (input.current_milestone !== undefined) patch.current_milestone = input.current_milestone?.trim() || null
  if (input.description !== undefined) patch.description = input.description?.trim() || null
  if (input.owner !== undefined) patch.owner = input.owner?.trim() || null
  if (input.target_at !== undefined) patch.target_at = input.target_at || null
  Object.assign(patch, accountConfigPatch(input))

  const supabase = await createClient()
  const { error } = await supabase.from('build_tracker').update(patch).eq('id', id)
  if (error) return { ok: false, error: error.message }

  revalidatePath('/dashboard/build-tracker')
  revalidatePath(`/dashboard/build-tracker/${id}`)
  return { ok: true }
}

// "Ga verder" — markeer een build als actief (building) zodat hij bovenaan komt
// en de voortgang doorloopt. Pure status-overgang, geen autonome agent-trigger.
export async function resumeBuild(id: string) {
  if (!id) return { ok: false, error: 'Build id ontbreekt' }
  const supabase = await createClient()
  const { error } = await supabase
    .from('build_tracker')
    .update({ status: 'building', last_update_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', id)
    .neq('status', 'live')
  if (error) return { ok: false, error: error.message }
  revalidatePath('/dashboard/build-tracker')
  revalidatePath(`/dashboard/build-tracker/${id}`)
  return { ok: true }
}
