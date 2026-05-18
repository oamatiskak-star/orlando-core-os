import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { AlertTriangle, CheckCircle, Clock, Shield } from 'lucide-react'

function fmt(n: number) {
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)
}

function daysUntil(dateStr: string): number {
  const diff = new Date(dateStr).getTime() - Date.now()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

export default async function BelastingPage() {
  const supabase = await createClient()
  const now      = new Date()
  const year     = now.getFullYear()

  const [{ data: taxRows }, { data: txData }] = await Promise.all([
    supabase.from('cfo_tax_reservations')
      .select('*')
      .eq('period_year', year)
      .order('deadline', { ascending: true }),
    supabase.from('cfo_transactions')
      .select('direction, amount_vat, transaction_date')
      .gte('transaction_date', `${year}-01-01`)
      .lte('transaction_date', now.toISOString().split('T')[0]),
  ])

  const taxReservations = taxRows ?? []

  // Bereken BTW per kwartaal vanuit transacties
  const btwPerKwartaal: Record<number, { in: number; out: number }> = {1: {in:0,out:0}, 2: {in:0,out:0}, 3: {in:0,out:0}, 4: {in:0,out:0}}
  for (const tx of (txData ?? [])) {
    const month   = new Date(tx.transaction_date).getMonth() + 1
    const quarter = Math.ceil(month / 3)
    if (tx.direction === 'credit') btwPerKwartaal[quarter].in  += tx.amount_vat ?? 0
    else                           btwPerKwartaal[quarter].out += tx.amount_vat ?? 0
  }

  const btwDeadlines: Record<number, string> = {
    1: `${year}-04-30`,
    2: `${year}-07-31`,
    3: `${year}-10-31`,
    4: `${year + 1}-01-31`,
  }

  const currentQuarter = Math.ceil((now.getMonth() + 1) / 3)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-base font-semibold text-white flex items-center gap-2">
          <Shield size={16} className="text-amber-400" />
          Belasting & Compliance Monitor
        </h1>
        <p className="text-xs text-white/50 mt-0.5">Fiscalist AI — BTW, VPB, IB en Loonheffing bewaking</p>
      </div>

      {/* BTW per kwartaal */}
      <div className="bg-white/[0.06] border border-white/5 rounded-xl p-5">
        <h3 className="text-xs font-semibold text-white mb-4">BTW Overzicht {year}</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {([1, 2, 3, 4] as const).map(q => {
            const btw      = btwPerKwartaal[q]
            const netto    = btw.in - btw.out
            const reserved = taxReservations.find(r => r.tax_type === 'btw' && r.period_quarter === q)
            const gap      = netto - (reserved?.amount_reserved ?? 0)
            const deadline = btwDeadlines[q]
            const days     = daysUntil(deadline)
            const isPast   = days < 0
            const isActive = q === currentQuarter

            return (
              <div
                key={q}
                className={`border rounded-xl p-4 ${isActive ? 'border-amber-500/30 bg-amber-500/5' : 'border-white/5 bg-white/[0.03]'}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-white">Q{q} {year}</span>
                  {isActive && <span className="text-[9px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded-full">Huidig</span>}
                  {isPast && <span className="text-[9px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded-full">Voorbij</span>}
                </div>
                <p className="text-[10px] text-white/50 mb-1">BTW ontvangen</p>
                <p className="text-sm font-bold text-white">{fmt(btw.in)}</p>
                <p className="text-[10px] text-white/50 mt-2 mb-1">BTW betaald</p>
                <p className="text-sm text-white/70">{fmt(btw.out)}</p>
                <div className="border-t border-white/5 mt-3 pt-2">
                  <div className="flex justify-between">
                    <span className="text-[10px] text-white/50">Netto te betalen</span>
                    <span className={`text-xs font-semibold ${netto > 0 ? 'text-red-400' : 'text-green-400'}`}>{fmt(netto)}</span>
                  </div>
                  {gap > 500 && (
                    <div className="flex justify-between mt-1">
                      <span className="text-[10px] text-white/50">Reserveringstekort</span>
                      <span className="text-xs text-red-400">{fmt(gap)}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1 mt-2">
                    <Clock size={11} className="text-white/40" />
                    <span className={`text-[10px] ${isPast ? 'text-red-400' : days <= 14 ? 'text-amber-400' : 'text-white/40'}`}>
                      {isPast ? 'VERSTREKEN' : `${days} dagen (${deadline})`}
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Reserveringen tabel */}
      <div className="bg-white/[0.06] border border-white/5 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-white/5">
          <h3 className="text-xs font-semibold text-white">Actieve Reserveringen</h3>
        </div>
        {taxReservations.length === 0 ? (
          <div className="p-8 text-center text-xs text-white/40">
            Geen reserveringen gevonden. Voer een sync uit om Moneybird data te laden.
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr>
                {['Type','Periode','Deadline','Vereist','Gereserveerd','Betaald','Gap','Status'].map(h => (
                  <th key={h} className="text-left text-[10px] font-medium text-white/50 uppercase tracking-wider px-4 py-2 first:pl-5 last:pr-5">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {taxReservations.map(row => {
                const gap     = row.amount_required - row.amount_reserved
                const days    = row.deadline ? daysUntil(row.deadline) : null
                const isLate  = days !== null && days < 0
                const isUrgent = days !== null && days <= 14 && days >= 0

                return (
                  <tr key={row.id} className={isLate ? 'bg-red-500/5' : isUrgent ? 'bg-amber-500/5' : ''}>
                    <td className="px-4 py-2.5 first:pl-5">
                      <span className="text-xs font-semibold text-white uppercase">{row.tax_type}</span>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-white/70">
                      {row.period_quarter ? `Q${row.period_quarter} ${row.period_year}` : row.period_year}
                    </td>
                    <td className="px-4 py-2.5">
                      {row.deadline ? (
                        <span className={`text-xs ${isLate ? 'text-red-400 font-semibold' : isUrgent ? 'text-amber-400' : 'text-white/60'}`}>
                          {row.deadline}
                        </span>
                      ) : <span className="text-xs text-white/40">—</span>}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-white/70">{fmt(row.amount_required)}</td>
                    <td className="px-4 py-2.5 text-xs text-white/70">{fmt(row.amount_reserved)}</td>
                    <td className="px-4 py-2.5 text-xs text-green-400">{fmt(row.amount_paid)}</td>
                    <td className="px-4 py-2.5">
                      <span className={`text-xs font-semibold ${gap > 500 ? 'text-red-400' : gap > 0 ? 'text-amber-400' : 'text-green-400'}`}>
                        {gap > 0 ? fmt(gap) : '✓'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 last:pr-5">
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                        row.status === 'betaald'     ? 'bg-green-500/10 text-green-400'
                        : row.status === 'te_laat'   ? 'bg-red-500/10 text-red-400'
                        : row.status === 'ingediend' ? 'bg-blue-500/10 text-blue-400'
                        : 'bg-white/5 text-white/50'
                      }`}>{row.status}</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Belasting kalender */}
      <div className="bg-white/[0.06] border border-white/5 rounded-xl p-5">
        <h3 className="text-xs font-semibold text-white mb-4">Nederlandse Belasting Kalender {year}</h3>
        <div className="space-y-2">
          {[
            { type: 'BTW Q1',        deadline: `${year}-04-30`, desc: 'BTW aangifte eerste kwartaal' },
            { type: 'BTW Q2',        deadline: `${year}-07-31`, desc: 'BTW aangifte tweede kwartaal' },
            { type: 'BTW Q3',        deadline: `${year}-10-31`, desc: 'BTW aangifte derde kwartaal' },
            { type: 'VPB aangifte',  deadline: `${year + 1}-05-31`, desc: 'Vennootschapsbelasting aangifte' },
            { type: 'BTW Q4',        deadline: `${year + 1}-01-31`, desc: 'BTW aangifte vierde kwartaal' },
          ].map(item => {
            const days   = daysUntil(item.deadline)
            const isPast = days < 0
            return (
              <div key={item.type} className="flex items-center gap-4 py-2.5 border-b border-white/5 last:border-0">
                {isPast ? (
                  <CheckCircle size={14} className="text-white/30 flex-shrink-0" />
                ) : days <= 30 ? (
                  <AlertTriangle size={14} className="text-amber-400 flex-shrink-0" />
                ) : (
                  <Clock size={14} className="text-white/30 flex-shrink-0" />
                )}
                <div className="flex-1">
                  <span className="text-xs font-medium text-white">{item.type}</span>
                  <span className="text-[10px] text-white/40 ml-2">{item.desc}</span>
                </div>
                <span className="text-xs text-white/50">{item.deadline}</span>
                <span className={`text-xs font-medium w-24 text-right ${
                  isPast ? 'text-white/30' : days <= 14 ? 'text-red-400' : days <= 30 ? 'text-amber-400' : 'text-white/50'
                }`}>
                  {isPast ? 'Voorbij' : `${days} dagen`}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
