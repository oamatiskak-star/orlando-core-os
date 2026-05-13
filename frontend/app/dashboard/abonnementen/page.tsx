import { CreditCard, Plus, ExternalLink } from 'lucide-react'

const abonnementen = [
  {
    product: 'Vercel',
    plan: 'Pro',
    status: 'Actief',
    verlenging: '11 jun 2026',
    prijs: '€ 20',
    letter: 'V',
    letterColor: '#ffffff',
    bg: '#000000',
  },
  {
    product: 'Supabase',
    plan: 'Free',
    status: 'Actief',
    verlenging: '—',
    prijs: '€ 0',
    letter: 'S',
    letterColor: '#3ecf8e',
    bg: '#222240',
  },
  {
    product: 'GitHub',
    plan: 'Free',
    status: 'Actief',
    verlenging: '—',
    prijs: '€ 0',
    letter: 'G',
    letterColor: '#ffffff',
    bg: '#24292e',
  },
]

export default function AbonnementenPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
            <CreditCard size={16} className="text-purple-400" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-white">Abonnementen</h1>
            <p className="text-xs text-white/50">SaaS-abonnementen en licenties per product.</p>
          </div>
        </div>
        <button className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium px-4 py-2 rounded-lg transition-colors">
          <Plus size={13} />
          Nieuw abonnement
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Totaal actief', value: '3' },
          { label: 'Maandelijkse kosten', value: '€ 20' },
          { label: 'Jaarlijkse kosten', value: '€ 240' },
        ].map((s) => (
          <div key={s.label} className="bg-white/[0.06] border border-white/5 rounded-xl p-4">
            <p className="text-[11px] text-white/50 mb-1">{s.label}</p>
            <p className="text-xl font-semibold text-white">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white/[0.06] border border-white/5 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                <th className="px-4 py-2.5 text-left text-[10px] font-medium text-white/50 uppercase tracking-wider">Product</th>
                <th className="px-4 py-2.5 text-left text-[10px] font-medium text-white/50 uppercase tracking-wider">Plan</th>
                <th className="px-4 py-2.5 text-left text-[10px] font-medium text-white/50 uppercase tracking-wider">Status</th>
                <th className="px-4 py-2.5 text-left text-[10px] font-medium text-white/50 uppercase tracking-wider">Verlenging</th>
                <th className="px-4 py-2.5 text-left text-[10px] font-medium text-white/50 uppercase tracking-wider">Prijs/mo</th>
                <th className="px-4 py-2.5 text-left text-[10px] font-medium text-white/50 uppercase tracking-wider">Acties</th>
              </tr>
            </thead>
            <tbody>
              {abonnementen.map((row, i) => (
                <tr key={i} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-bold flex-shrink-0"
                        style={{ backgroundColor: row.bg, color: row.letterColor, border: '1px solid rgba(255,255,255,0.1)' }}
                      >
                        {row.letter}
                      </div>
                      <span className="text-xs text-white/80 font-medium">{row.product}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-white/50">{row.plan}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-500/10 text-green-400">
                      {row.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-white/65">{row.verlenging}</td>
                  <td className="px-4 py-3 text-xs text-white/60 font-mono">{row.prijs}</td>
                  <td className="px-4 py-3">
                    <button className="flex items-center gap-1.5 border border-white/10 text-white/65 hover:text-white hover:border-white/20 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors">
                      <ExternalLink size={10} />
                      Beheer
                    </button>
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
