import Link from 'next/link'
import { Layers, AlertCircle, Wallet, CheckCircle2, Clock, Zap } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getActiveCompany } from '@/lib/active-company-server'
import { KpiStrip, type Kpi } from '@/components/executive/KpiStrip'
import { CategoryBadge } from '@/lib/affiliate-programs/badges'
import {
  CATEGORY_LABEL,
  type ProgramOverviewRow,
  type ProgramCategory,
} from '@/lib/affiliate-programs/types'
import { AFFILIATE_SETUP } from '@/lib/affiliate-programs/setup-data'
import { ProgramSetupCard } from './ProgramSetupCard'
import { SharedRegistrationCard } from './SharedRegistrationCard'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const CATEGORY_ORDER: ProgramCategory[] = ['saas_ai', 'finance_crypto', 'vastgoed_data', 'automation', 'productivity', 'affiliate_network', 'other']

function fmtMoney(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

export default async function AccountSetupHubPage() {
  const company = await getActiveCompany()
  const supabase = await createClient()

  const companyRow = await supabase.from('companies').select('id').eq('slug', company.id).maybeSingle()
  const companyId = companyRow.data?.id ?? null

  const base = supabase
    .from('v_affiliate_program_overview')
    .select('id, company_id, name, category, account_status, login_status, recurring, monthly_revenue, lifetime_revenue, affiliate_link, next_action_at, open_human_actions, required_docs, active_runs')

  const query = companyId
    ? base.or(`company_id.eq.${companyId},company_id.is.null`)
    : base.is('company_id', null)

  const { data } = await query.order('name', { ascending: true })
  const programs: ProgramOverviewRow[] = (data ?? []) as ProgramOverviewRow[]

  const total = programs.length
  const activeCount = programs.filter(p => p.account_status === 'active' || p.account_status === 'payout_active').length
  const pendingCount = programs.filter(p => p.account_status === 'applied' || p.account_status === 'pending').length
  const openActions = programs.reduce((acc, p) => acc + (p.open_human_actions ?? 0), 0)
  const monthlyRevenue = programs.reduce((acc, p) => acc + Number(p.monthly_revenue ?? 0), 0)

  const kpis: Kpi[] = [
    { label: 'Programma’s', value: total, accent: 'white' },
    { label: 'Active / payout', value: activeCount, accent: activeCount > 0 ? 'emerald' : 'white', icon: <CheckCircle2 size={13} /> },
    { label: 'Pending', value: pendingCount, accent: pendingCount > 0 ? 'amber' : 'white', icon: <Clock size={13} /> },
    { label: 'Requires action', value: openActions, accent: openActions > 0 ? 'red' : 'white', icon: <AlertCircle size={13} /> },
    { label: 'MRR (commission)', value: fmtMoney(monthlyRevenue), accent: monthlyRevenue > 0 ? 'emerald' : 'white', icon: <Wallet size={13} /> },
  ]

  const byCategory = CATEGORY_ORDER
    .map(cat => ({ cat, items: programs.filter(p => p.category === cat) }))
    .filter(g => g.items.length > 0)

  return (
    <div className="space-y-5">
      <KpiStrip items={kpis} />

      <Link
        href="/dashboard/account-setup/activation"
        className="flex items-center justify-between gap-3 rounded-xl border border-violet-500/25 bg-violet-500/[0.08] px-4 py-3 hover:bg-violet-500/[0.14] transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <Zap size={16} className="text-violet-300" />
          <div>
            <p className="text-[13px] font-semibold text-white">Affiliate Activation Center</p>
            <p className="text-[10px] text-white/50">Eén klik — Hermes activeert alles wat technisch kan. Prioriteit: xTool, Bambu, Amazon, TradingView, Binance, HubSpot.</p>
          </div>
        </div>
        <span className="text-[11px] text-violet-200/80">Openen →</span>
      </Link>

      <SharedRegistrationCard />

      {total === 0 ? (
        <div className="bg-white/[0.04] rounded-xl border border-white/[0.06] py-12 text-center">
          <Layers size={24} className="text-white/15 mx-auto mb-3" />
          <p className="text-[12px] text-white/50">Nog geen affiliate-programma&apos;s voor {company.short}</p>
          <p className="text-[10px] text-white/30 mt-1">
            De registry wordt geseed via migratie 100 (company: modiwerijo).
          </p>
        </div>
      ) : (
        byCategory.map(({ cat, items }) => (
          <div key={cat} className="bg-white/[0.04] rounded-xl border border-white/[0.06] p-4">
            <div className="flex items-center justify-between mb-3">
              <CategoryBadge category={cat} label={CATEGORY_LABEL[cat]} size="sm" />
              <span className="text-[10px] text-white/40 tabular-nums">{items.length} programma{items.length === 1 ? '' : '’s'}</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {items.map((p) => (
                <ProgramSetupCard
                  key={p.id}
                  program={p}
                  setup={AFFILIATE_SETUP[p.name] ?? null}
                  detailHref={`/dashboard/account-setup/accounts?focus=${p.id}`}
                />
              ))}
            </div>
          </div>
        ))
      )}

      <p className="text-[10px] text-white/30">
        Volgende fases: Revenue dashboard (F2) · KYC/Verification (F2) · Automation queue (F3) · YouTube + Aquier connectors (F4).
        Beheer programma&apos;s via <Link href="/dashboard/account-setup/accounts" className="text-white/50 underline">Accounts</Link>.
      </p>
    </div>
  )
}
