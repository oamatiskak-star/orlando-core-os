import { ChevronLeft, KeyRound, Layers, Send, CheckCircle2, XCircle, Coins, Wallet, Clock, Flag, Hammer } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getActiveCompany, getActiveCompanyId } from '@/lib/active-company-server'
import { accountStatusBadge, fmtMoney, toMonthly, PLACEHOLDER } from '@/lib/account-setup'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type SetupRow = {
  id: string
  build_task_id: string
  platform_name: string | null
  account_type: string | null
  status: string
  milestone_id: string | null
  expected_revenue_model: string | null
  updated_at: string | null
  build_tracker: { name: string } | null
}

type RevenueRow = {
  account_setup_id: string
  expected_amount: number | null
  actual_amount: number | null
  currency: string
  payout_frequency: string | null
  payout_status: string | null
}

function fmtDateTime(s: string | null) {
  if (!s) return PLACEHOLDER
  return new Date(s).toLocaleString('nl-NL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export default async function AccountsDashboardPage() {
  const company = await getActiveCompany()
  const slug = await getActiveCompanyId()
  const supabase = await createClient()

  const { data: comp } = await supabase.from('companies').select('id').eq('slug', slug).maybeSingle()
  const companyDbId = comp?.id ?? null

  let setups: SetupRow[] = []
  if (companyDbId) {
    const { data } = await supabase
      .from('account_setups')
      .select('id, build_task_id, platform_name, account_type, status, milestone_id, expected_revenue_model, updated_at, build_tracker(name)')
      .eq('company_id', companyDbId)
      .order('updated_at', { ascending: false })
    setups = (data ?? []) as unknown as SetupRow[]
  }

  const setupIds = setups.map((s) => s.id)
  let revenues: RevenueRow[] = []
  if (setupIds.length) {
    const { data } = await supabase
      .from('account_revenues')
      .select('account_setup_id, expected_amount, actual_amount, currency, payout_frequency, payout_status')
      .in('account_setup_id', setupIds)
    revenues = (data ?? []) as RevenueRow[]
  }

  // ── KPI's ────────────────────────────────────────────────────────────────
  const countBy = (st: string) => setups.filter((s) => s.status === st).length
  const expectedMonthly = revenues.reduce((sum, r) => sum + toMonthly(r.expected_amount, r.payout_frequency), 0)
  const actualMonthly = revenues.reduce((sum, r) => sum + toMonthly(r.actual_amount, r.payout_frequency), 0)
  const openPayouts = revenues.filter((r) => r.payout_status === 'openstaand').length

  const kpis = [
    { label: 'Totaal accounts', value: String(setups.length), icon: Layers, color: company.color },
    { label: 'In voorbereiding', value: String(countBy('voorbereiden') + countBy('ontbrekende_gegevens') + countBy('klaar_voor_invoer')), icon: KeyRound, color: '#3b82f6' },
    { label: 'Ingediend', value: String(countBy('handmatig_ingediend') + countBy('wacht_op_goedkeuring')), icon: Send, color: '#06b6d4' },
    { label: 'Goedgekeurd / actief', value: String(countBy('actief')), icon: CheckCircle2, color: '#10b981' },
    { label: 'Afgewezen', value: String(countBy('afgewezen')), icon: XCircle, color: '#ef4444' },
    { label: 'Verwacht / maand', value: fmtMoney(expectedMonthly, 'EUR'), icon: Coins, color: '#a855f7' },
    { label: 'Werkelijk / maand', value: fmtMoney(actualMonthly, 'EUR'), icon: Wallet, color: '#22c55e' },
    { label: 'Openstaande payouts', value: String(openPayouts), icon: Clock, color: '#f59e0b' },
  ]

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/dashboard" className="text-white/40 hover:text-white/70">
          <ChevronLeft size={16} />
        </Link>
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ backgroundColor: `${company.color}1a`, border: `1px solid ${company.color}33`, color: company.color }}
        >
          <KeyRound size={16} />
        </div>
        <div className="flex-1">
          <h1 className="text-base font-semibold text-white">Account &amp; Affiliate Dashboard</h1>
          <p className="text-xs text-white/50">{company.name} — {setups.length} account{setups.length === 1 ? '' : 's'}</p>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {kpis.map((k) => (
          <div key={k.label} className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${k.color}1a`, color: k.color }}>
                <k.icon size={13} />
              </div>
            </div>
            <p className="text-lg font-semibold text-white leading-none">{k.value}</p>
            <p className="text-[10px] text-white/45 mt-1">{k.label}</p>
          </div>
        ))}
      </div>

      {/* Accounts lijst */}
      {setups.length === 0 ? (
        <div className="py-16 text-center bg-white/[0.02] border border-dashed border-white/10 rounded-xl">
          <KeyRound size={28} className="text-white/15 mx-auto mb-3" />
          <p className="text-[12px] text-white/40">Nog geen accounts voor {company.short}</p>
          <p className="text-[10px] text-white/25 mt-1">Markeer een Build Tracker-taak als &ldquo;vereist account-setup&rdquo; en klik op &ldquo;Maak account aan&rdquo;</p>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-[10px] text-white/35 uppercase tracking-wide">Laatste acties</p>
          {setups.map((s) => {
            const badge = accountStatusBadge(s.status)
            return (
              <Link
                key={s.id}
                href={`/dashboard/build-tracker/${s.build_task_id}/account-setup`}
                className="flex items-center justify-between gap-3 bg-white/[0.04] border border-white/[0.06] rounded-xl px-4 py-3 hover:bg-white/[0.06] transition-colors"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded ${badge.color}`}>{badge.label}</span>
                    <p className="text-[13px] text-white/90 font-medium truncate">{s.platform_name || PLACEHOLDER}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] text-white/45 mt-1">
                    <span className="flex items-center gap-1"><Hammer size={9} /> {s.build_tracker?.name || PLACEHOLDER}</span>
                    {s.milestone_id && <span className="flex items-center gap-1"><Flag size={9} /> {s.milestone_id}</span>}
                    <span>{s.account_type || PLACEHOLDER}</span>
                    <span>{s.expected_revenue_model || PLACEHOLDER}</span>
                    <span className="flex items-center gap-1"><Clock size={9} /> {fmtDateTime(s.updated_at)}</span>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
