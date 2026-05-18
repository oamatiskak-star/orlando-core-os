import { createClient } from '@/lib/supabase/server'
import type { FinInvoice, FinDashboardStats } from '@/lib/finance/types'

function fmt(amount: number) {
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(amount)
}

function StatCard({
  label,
  value,
  sub,
  color,
}: {
  label: string
  value: string
  sub?: string
  color: 'amber' | 'red' | 'darkred' | 'green' | 'blue' | 'auto'
}) {
  const borderColor =
    color === 'amber'
      ? 'border-amber-500/20'
      : color === 'red' || color === 'darkred'
        ? 'border-red-500/20'
        : color === 'green'
          ? 'border-green-500/20'
          : color === 'blue'
            ? 'border-blue-500/20'
            : 'border-white/5'

  const valueColor =
    color === 'amber'
      ? 'text-amber-400'
      : color === 'red'
        ? 'text-red-400'
        : color === 'darkred'
          ? 'text-red-500'
          : color === 'green'
            ? 'text-green-400'
            : color === 'blue'
              ? 'text-blue-400'
              : 'text-white'

  return (
    <div className={`bg-white/[0.06] border ${borderColor} rounded-xl p-4`}>
      <p className="text-[10px] font-medium text-white/50 uppercase tracking-wider mb-2">{label}</p>
      <p className={`text-xl font-semibold ${valueColor}`}>{value}</p>
      {sub && <p className="text-xs text-white/65 mt-1">{sub}</p>}
    </div>
  )
}

export default async function FinanceDashboardPage() {
  const supabase = await createClient()

  let invoices: FinInvoice[] = []

  try {
    const { data, error } = await supabase
      .from('fin_invoices')
      .select('*, customer:fin_customers(*)')
      .order('days_overdue', { ascending: false })
      .limit(100)

    if (!error && data && data.length > 0) {
      invoices = data as FinInvoice[]
    }
  } catch {
    // no live data available
  }

  const open = invoices.filter((i) => i.status === 'open')
  const overdue = invoices.filter((i) => i.status === 'vervallen')
  const incasso = invoices.filter((i) => i.status === 'incasso')
  const paid = invoices.filter((i) => i.status === 'betaald')
  const allNonPaid = open.length + overdue.length + incasso.length

  const stats: FinDashboardStats = {
    total_open: open.length,
    total_open_amount: open.reduce((s, i) => s + i.amount_incl, 0),
    total_overdue: overdue.length,
    total_overdue_amount: overdue.reduce((s, i) => s + i.amount_incl, 0),
    total_incasso: incasso.length,
    total_incasso_amount: incasso.reduce((s, i) => s + i.amount_incl, 0),
    total_paid_month: paid.length,
    total_paid_month_amount: paid.reduce((s, i) => s + i.amount_incl, 0),
    avg_payment_days: 0,
    overdue_pct: allNonPaid > 0 ? Math.round((overdue.length / allNonPaid) * 100) : 0,
  }

  const criticalInvoices = invoices
    .filter((i) => i.status === 'vervallen' || i.status === 'incasso')
    .sort((a, b) => b.days_overdue - a.days_overdue)
    .slice(0, 5)

  const openInvoices = invoices.filter((i) => i.status === 'open')
  const next30 = openInvoices.reduce((s, i) => s + i.amount_incl, 0)

  const statusCounts: Record<string, number> = {}
  for (const inv of invoices) {
    statusCounts[inv.workflow_stage] = (statusCounts[inv.workflow_stage] || 0) + 1
  }

  return (
    <div className="space-y-6">
      {invoices.length === 0 && (
        <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white/50 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-white/30 flex-shrink-0" />
          Geen live data — koppel Moneybird via de{' '}
          <a href="/dashboard/finance/setup" className="underline hover:text-white/70">Setup pagina</a> of wacht op de eerste sync.
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard
          label="Openstaand"
          value={fmt(stats.total_open_amount)}
          sub={`${stats.total_open} facturen`}
          color="amber"
        />
        <StatCard
          label="Vervallen"
          value={fmt(stats.total_overdue_amount)}
          sub={`${stats.total_overdue} facturen`}
          color="red"
        />
        <StatCard
          label="Incasso"
          value={fmt(stats.total_incasso_amount)}
          sub={`${stats.total_incasso} dossiers`}
          color="darkred"
        />
        <StatCard
          label="Betaald (maand)"
          value={fmt(stats.total_paid_month_amount)}
          sub={`${stats.total_paid_month} facturen`}
          color="green"
        />
        <StatCard
          label="Gem. betaaltermijn"
          value={stats.avg_payment_days > 0 ? `${stats.avg_payment_days} dagen` : '—'}
          color="blue"
        />
        <StatCard
          label="Overdue %"
          value={`${stats.overdue_pct}%`}
          color={stats.overdue_pct > 30 ? 'red' : stats.overdue_pct > 15 ? 'amber' : 'green'}
        />
      </div>

      {/* Middle row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Critical invoices */}
        <div className="bg-white/[0.06] border border-white/5 rounded-xl p-4">
          <h3 className="text-xs font-semibold text-white mb-3">Kritieke Facturen</h3>
          {criticalInvoices.length === 0 ? (
            <p className="text-xs text-white/50 py-4 text-center">Geen kritieke facturen</p>
          ) : (
            <table className="w-full">
              <thead>
                <tr>
                  <th className="text-left text-[10px] font-medium text-white/50 uppercase tracking-wider pb-2">Factuur</th>
                  <th className="text-left text-[10px] font-medium text-white/50 uppercase tracking-wider pb-2">Klant</th>
                  <th className="text-right text-[10px] font-medium text-white/50 uppercase tracking-wider pb-2">Bedrag</th>
                  <th className="text-right text-[10px] font-medium text-white/50 uppercase tracking-wider pb-2">Te laat</th>
                  <th className="text-right text-[10px] font-medium text-white/50 uppercase tracking-wider pb-2">Stadium</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {criticalInvoices.map((inv) => (
                  <tr key={inv.id}>
                    <td className="py-2 text-xs text-indigo-400">{inv.invoice_nr}</td>
                    <td className="py-2 text-xs text-white/70 truncate max-w-[120px]">
                      {inv.customer?.name ?? 'Onbekend'}
                    </td>
                    <td className="py-2 text-xs text-white/70 text-right">{fmt(inv.amount_incl)}</td>
                    <td className="py-2 text-right">
                      <span className="bg-red-500/10 text-red-400 px-2 py-0.5 rounded-full text-[10px] font-medium">
                        {inv.days_overdue}d
                      </span>
                    </td>
                    <td className="py-2 text-xs text-white/65 text-right">{inv.workflow_stage}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Cashflow */}
        <div className="bg-white/[0.06] border border-white/5 rounded-xl p-4">
          <h3 className="text-xs font-semibold text-white mb-3">Cashflow Verwachting</h3>
          <div className="space-y-3">
            {[
              { label: 'Komende 30 dagen', amount: next30, color: 'text-green-400' },
              { label: 'Komende 31–60 dagen', amount: 0, color: 'text-white/50' },
              { label: 'Komende 61–90 dagen', amount: 0, color: 'text-white/50' },
            ].map((row) => (
              <div key={row.label} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                <span className="text-xs text-white/50">{row.label}</span>
                <span className={`text-sm font-semibold ${row.color}`}>{fmt(row.amount)}</span>
              </div>
            ))}
            <div className="flex items-center justify-between pt-1">
              <span className="text-xs font-medium text-white/70">Totaal verwacht</span>
              <span className="text-sm font-semibold text-white">{fmt(next30)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Workflow status */}
      <div className="bg-white/[0.06] border border-white/5 rounded-xl p-4">
        <h3 className="text-xs font-semibold text-white mb-3">Workflow Overzicht per Stadium</h3>
        {Object.keys(statusCounts).length === 0 ? (
          <p className="text-xs text-white/40 py-4 text-center">Geen workflow data beschikbaar</p>
        ) : (
          <table className="w-full">
            <thead>
              <tr>
                <th className="text-left text-[10px] font-medium text-white/50 uppercase tracking-wider pb-2">Stadium</th>
                <th className="text-right text-[10px] font-medium text-white/50 uppercase tracking-wider pb-2">Facturen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {Object.entries(statusCounts).map(([stage, count]) => (
                <tr key={stage}>
                  <td className="py-2 text-xs text-white/70">{stage.replace(/_/g, ' ')}</td>
                  <td className="py-2 text-xs text-white/65 text-right">{count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
