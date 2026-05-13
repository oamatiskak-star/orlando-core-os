'use client'

import { ScrollText, Plus } from 'lucide-react'

export default function ContractenPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-white">Contracten</h1>
          <p className="text-sm text-white/40 mt-0.5">Arbeids- en ZZP-contracten</p>
        </div>
        <button className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg transition-colors">
          <Plus size={13} /> Nieuw contract
        </button>
      </div>
      <div className="bg-white/[0.03] border border-white/8 rounded-xl p-8 flex flex-col items-center gap-3">
        <ScrollText size={32} className="text-white/15" />
        <p className="text-sm text-white/30">Nog geen contracten aangemaakt</p>
      </div>
    </div>
  )
}
