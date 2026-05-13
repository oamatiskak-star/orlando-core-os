'use client'

import { ReceiptText, Upload } from 'lucide-react'

export default function LoonstrokenPersoneelPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-white">Loonstroken</h1>
          <p className="text-sm text-white/40 mt-0.5">Salarisoverzichten per medewerker</p>
        </div>
        <button className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg transition-colors">
          <Upload size={13} /> Uploaden
        </button>
      </div>
      <div className="bg-white/[0.03] border border-white/8 rounded-xl p-8 flex flex-col items-center gap-3">
        <ReceiptText size={32} className="text-white/15" />
        <p className="text-sm text-white/30">Nog geen loonstroken geüpload</p>
      </div>
    </div>
  )
}
