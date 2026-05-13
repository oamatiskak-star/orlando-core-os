'use client'

import { Globe, Home, Users, MessageSquare } from 'lucide-react'

export default function FBOffMarketPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold text-white">FB Off Market NL</h1>
        <p className="text-sm text-white/65 mt-0.5">Facebook groep — off-market vastgoeddeals Nederland</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { icon: Home,         label: 'Deals',       desc: 'Ingekomen off-market deals uit de groep' },
          { icon: Users,        label: 'Leden',       desc: 'Groepsleden en netwerk beheer' },
          { icon: MessageSquare, label: 'Posts',      desc: 'Groepsberichten en engagements' },
        ].map(({ icon: Icon, label, desc }) => (
          <div key={label} className="bg-white/[0.06] border border-white/8 rounded-xl p-5 space-y-2 hover:border-white/15 transition-colors cursor-pointer">
            <div className="w-9 h-9 rounded-lg bg-blue-500/15 flex items-center justify-center">
              <Icon size={16} className="text-blue-400" />
            </div>
            <p className="text-sm font-semibold text-white">{label}</p>
            <p className="text-xs text-white/65">{desc}</p>
          </div>
        ))}
      </div>
      <div className="bg-white/[0.06] border border-white/8 rounded-xl p-8 flex flex-col items-center gap-3">
        <Globe size={32} className="text-white/50" />
        <p className="text-sm text-white/50">Facebook koppeling nog niet geconfigureerd</p>
        <button className="text-xs text-blue-400 hover:text-blue-300 transition-colors">Facebook verbinden</button>
      </div>
    </div>
  )
}
