import { FileText, Link2, CheckCircle, XCircle } from 'lucide-react'

const integrations = [
  {
    id: 'moneybird',
    name: 'Moneybird',
    type: 'Boekhoudpakket',
    letter: 'M',
    color: '#0ea5e9',
    status: 'inactive',
    action: 'Koppelen',
  },
  {
    id: 'ing',
    name: 'ING Zakelijk',
    type: 'Bankrekening',
    letter: 'I',
    color: '#f97316',
    status: 'inactive',
    action: 'Koppelen',
  },
  {
    id: 'bunq',
    name: 'bunq',
    type: 'Bankrekening',
    letter: 'b',
    color: '#00d97e',
    status: 'inactive',
    action: 'Koppelen',
  },
  {
    id: 'belasting',
    name: 'Belastingdienst',
    type: 'BTW & Aangifte',
    letter: 'B',
    color: '#16a34a',
    status: 'inactive',
    action: 'Koppelen',
  },
  {
    id: 'ubl',
    name: 'UBL Import',
    type: 'Facturen importeren',
    letter: 'U',
    color: '#8b5cf6',
    status: 'active',
    action: 'Instellingen',
  },
]

const mutaties = [
  { datum: '08 mei 2026', omschrijving: 'Factuur #2026-041 — Bouwmaterialen', bedrag: '€ 3.840,00', bv: 'STRKBOUW', status: 'Betaald' },
  { datum: '07 mei 2026', omschrijving: 'Betaling ontvangen — Client A', bedrag: '€ 12.500,00', bv: 'STRKBEHEER', status: 'Ontvangen' },
  { datum: '05 mei 2026', omschrijving: 'Vercel Pro — maand mei', bedrag: '€ 20,00', bv: 'MODIWÉ', status: 'Betaald' },
  { datum: '03 mei 2026', omschrijving: 'Factuur #2026-039 — Advies', bedrag: '€ 2.250,00', bv: 'MODIWÉ', status: 'Openstaand' },
  { datum: '01 mei 2026', omschrijving: 'Huurinkomsten april — Obj. 01', bedrag: '€ 1.750,00', bv: 'STRKBEHEER', status: 'Ontvangen' },
]

const mutatieStatus = (s: string) => {
  if (s === 'Betaald') return 'bg-green-500/10 text-green-400'
  if (s === 'Ontvangen') return 'bg-sky-500/10 text-sky-400'
  if (s === 'Openstaand') return 'bg-amber-500/10 text-amber-400'
  return 'bg-white/5 text-white/30'
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
          <p className="text-xs text-white/30">Centrale administratie per bedrijf — koppelingen, mutaties en belastingaangifte.</p>
        </div>
      </div>

      {/* Koppelingen */}
      <div className="bg-white/[0.03] border border-white/5 rounded-xl p-5">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <Link2 size={14} className="text-white/40" />
            <h2 className="text-sm font-semibold text-white">Externe Koppelingen</h2>
          </div>
          <span className="text-[11px] text-white/30">0/5 actief</span>
        </div>
        <p className="text-[11px] text-white/30 mb-5">
          Verbind je boekhoudpakket, bank en belastingdienst voor automatische administratie.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {integrations.map((int) => (
            <div key={int.id} className="bg-white/[0.02] border border-white/5 rounded-xl p-4 flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                  style={{ backgroundColor: int.color + '25' }}
                >
                  <span style={{ color: int.color }}>{int.letter}</span>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white leading-tight">{int.name}</p>
                  <p className="text-[11px] text-white/30">{int.type}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {int.status === 'active' ? (
                  <div className="flex items-center gap-1.5 text-[11px] text-green-400">
                    <CheckCircle size={11} />
                    <span>Actief</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-[11px] text-white/30">
                    <XCircle size={11} />
                    <span>Niet gekoppeld</span>
                  </div>
                )}
              </div>
              <div className="mt-auto pt-1">
                {int.status === 'inactive' ? (
                  <button className="w-full bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium px-4 py-2 rounded-lg transition-colors">
                    {int.action}
                  </button>
                ) : (
                  <button className="w-full border border-white/10 text-white/50 hover:text-white hover:border-white/20 text-xs font-medium px-4 py-2 rounded-lg transition-colors">
                    {int.action}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recente Mutaties */}
      <div className="bg-white/[0.03] border border-white/5 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-white">Recente Mutaties</h2>
          <button className="text-[11px] text-indigo-400 hover:text-indigo-300">Alles zien</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                <th className="px-4 py-2.5 text-left text-[10px] font-medium text-white/30 uppercase tracking-wider">Datum</th>
                <th className="px-4 py-2.5 text-left text-[10px] font-medium text-white/30 uppercase tracking-wider">Omschrijving</th>
                <th className="px-4 py-2.5 text-left text-[10px] font-medium text-white/30 uppercase tracking-wider">Bedrag</th>
                <th className="px-4 py-2.5 text-left text-[10px] font-medium text-white/30 uppercase tracking-wider">BV</th>
                <th className="px-4 py-2.5 text-left text-[10px] font-medium text-white/30 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody>
              {mutaties.map((row, i) => (
                <tr key={i} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                  <td className="px-4 py-3 text-xs text-white/40 whitespace-nowrap">{row.datum}</td>
                  <td className="px-4 py-3 text-xs text-white/70">{row.omschrijving}</td>
                  <td className="px-4 py-3 text-xs text-white/70 font-mono whitespace-nowrap">{row.bedrag}</td>
                  <td className="px-4 py-3 text-xs text-white/40">{row.bv}</td>
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
