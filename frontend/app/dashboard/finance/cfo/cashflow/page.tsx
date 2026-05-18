import { createClient } from '@/lib/supabase/server'
import { BarChart3, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react'

function fmt(n: number) {
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)
}

export default async function CashflowPage() {
  const supabase = await createClient()
  const now      = new Date()
  const today    = now.toISOString().split('T')[0]
  const in90     = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  const [{ data: forecasts }, { data: openInvoices }, { data: subscriptions }] = await Promise.all([
    supabase.from('cfo_cashflow_forecast')
      .select('*')
      .gte('forecast_date', today)
      .lte('forecast_date', in90)
      .order('forecast_date', { ascending: true }),
    supabase.from('fin_invoices')
      .select('company_id, amount_incl, due_date, status, days_overdue, customer:fin_customers(name)')
      .in('status', ['open', 'vervallen'])
      .order('due_date', { ascending: true })
      .limit(20),
    supabase.from('cfo_subscriptions')
      .select('name, amount_monthly, billing_cycle, next_billing_date, category')
      .eq('is_active', true)
      .order('amount_monthly', { ascending: false })
      .limit(15),
  ])

  const totalOpenInvoices = (openInvoices ?? []).reduce((s, i) => s + i.amount_incl, 0)
  const totalSubCosts     = (subscriptions ?? []).reduce((s, s2) => s + s2.amount_monthly, 0)

  const riskDates = (forecasts ?? []).filter(f => f.risk_flag)

  // Groupeer forecasts per week
  const weeklyData: { week: string; in: number; out: number; balance: number }[] = []
  const weeks: Record<string, { in: number; out: number; balance: number }> = {}
  for (const f of (forecasts ?? [])) {
    const d   = new Date(f.forecast_date)
    const mon = new Date(d)
    mon.setDate(d.getDate() - d.getDay() + 1)
    const key = mon.toISOString().split('T')[0]
    if (!weeks[key]) weeks[key] = { in: 0, out: 0, balance: f.opening_balance ?? 0 }
    weeks[key].in  += f.expected_in  ?? 0
    weeks[key].out += f.expected_out ?? 0
  }
  for (const [week, data] of Object.entries(weeks).sort()) {
    weeklyData.push({ week, ...data })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-base font-semibold text-white flex items-center gap-2">
          <BarChart3 size={16} className="text-blue-400" />
          Cashflow Prognose
        </h1>
        <p className="text-xs text-white/50 mt-0.5">90 dagenanalyse — inkomsten, uitgaven en risicomomenten</p>
      </div>

      {/* Risico alerts */}
      {riskDates.length > 0 && (
        <div className="space-y-2">
          {riskDates.map(r => (
            <div key={r.id} className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 flex items-center gap-2">
              <AlertTriangle size={13} className="text-red-400 flex-shrink-0" />
              <p className="text-xs text-red-400">
                Cashflow risicomoment op <strong>{r.forecast_date}</strong> — Verwacht saldo: <strong>{fmt(r.closing_balance)}</strong>
                {r.risk_reason && ` — ${r.risk_reason}`}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Te ontvangen (30d)', value: fmt(totalOpenInvoices * 0.7), icon: TrendingUp, color: 'text-green-400', bg: 'bg-green-500/10' },
          { label: 'Vaste lasten/maand', value: fmt(totalSubCosts),           icon: TrendingDown, color: 'text-red-400',   bg: 'bg-red-500/10' },
          { label: 'Open facturen',      value: fmt(totalOpenInvoices),        icon: BarChart3,    color: 'text-amber-400', bg: 'bg-amber-500/10' },
          { label: 'Risicomomenten',     value: String(riskDates.length),      icon: AlertTriangle, color: riskDates.length > 0 ? 'text-red-400' : 'text-green-400', bg: riskDates.length > 0 ? 'bg-red-500/10' : 'bg-green-500/10' },
        ].map(c => (
          <div key={c.label} className="bg-white/[0.06] border border-white/5 rounded-xl p-4">
            <div className={`w-7 h-7 rounded-lg ${c.bg} flex items-center justify-center mb-2`}>
              <c.icon size={13} className={c.color} />
            </div>
            <p className="text-[10px] text-white/50 uppercase tracking-wider mb-1">{c.label}</p>
            <p className={`text-lg font-bold ${c.color}`}>{c.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Openstaande facturen */}
        <div className="bg-white/[0.06] border border-white/5 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-white/5">
            <h3 className="text-xs font-semibold text-white">Verwachte Inkomsten</h3>
          </div>
          {(openInvoices ?? []).length === 0 ? (
            <p className="text-xs text-white/40 p-5 text-center">Geen open facturen</p>
          ) : (
            <table className="w-full">
              <thead>
                <tr>
                  {['Klant','Bedrag','Vervaldatum','Status'].map(h => (
                    <th key={h} className="text-left text-[10px] font-medium text-white/50 uppercase tracking-wider px-4 py-2">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {(openInvoices ?? []).slice(0, 10).map(inv => (
                  <tr key={inv.amount_incl + inv.due_date}>
                    <td className="px-4 py-2.5 text-xs text-white/70 truncate max-w-[140px]">
                      {(inv.customer as { name?: string } | null)?.name ?? 'Onbekend'}
                    </td>
                    <td className="px-4 py-2.5 text-xs font-semibold text-white">{fmt(inv.amount_incl)}</td>
                    <td className="px-4 py-2.5 text-xs text-white/60">{inv.due_date ?? '—'}</td>
                    <td className="px-4 py-2.5">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                        inv.status === 'vervallen' ? 'bg-red-500/10 text-red-400' : 'bg-amber-500/10 text-amber-400'
                      }`}>{inv.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Vaste lasten */}
        <div className="bg-white/[0.06] border border-white/5 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
            <h3 className="text-xs font-semibold text-white">Vaste Lasten & Abonnementen</h3>
            <span className="text-xs text-red-400 font-semibold">{fmt(totalSubCosts)}/mnd</span>
          </div>
          {(subscriptions ?? []).length === 0 ? (
            <p className="text-xs text-white/40 p-5 text-center">Geen abonnementen gedetecteerd. Voer een sync uit.</p>
          ) : (
            <div className="divide-y divide-white/5">
              {(subscriptions ?? []).slice(0, 12).map((sub, i) => (
                <div key={i} className="flex items-center justify-between px-4 py-2.5">
                  <div>
                    <p className="text-xs text-white/80">{sub.name}</p>
                    <p className="text-[10px] text-white/40">{sub.category} · {sub.billing_cycle}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-semibold text-red-400">{fmt(sub.amount_monthly)}/mnd</p>
                    {sub.next_billing_date && (
                      <p className="text-[10px] text-white/40">Volgende: {sub.next_billing_date}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Weekoverzicht */}
      {weeklyData.length > 0 && (
        <div className="bg-white/[0.06] border border-white/5 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-white/5">
            <h3 className="text-xs font-semibold text-white">90-dagen Weekoverzicht</h3>
          </div>
          <table className="w-full">
            <thead>
              <tr>
                {['Week','Verwacht in','Verwacht uit','Netto','Saldo'].map(h => (
                  <th key={h} className="text-left text-[10px] font-medium text-white/50 uppercase tracking-wider px-4 py-2">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {weeklyData.slice(0, 13).map(w => {
                const net = w.in - w.out
                return (
                  <tr key={w.week}>
                    <td className="px-4 py-2.5 text-xs text-white/60">
                      Week {new Date(w.week).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-green-400">{fmt(w.in)}</td>
                    <td className="px-4 py-2.5 text-xs text-red-400">{fmt(w.out)}</td>
                    <td className="px-4 py-2.5">
                      <span className={`text-xs font-medium ${net >= 0 ? 'text-green-400' : 'text-red-400'}`}>{fmt(net)}</span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`text-xs font-semibold ${w.balance >= 0 ? 'text-white' : 'text-red-400'}`}>{fmt(w.balance)}</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {forecasts && forecasts.length === 0 && weeklyData.length === 0 && (
        <div className="bg-white/[0.06] border border-white/5 rounded-xl p-8 text-center">
          <BarChart3 size={24} className="text-white/20 mx-auto mb-3" />
          <p className="text-xs text-white/40">Geen cashflow data beschikbaar.</p>
          <p className="text-[10px] text-white/30 mt-1">Voer een CFO analyse uit vanuit het Cockpit om prognoses te genereren.</p>
        </div>
      )}
    </div>
  )
}
