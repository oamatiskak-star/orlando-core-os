import Link from 'next/link'
import { TrendingUp, TrendingDown, CheckCircle2, AlertTriangle, Clock, ExternalLink, Target, Banknote, Users } from 'lucide-react'

export const dynamic = 'force-dynamic'

const SB  = () => process.env.NEXT_PUBLIC_SUPABASE_URL!
const SVC = () => process.env.SUPABASE_SERVICE_ROLE_KEY!
const HDR = () => ({
  apikey: SVC(),
  Authorization: `Bearer ${SVC()}`,
  'Accept-Profile': 'vastgoed_core',
  Accept: 'application/json',
})

type ForecastRow = {
  scenario: 'P10' | 'P50' | 'P90'
  month_index: number
  month_start: string
  forecast_cum_paid: number
  forecast_mrr_eur: number
  forecast_cumulative_revenue_eur: number
  forecast_pay_per_report_eur: number
  forecast_deal_fees_eur: number
  actual_cum_paid: number
  actual_mrr_eur: number
  actual_pay_per_report_eur: number
  actual_deal_fees_eur: number
  actual_total_revenue_eur: number
  variance_cum_paid: number
  variance_mrr_eur: number
  variance_mrr_pct: number
  status_flag: 'future' | 'on_track' | 'at_risk' | 'off_track'
}

async function fetchForecast(scenario: string): Promise<ForecastRow[]> {
  try {
    const params = new URLSearchParams({
      select:
        'scenario,month_index,month_start,forecast_cum_paid,forecast_mrr_eur,forecast_cumulative_revenue_eur,forecast_pay_per_report_eur,forecast_deal_fees_eur,actual_cum_paid,actual_mrr_eur,actual_pay_per_report_eur,actual_deal_fees_eur,actual_total_revenue_eur,variance_cum_paid,variance_mrr_eur,variance_mrr_pct,status_flag',
      scenario: `eq.${scenario}`,
      country_code: 'eq.nl',
      order: 'month_index.asc',
    })
    const res = await fetch(
      `${SB()}/rest/v1/v_aquier_forecast_vs_actual?${params}`,
      { headers: HDR(), cache: 'no-store', next: { revalidate: 60 } }
    )
    if (!res.ok) return []
    return await res.json()
  } catch {
    return []
  }
}

function fmtEur(n: number): string {
  if (!n || n === 0) return '—'
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)
}

function fmtPct(n: number): string {
  if (!n || n === 0) return '—'
  const sign = n > 0 ? '+' : ''
  return `${sign}${n.toFixed(1)}%`
}

function fmtMonth(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('nl-NL', { month: 'short', year: 'numeric' })
}

const STATUS_STYLE = {
  on_track:  { wrap: 'border-emerald-500/30 bg-emerald-500/[0.07]', badge: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30', label: 'On track',  Icon: CheckCircle2 },
  at_risk:   { wrap: 'border-amber-500/30   bg-amber-500/[0.07]',   badge: 'bg-amber-500/15   text-amber-400   border-amber-500/30',   label: 'At risk',   Icon: AlertTriangle },
  off_track: { wrap: 'border-red-500/30     bg-red-500/[0.07]',     badge: 'bg-red-500/15     text-red-400     border-red-500/30',     label: 'Off track', Icon: TrendingDown },
  future:    { wrap: 'border-white/10        bg-white/[0.03]',        badge: 'bg-white/5         text-white/40    border-white/10',         label: 'Toekomst',  Icon: Clock },
}

export default async function AquierForecastPage({ searchParams }: { searchParams: Promise<{ scenario?: string }> }) {
  const params = await searchParams
  const scenario = (['P10', 'P50', 'P90'].includes(params.scenario ?? '') ? params.scenario : 'P50') as 'P10' | 'P50' | 'P90'
  const rows = await fetchForecast(scenario)

  const today = new Date().toISOString().slice(0, 10)
  const pastRows    = rows.filter((r) => r.month_start <= today)
  const futureRows  = rows.filter((r) => r.month_start > today)
  const m12         = rows.find((r) => r.month_index === 12)
  const currentRow  = pastRows[pastRows.length - 1] ?? rows[0]
  const totalActual = pastRows.reduce((s, r) => s + r.actual_total_revenue_eur, 0)
  const yearForecast = m12?.forecast_cumulative_revenue_eur ?? 0
  const yearProgress = yearForecast > 0 ? Math.min(100, Math.round((totalActual / yearForecast) * 100)) : 0
  const status = currentRow?.status_flag ?? 'future'
  const statusStyle = STATUS_STYLE[status]
  const StatusIcon = statusStyle.Icon

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <div className="max-w-7xl mx-auto px-6 py-10">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-white/40 mb-2">
              Aquier ecosystem · Marketing Agent NL
            </div>
            <h1 className="text-3xl font-bold">Aquier Forecast — {scenario}</h1>
            <p className="text-white/50 mt-1 text-sm">Live forecast vs actuals. NL only. Pricing v3.</p>
          </div>
          <div className="flex items-center gap-2">
            {(['P10', 'P50', 'P90'] as const).map((s) => (
              <Link
                key={s}
                href={`/dashboard/aquier-forecast?scenario=${s}`}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  s === scenario
                    ? 'bg-white text-black'
                    : 'bg-white/5 text-white/60 border border-white/10 hover:bg-white/10'
                }`}
              >
                {s === 'P10' ? 'Conservatief' : s === 'P50' ? 'Plan' : 'Stretch'}
              </Link>
            ))}
            <a
              href="https://aquier.com/admin/forecast"
              target="_blank"
              rel="noreferrer"
              className="ml-3 inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium bg-violet-500/15 text-violet-300 border border-violet-500/30 hover:bg-violet-500/25"
            >
              Full dashboard <ExternalLink size={12} />
            </a>
          </div>
        </div>

        {/* KPI strip */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className={`p-5 rounded-lg border ${statusStyle.wrap}`}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs uppercase tracking-widest text-white/40">Huidige maand</span>
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium border ${statusStyle.badge}`}>
                <StatusIcon size={10} />
                {statusStyle.label}
              </span>
            </div>
            <p className="text-2xl font-bold">{currentRow ? fmtMonth(currentRow.month_start) : '—'}</p>
            <p className="text-xs text-white/50 mt-1">MRR variance {currentRow ? fmtPct(currentRow.variance_mrr_pct) : '—'}</p>
          </div>

          <div className="p-5 rounded-lg border border-white/10 bg-white/[0.03]">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs uppercase tracking-widest text-white/40">Year-1 doel</span>
              <Target size={14} className="text-white/40" />
            </div>
            <p className="text-2xl font-bold">{fmtEur(yearForecast)}</p>
            <p className="text-xs text-white/50 mt-1">cum. revenue M12 ({scenario})</p>
          </div>

          <div className="p-5 rounded-lg border border-white/10 bg-white/[0.03]">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs uppercase tracking-widest text-white/40">Actual tot nu</span>
              <Banknote size={14} className="text-white/40" />
            </div>
            <p className="text-2xl font-bold">{fmtEur(totalActual)}</p>
            <div className="mt-2 h-1.5 rounded-full bg-white/5 overflow-hidden">
              <div className="h-full bg-emerald-500/60" style={{ width: `${yearProgress}%` }} />
            </div>
            <p className="text-[10px] text-white/40 mt-1">{yearProgress}% van year-1 doel</p>
          </div>

          <div className="p-5 rounded-lg border border-white/10 bg-white/[0.03]">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs uppercase tracking-widest text-white/40">M12 klanten doel</span>
              <Users size={14} className="text-white/40" />
            </div>
            <p className="text-2xl font-bold">{m12?.forecast_cum_paid?.toLocaleString('nl-NL') ?? '—'}</p>
            <p className="text-xs text-white/50 mt-1">cumulatief paid customers</p>
          </div>
        </div>

        {/* Compacte forecast tabel */}
        <div className="rounded-lg border border-white/10 bg-white/[0.02] overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-xs uppercase tracking-wider text-white/40">
                <th className="text-left py-3 px-4 font-medium">Maand</th>
                <th className="text-right py-3 px-4 font-medium">Cum. paid plan</th>
                <th className="text-right py-3 px-4 font-medium">Cum. paid actual</th>
                <th className="text-right py-3 px-4 font-medium">Δ klanten</th>
                <th className="text-right py-3 px-4 font-medium">MRR plan</th>
                <th className="text-right py-3 px-4 font-medium">MRR actual</th>
                <th className="text-right py-3 px-4 font-medium">Δ MRR%</th>
                <th className="text-center py-3 px-4 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-white/30">
                    Geen forecast data — voer migratie 049 uit op Supabase + verifieer view{' '}
                    <code className="text-xs bg-white/5 border border-white/10 rounded px-1 py-0.5">vastgoed_core.v_aquier_forecast_vs_actual</code>.
                  </td>
                </tr>
              ) : (
                rows.map((r) => {
                  const sty = STATUS_STYLE[r.status_flag]
                  return (
                    <tr key={r.month_index} className="border-b border-white/5 hover:bg-white/[0.02]">
                      <td className="py-2.5 px-4 font-medium">
                        M{r.month_index} <span className="text-white/40 text-xs">· {fmtMonth(r.month_start)}</span>
                      </td>
                      <td className="text-right py-2.5 px-4 text-white/70">{r.forecast_cum_paid.toLocaleString('nl-NL')}</td>
                      <td className="text-right py-2.5 px-4 font-medium">
                        {r.status_flag === 'future' ? '—' : r.actual_cum_paid.toLocaleString('nl-NL')}
                      </td>
                      <td className="text-right py-2.5 px-4">
                        {r.status_flag === 'future' ? (
                          <span className="text-white/30">—</span>
                        ) : (
                          <span className={r.variance_cum_paid >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                            {r.variance_cum_paid >= 0 ? '+' : ''}{r.variance_cum_paid}
                          </span>
                        )}
                      </td>
                      <td className="text-right py-2.5 px-4 text-white/70">{fmtEur(r.forecast_mrr_eur)}</td>
                      <td className="text-right py-2.5 px-4 font-medium">
                        {r.status_flag === 'future' ? '—' : fmtEur(r.actual_mrr_eur)}
                      </td>
                      <td className="text-right py-2.5 px-4">
                        {r.status_flag === 'future' ? (
                          <span className="text-white/30">—</span>
                        ) : (
                          <span className={r.variance_mrr_pct >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                            {fmtPct(r.variance_mrr_pct)}
                          </span>
                        )}
                      </td>
                      <td className="text-center py-2.5 px-4">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium border ${sty.badge}`}>
                          <sty.Icon size={10} />
                          {sty.label}
                        </span>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Methodiek-card */}
        <div className="mt-8 rounded-lg border border-white/10 bg-white/[0.02] p-6">
          <h3 className="font-semibold text-white mb-2">Bron + methodiek</h3>
          <p className="text-sm text-white/60 leading-relaxed mb-3">
            Forecast volgt Marketing Agent NL v1-baseline (2026-05-21). ARPU mature mix €403,60. Tier-mix Scout 15% /
            Developer 75% / Institutional 10%. Trial-to-paid 35-40%. Churn 4%/mnd vanaf M3.
          </p>
          <p className="text-sm text-white/60 leading-relaxed mb-3">
            Status flag op MRR variance: <span className="text-emerald-400">on track</span> ≥95% van plan,{' '}
            <span className="text-amber-400">at risk</span> 80-95%, <span className="text-red-400">off track</span> &lt;80%.
          </p>
          <p className="text-xs text-white/40">
            Forecast wordt opnieuw geseed bij elke Marketing Agent NL-run (wekelijks maandag 06:00). Volledig dashboard
            met tier-mix, reports, deal fees en pricing-context op{' '}
            <a href="https://aquier.com/admin/forecast" className="text-violet-400 underline" target="_blank" rel="noreferrer">
              aquier.com/admin/forecast
            </a>
            .
          </p>
        </div>
      </div>
    </div>
  )
}
