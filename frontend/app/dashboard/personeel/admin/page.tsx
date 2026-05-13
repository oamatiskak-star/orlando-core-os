'use client'

import { FileText } from 'lucide-react'

export default function PersoneelAdminPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold text-white">HR Administratie</h1>
        <p className="text-sm text-white/40 mt-0.5">HR-dossiers en personeelsadministratie</p>
      </div>
      <div className="bg-white/[0.03] border border-white/8 rounded-xl p-8 flex flex-col items-center gap-3">
        <FileText size={32} className="text-white/15" />
        <p className="text-sm text-white/30">Geen administratie-items gevonden</p>
      </div>
    </div>
  )
}
