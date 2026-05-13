'use client'

import { UserCheck, Home, FileText, MessageSquare } from 'lucide-react'

const MODULES = [
  { icon: Home,          label: 'Woningen',     desc: 'Verkochte en verhuurde woningen per project' },
  { icon: FileText,      label: 'Documenten',   desc: 'Koopaktes, sleuteloverdracht en garanties' },
  { icon: MessageSquare, label: 'Communicatie', desc: 'Berichtencentrum met kopers en huurders' },
]

export default function KopersPortaalPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold text-white">Kopers & Huurders Portaal</h1>
        <p className="text-sm text-white/40 mt-0.5">Communicatie, documenten en dossiers per koper of huurder</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {MODULES.map(({ icon: Icon, label, desc }) => (
          <div key={label} className="bg-white/[0.03] border border-white/8 rounded-xl p-5 space-y-2 hover:border-white/15 transition-colors cursor-pointer">
            <div className="w-9 h-9 rounded-lg bg-indigo-500/15 flex items-center justify-center">
              <Icon size={16} className="text-indigo-400" />
            </div>
            <p className="text-sm font-semibold text-white">{label}</p>
            <p className="text-xs text-white/40">{desc}</p>
          </div>
        ))}
      </div>

      <div className="bg-white/[0.03] border border-white/8 rounded-xl p-8 flex flex-col items-center gap-3">
        <UserCheck size={32} className="text-white/15" />
        <p className="text-sm text-white/30">Geen kopers of huurders geregistreerd</p>
      </div>
    </div>
  )
}
