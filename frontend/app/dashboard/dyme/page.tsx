'use client'

import { Coins, TrendingUp, ArrowRightLeft, PieChart } from 'lucide-react'

const MODULES = [
  { icon: TrendingUp,       label: 'Vermogensoverzicht', desc: 'Totaal vermogen, groei en spreiding' },
  { icon: ArrowRightLeft,   label: 'Transacties',        desc: 'Inkomsten, uitgaven en categorisering' },
  { icon: PieChart,         label: 'Budgetten',          desc: 'Budgetten per categorie en doelen' },
]

export default function DymePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold text-white">Dyme OS</h1>
        <p className="text-sm text-white/65 mt-0.5">Persoonlijk financieel overzicht gekoppeld aan Dyme</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {MODULES.map(({ icon: Icon, label, desc }) => (
          <div key={label} className="bg-white/[0.06] border border-white/8 rounded-xl p-5 space-y-2 hover:border-white/15 transition-colors cursor-pointer">
            <div className="w-9 h-9 rounded-lg bg-violet-500/15 flex items-center justify-center">
              <Icon size={16} className="text-violet-400" />
            </div>
            <p className="text-sm font-semibold text-white">{label}</p>
            <p className="text-xs text-white/65">{desc}</p>
          </div>
        ))}
      </div>

      <div className="bg-white/[0.06] border border-white/8 rounded-xl p-8 flex flex-col items-center gap-3">
        <Coins size={32} className="text-white/50" />
        <p className="text-sm text-white/50">Dyme koppeling nog niet geconfigureerd</p>
        <button className="text-xs text-violet-400 hover:text-violet-300 transition-colors">
          Dyme verbinden
        </button>
      </div>
    </div>
  )
}
