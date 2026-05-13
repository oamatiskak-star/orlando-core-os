'use client'

import { Files, Upload } from 'lucide-react'

export default function PersoneelDocumentenPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-white">Personeelsdocumenten</h1>
          <p className="text-sm text-white/65 mt-0.5">Formulieren, verklaringen en HR-documenten</p>
        </div>
        <button className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg transition-colors">
          <Upload size={13} /> Uploaden
        </button>
      </div>
      <div className="bg-white/[0.06] border border-white/8 rounded-xl p-8 flex flex-col items-center gap-3">
        <Files size={32} className="text-white/50" />
        <p className="text-sm text-white/50">Geen documenten gevonden</p>
      </div>
    </div>
  )
}
