import Link from 'next/link'
import { ChevronLeft, Zap, AlertCircle, CheckCircle2, Euro } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { KpiStrip, type Kpi } from '@/components/executive/KpiStrip'
import type { ActivationRow, FirstEuroRow } from '@/lib/affiliate-programs/types'
import { mapActivationStatus } from '@/lib/affiliate-programs/types'
import ActivationTable from './ActivationTable'
import ManualRequiredCards, { type ManualAction } from './ManualRequiredCards'
import FirstEuroPanel from './FirstEuroPanel'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function AffiliateActivationPage() {
  const supabase = await createClient()

  const [{ data: rowsData }, { data: actionsData }, { data: firstEuro }] = await Promise.all([
    supabase
      .from('v_affiliate_activation_center')
      .select('*')
      .eq('is_priority', true)
      .order('revenue_potential', { ascending: false }),
    supabase
      .from('account_setup_human_actions')
      .select('id, program_id, run_id, action_kind, title, description, status, assigned_to, due_at, resolved_at, created_at, updated_at, metadata, program:affiliate_programs(name, url)')
      .in('status', ['open', 'in_progress'])
      .order('created_at', { ascending: false }),
    supabase.from('v_affiliate_first_euro').select('*').maybeSingle(),
  ])

  const rows = (rowsData ?? []) as ActivationRow[]
  const priorityIds = new Set(rows.map(r => r.id))
  const actions = ((actionsData ?? []) as unknown as ManualAction[])
    .filter(a => !a.program_id || priorityIds.has(a.program_id))
  const euro = (firstEuro ?? null) as FirstEuroRow | null

  const activeCount = rows.filter(r => mapActivationStatus(r.account_status, r.approval_status) === 'ACTIVE').length
  const pendingCount = rows.filter(r => ['PENDING', 'APPROVED'].includes(mapActivationStatus(r.account_status, r.approval_status))).length
  const manualCount = actions.length

  const kpis: Kpi[] = [
    { label: 'Programma’s', value: rows.length, accent: 'white', icon: <Zap size={13} /> },
    { label: 'Active', value: activeCount, accent: activeCount > 0 ? 'emerald' : 'white', icon: <CheckCircle2 size={13} /> },
    { label: 'In behandeling', value: pendingCount, accent: pendingCount > 0 ? 'amber' : 'white' },
    { label: 'Manual required', value: manualCount, accent: manualCount > 0 ? 'red' : 'white', icon: <AlertCircle size={13} /> },
    { label: 'Omzet', value: euro ? `€${Number(euro.revenue_eur).toLocaleString('nl-NL', { maximumFractionDigits: 0 })}` : '€0', accent: euro && Number(euro.revenue_eur) > 0 ? 'emerald' : 'white', icon: <Euro size={13} /> },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/account-setup" className="text-white/40 hover:text-white">
          <ChevronLeft size={16} />
        </Link>
        <div className="w-9 h-9 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
          <Zap size={16} className="text-violet-400" />
        </div>
        <div>
          <h1 className="text-base font-semibold text-white">Affiliate Activation Center</h1>
          <p className="text-xs text-white/50">Eén klik. Hermes activeert alles wat technisch kan — jij ziet alleen wat verplicht is.</p>
        </div>
      </div>

      <KpiStrip items={kpis} />

      {/* Fase 1 + 2 + 4: programma-tabel met ACTIVEER + GO LIVE */}
      <ActivationTable initialRows={rows} />

      {/* Fase 3: MANUAL REQUIRED */}
      <ManualRequiredCards initialActions={actions} />

      {/* Fase 6: Eerste euro */}
      <FirstEuroPanel initialRollup={euro} />
    </div>
  )
}
