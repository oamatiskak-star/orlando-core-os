import { FileText } from 'lucide-react'
import IntegrationsPanel from './IntegrationsPanel'

const mutaties = [
  { datum: '08 mei 2026', omschrijving: 'Factuur #2026-041 — Bouwmaterialen', bedrag: '€ 3.840,00', bv: 'STRKBOUW', status: 'Betaald' },
  { datum: '07 mei 2026', omschrijving: 'Betaling ontvangen — Client A', bedrag: '€ 12.500,00', bv: 'STRKBEHEER', status: 'Ontvangen' },
  { datum: '05 mei 2026', omschrijving: 'Vercel Pro — maand mei', bedrag: '€ 20,00', bv: 'MODIWÉ', status: 'Betaald' },
  { datum: '03 mei 2026', omschrijving: 'Factuur #2026-039 — Advies', bedrag: '€ 2.250,00', bv: 'MODIWÉ', status: 'Openstaand' },
  { datum: '01 mei 2026', omschrijving: 'Huurinkomsten april — Obj. 01', bedrag: '€ 1.750,00', bv: 'STRKBEHEER', status: 'Ontvangen' },
]

const mutatieStatus = (s: string) => {
  if (s === 'Betaald')   return 'bg-green-500/10 text-green-400'
  if (s === 'Ontvangen') return 'bg-sky-500/10 text-sky-400'
  if (s === 'Openstaand') return 'bg-amber-500/10 text-amber-400'
  return 'bg-white/5 text-white/50'
}

export default function AdminPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
          <FileText size={16} className="text-violet-400" />
        </div>
        <div>
          <h1 className="text-base font-semibold text-white">Administratie</h1>
          <p className="text-xs text-white/50">Centrale administratie per bedrijf — koppelingen, mutaties en belastingaangifte.</p>
        </div>
      </div>

      <IntegrationsPanel />

      <div className="bg-white/[0.06] border border-white/5 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-white">Recente Mutaties</h2>
          <button className="text-[11px] text-indigo-400 hover:text-indigo-300">Alles zien</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                <th className="px-4 py-2.5 text-left text-[10px] font-medium text-white/50 uppercase tracking-wider">Datum</th>
                <th className="px-4 py-2.5 text-left text-[10px] font-medium text-white/50 uppercase tracking-wider">Omschrijving</th>
                <th className="px-4 py-2.5 text-left text-[10px] font-medium text-white/50 uppercase tracking-wider">Bedrag</th>
                <th className="px-4 py-2.5 text-left text-[10px] font-medium text-white/50 uppercase tracking-wider">BV</th>
                <th className="px-4 py-2.5 text-left text-[10px] font-medium text-white/50 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody>
              {mutaties.map((row, i) => (
                <tr key={i} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                  <td className="px-4 py-3 text-xs text-white/65 whitespace-nowrap">{row.datum}</td>
                  <td className="px-4 py-3 text-xs text-white/70">{row.omschrijving}</td>
                  <td className="px-4 py-3 text-xs text-white/70 font-mono whitespace-nowrap">{row.bedrag}</td>
                  <td className="px-4 py-3 text-xs text-white/65">{row.bv}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${mutatieStatus(row.status)}`}>
                      {row.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
