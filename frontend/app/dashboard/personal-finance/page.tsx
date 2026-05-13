'use client'

import { BadgeDollarSign, TrendingUp, Wallet, Target } from 'lucide-react'

const MODULES = [
  { icon: Wallet,      label: 'Vermogen',        desc: 'Totaaloverzicht persoonlijk vermogen' },
  { icon: TrendingUp,  label: 'Beleggingen',     desc: 'Aandelen, ETFs, vastgoed en crypto' },
  { icon: Target,      label: 'Financiële doelen', desc: 'Spaardoelen, FIRE en vermogensopbouw' },
]

export default function PersonalFinancePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold text-white">Personal Finance OS</h1>
        <p className="text-sm text-white/40 mt-0.5">Persoonlijk vermogensbeheer, beleggingen en financiële doelen</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {MODULES.map(({ icon: Icon, label, desc }) => (
          <div key={label} className="bg-white/[0.03] border border-white/8 rounded-xl p-5 space-y-2 hover:border-white/15 transition-colors cursor-pointer">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/15 flex items-center justify-center">
              <Icon size={16} className="text-emerald-400" />
            </div>
            <p className="text-sm font-semibold text-white">{label}</p>
            <p className="text-xs text-white/40">{desc}</p>
          </div>
        ))}
      </div>

      <div className="bg-white/[0.03] border border-white/8 rounded-xl p-8 flex flex-col items-center gap-3">
        <BadgeDollarSign size={32} className="text-white/15" />
        <p className="text-sm text-white/30">Vermogensoverzicht nog niet geconfigureerd</p>
        <button className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors">
          Bankrekeningen koppelen
        </button>
      </div>
    </div>
  )
}
