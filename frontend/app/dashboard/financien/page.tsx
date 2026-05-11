import { TrendingUp, Euro, FileText, ArrowUpDown } from 'lucide-react'

const statCards = [
  { label: 'Totale Omzet', value: '€ 0', icon: TrendingUp, color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/20' },
  { label: 'Maandelijkse Kosten', value: '€ 0', icon: Euro, color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20' },
  { label: 'Openstaande Facturen', value: '0', icon: FileText, color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' },
  { label: 'Cashflow', value: '€ 0', icon: ArrowUpDown, color: 'text-sky-400', bg: 'bg-sky-500/10 border-sky-500/20' },
]

const omzetBvs = [
  { bv: 'MODIWÉ', kleur: '#6366f1', omzet: '€ 0', kosten: '€ 0', marge: '—', status: 'Nog niet actief' },
  { bv: 'MEDIA', kleur: '#8b5cf6', omzet: '€ 0', kosten: '€ 0', marge: '—', status: 'Nog niet actief' },
  { bv: 'STRKBEHEER', kleur: '#0ea5e9', omzet: '€ 0', kosten: '€ 0', marge: '—', status: 'Nog niet actief' },
  { bv: 'STRKBOUW', kleur: '#f59e0b', omzet: '€ 0', kosten: '€ 0', marge: '—', status: 'Nog niet actief' },
]

export default function FinancienPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center justify-center">
          <TrendingUp size={16} className="text-green-400" />
        </div>
        <div>
          <h1 className="text-base font-semibold text-white">Financiën</h1>
          <p className="text-xs text-white/30">Cashflow, omzet, BTW en financieel overzicht per BV.</p>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {statCards.map((card) => {
          const Icon = card.icon
          return (
            <div key={card.label} className="bg-white/[0.03] border border-white/5 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[11px] text-white/30">{card.label}</p>
                <div className={`w-7 h-7 rounded-lg border flex items-center justify-center ${card.bg}`}>
                  <Icon size={13} className={card.color} />
                </div>
              </div>
              <p className="text-2xl font-semibold text-white">{card.value}</p>
            </div>
          )
        })}
      </div>

      {/* Omzet per BV */}
      <div className="bg-white/[0.03] border border-white/5 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-white">Omzet per BV</h2>
          <span className="text-[11px] text-white/30">2026 YTD</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                <th className="px-4 py-2.5 text-left text-[10px] font-medium text-white/30 uppercase tracking-wider">BV</th>
                <th className="px-4 py-2.5 text-left text-[10px] font-medium text-white/30 uppercase tracking-wider">Omzet</th>
                <th className="px-4 py-2.5 text-left text-[10px] font-medium text-white/30 uppercase tracking-wider">Kosten</th>
                <th className="px-4 py-2.5 text-left text-[10px] font-medium text-white/30 uppercase tracking-wider">Marge</th>
                <th className="px-4 py-2.5 text-left text-[10px] font-medium text-white/30 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody>
              {omzetBvs.map((row, i) => (
                <tr key={i} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: row.kleur }} />
                      <span className="text-xs text-white/70 font-medium">{row.bv}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-white/50 font-mono">{row.omzet}</td>
                  <td className="px-4 py-3 text-xs text-white/50 font-mono">{row.kosten}</td>
                  <td className="px-4 py-3 text-xs text-white/50">{row.marge}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-white/5 text-white/30">
                      {row.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Openstaande Facturen */}
      <div className="bg-white/[0.03] border border-white/5 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-white">Openstaande Facturen</h2>
          <button className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium px-4 py-2 rounded-lg transition-colors">
            Factuur maken
          </button>
        </div>
        <div className="flex flex-col items-center justify-center py-12 gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center">
            <FileText size={18} className="text-white/20" />
          </div>
          <p className="text-sm text-white/30">Geen openstaande facturen</p>
          <p className="text-[11px] text-white/20">Facturen worden hier zichtbaar zodra er koppelingen actief zijn.</p>
        </div>
      </div>
    </div>
  )
}
