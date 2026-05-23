'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getActiveCompanyId } from '@/lib/active-company-server'

type CreateBuildInput = {
  name: string
  description: string | null
  status: string
  progress_pct: number
  owner: string | null
  current_milestone: string | null
  started_at: string | null
  target_at: string | null
}

const VALID_STATUS = ['planned', 'building', 'testing', 'deploying', 'live', 'paused', 'failed']

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
  })

  if (insertErr) {
    return { ok: false, error: insertErr.message }
  }

  revalidatePath('/dashboard/build-tracker')
  return { ok: true }
}
