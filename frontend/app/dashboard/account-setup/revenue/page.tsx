import { Wallet, TrendingUp, Repeat, Trophy } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getActiveCompany } from '@/lib/active-company-server'
import { KpiStrip, type Kpi } from '@/components/executive/KpiStrip'
import { CategoryBadge } from '@/lib/affiliate-programs/badges'
import { addRevenueEntry } from '../actions'
import { CATEGORY_LABEL, type AffiliateProgramRow, type RevenueLedgerRow } from '@/lib/affiliate-programs/types'

export const dynamic = 'force-dynamic'
export const revalidate = 0

function fmtUsd(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}
function fmtMonth(d: string): string {
  return new Date(d).toLocaleDateString('nl-NL', { month: 'short', year: '2-digit' })
}
function currentMonth(): string {
  return new Date().toISOString().slice(0, 7)
}

type ProgRev = Pick<AffiliateProgramRow, 'id' | 'name' | 'category' | 'monthly_revenue' | 'lifetime_revenue' | 'recurring'>

export default async function RevenuePage() {
  const company = await getActiveCompany()
  const supabase = await createClient()
  const companyRow = await supabase.from('companies').select('id').eq('slug', company.id).maybeSingle()
  const companyId = companyRow.data?.id ?? null

  let progQuery = supabase
    .from('affiliate_programs')
    .select('id, name, category, monthly_revenue, lifetime_revenue, recurring')
  progQuery = companyId ? progQuery.or(`company_id.eq.${companyId},company_id.is.null`) : progQuery.is('company_id', null)
  const { data: progData } = await progQuery.order('monthly_revenue', { ascending: false }).order('name')
  const programs: ProgRev[] = (progData ?? []) as ProgRev[]
  const programIds = programs.map(p => p.id)

  const { data: ledgerData } = programIds.length
    ? await supabase
        .from('affiliate_revenue_ledger')
        .select('id, program_id, period_month, gross_revenue, commission_revenue, currency, source, recorded_at')
        .in('program_id', programIds)
        .order('period_month', { ascending: false })
        .limit(50)
    : { data: [] }
  const ledger: RevenueLedgerRow[] = (ledgerData ?? []) as RevenueLedgerRow[]
  const nameById = new Map(programs.map(p => [p.id, p.name]))

  const mrr = programs.reduce((a, p) => a + Number(p.monthly_revenue ?? 0), 0)
  const lifetime = programs.reduce((a, p) => a + Number(p.lifetime_revenue ?? 0), 0)
  const recurringCount = programs.filter(p => p.recurring === true).length
  const top = programs.find(p => Number(p.monthly_revenue) > 0)

  const kpis: Kpi[] = [
    { label: 'MRR (commission)', value: fmtUsd(mrr), accent: mrr > 0 ? 'emerald' : 'white', icon: <Wallet size={13} /> },
    { label: 'Lifetime revenue', value: fmtUsd(lifetime), accent: 'violet', icon: <TrendingUp size={13} /> },
    { label: 'Recurring programs', value: recurringCount, accent: recurringCount > 0 ? 'indigo' : 'white', icon: <Repeat size={13} /> },
    { label: 'Top programma', value: top ? top.name : '—', hint: top ? fmtUsd(Number(top.monthly_revenue)) + '/mo' : 'nog geen omzet', accent: 'amber', icon: <Trophy size={13} /> },
  ]

  const withRevenue = programs.filter(p => Number(p.monthly_revenue) > 0 || Number(p.lifetime_revenue) > 0)

  return (
    <div className="space-y-5">
      <KpiStrip items={kpis} />

      {/* Revenue per programma */}
      <div className="bg-white/[0.04] rounded-xl border border-white/[0.06] p-4">
        <h2 className="text-xs font-medium text-white/70 mb-3">Revenue per programma</h2>
        {withRevenue.length === 0 ? (
          <p className="py-6 text-center text-[11px] text-white/40">Nog geen geboekte omzet. Boek hieronder een maand-entry.</p>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="text-left text-[9px] uppercase tracking-wide text-white/35">
                <th className="pb-2 font-medium">Programma</th>
                <th className="pb-2 font-medium">Categorie</th>
                <th className="pb-2 font-medium text-right">MRR</th>
                <th className="pb-2 font-medium text-right">Lifetime</th>
              </tr>
            </thead>
            <tbody>
              {withRevenue.map(p => (
                <tr key={p.id} className="border-t border-white/[0.04]">
                  <td className="py-2 text-[12px] text-white/90">{p.name}</td>
                  <td className="py-2"><CategoryBadge category={p.category} label={CATEGORY_LABEL[p.category]} size="xs" /></td>
                  <td className="py-2 text-right text-[11px] tabular-nums text-emerald-300/90">{fmtUsd(Number(p.monthly_revenue))}</td>
                  <td className="py-2 text-right text-[11px] tabular-nums text-white/70">{fmtUsd(Number(p.lifetime_revenue))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Maand-entry boeken */}
      <details className="bg-white/[0.04] rounded-xl border border-white/[0.06] p-4">
        <summary className="text-[11px] text-white/70 cursor-pointer select-none">+ Revenue boeken (maand-entry)</summary>
        <form action={addRevenueEntry} className="mt-3 grid grid-cols-1 sm:grid-cols-5 gap-2 text-[11px]">
          <select name="program_id" required className="bg-white/[0.04] border border-white/10 rounded px-2 py-1.5 text-white/85 sm:col-span-2">
            {programs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <input name="period_month" type="month" defaultValue={currentMonth()} required className="bg-white/[0.04] border border-white/10 rounded px-2 py-1.5 text-white/85" />
          <input name="gross_revenue" type="number" step="0.01" min="0" placeholder="Bruto" className="bg-white/[0.04] border border-white/10 rounded px-2 py-1.5 text-white/85" />
          <input name="commission_revenue" type="number" step="0.01" min="0" placeholder="Commissie" required className="bg-white/[0.04] border border-white/10 rounded px-2 py-1.5 text-white/85" />
          <input type="hidden" name="currency" value="USD" />
          <button type="submit" className="px-2.5 py-1.5 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-400/30 rounded text-emerald-200 sm:col-span-5">
            Boeken (herberekent MRR + lifetime via DB-trigger)
          </button>
        </form>
      </details>

      {/* Ledger */}
      <div className="bg-white/[0.04] rounded-xl border border-white/[0.06] p-4">
        <h2 className="text-xs font-medium text-white/70 mb-3">Revenue ledger</h2>
        {ledger.length === 0 ? (
          <p className="py-6 text-center text-[11px] text-white/40">Nog geen ledger-entries.</p>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="text-left text-[9px] uppercase tracking-wide text-white/35">
                <th className="pb-2 font-medium">Maand</th>
                <th className="pb-2 font-medium">Programma</th>
                <th className="pb-2 font-medium text-right">Bruto</th>
                <th className="pb-2 font-medium text-right">Commissie</th>
                <th className="pb-2 font-medium">Bron</th>
              </tr>
            </thead>
            <tbody>
              {ledger.map(l => (
                <tr key={l.id} className="border-t border-white/[0.04]">
                  <td className="py-1.5 text-[11px] text-white/70 tabular-nums">{fmtMonth(l.period_month)}</td>
                  <td className="py-1.5 text-[11px] text-white/80">{nameById.get(l.program_id) ?? '—'}</td>
                  <td className="py-1.5 text-right text-[11px] tabular-nums text-white/60">{Number(l.gross_revenue).toLocaleString('en-US', { style: 'currency', currency: l.currency || 'USD', maximumFractionDigits: 0 })}</td>
                  <td className="py-1.5 text-right text-[11px] tabular-nums text-emerald-300/90">{Number(l.commission_revenue).toLocaleString('en-US', { style: 'currency', currency: l.currency || 'USD', maximumFractionDigits: 0 })}</td>
                  <td className="py-1.5 text-[10px] text-white/40 font-mono">{l.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
