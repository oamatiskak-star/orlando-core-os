'use client'

import { ClipboardList, Plus, Calendar, Users, FolderKanban } from 'lucide-react'

export default function PlanningPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-white">Planning</h1>
          <p className="text-sm text-white/40 mt-0.5">Projectplanning, mijlpalen en capaciteit</p>
        </div>
        <button className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg transition-colors">
          <Plus size={13} />
          Nieuw item
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { icon: ClipboardList, label: 'Projectplanning', desc: 'Gantt, mijlpalen en deadlines per project' },
          { icon: Users,         label: 'Capaciteitsplanning', desc: 'Bezetting en beschikbaarheid per medewerker' },
          { icon: Calendar,      label: 'Sprint & Taken',  desc: 'Wekelijkse sprints en taakverdeling' },
        ].map(({ icon: Icon, label, desc }) => (
          <div key={label} className="bg-white/[0.03] border border-white/8 rounded-xl p-5 space-y-2 hover:border-white/15 transition-colors cursor-pointer">
            <div className="w-9 h-9 rounded-lg bg-indigo-500/15 flex items-center justify-center">
              <Icon size={16} className="text-indigo-400" />
            </div>
            <p className="text-sm font-semibold text-white">{label}</p>
            <p className="text-xs text-white/40">{desc}</p>
          </div>
        ))}
      </div>

      <div className="bg-white/[0.03] border border-white/8 rounded-xl p-8 flex flex-col items-center justify-center gap-3">
        <FolderKanban size={32} className="text-white/15" />
        <p className="text-sm text-white/30">Nog geen planningsitems aangemaakt</p>
        <button className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
          + Eerste item toevoegen
        </button>
      </div>
    </div>
  )
}
