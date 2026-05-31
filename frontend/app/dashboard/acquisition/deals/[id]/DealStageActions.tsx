'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, X } from 'lucide-react'

const ORDER = ['radar', 'analyse', 'due_diligence', 'bod', 'gewonnen']

export default function DealStageActions({ id, stage }: { id: string; stage: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  const idx = ORDER.indexOf(stage)
  const next = idx >= 0 && idx < ORDER.length - 1 ? ORDER[idx + 1] : null
  const isTerminal = stage === 'gewonnen' || stage === 'verloren'

  async function move(target: string) {
    setBusy(true)
    try {
      await fetch('/api/acquisition/deals/stage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, stage: target }),
      })
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  if (isTerminal) return null

  return (
    <>
      {next && (
        <button onClick={() => move(next)} disabled={busy}
          className="flex items-center gap-1 px-2 py-1 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/20 rounded-lg text-xs text-emerald-400 disabled:opacity-50 transition-colors">
          <ArrowRight size={11} /> {busy ? '…' : `Naar ${next.replace('_', ' ')}`}
        </button>
      )}
      <button onClick={() => move('verloren')} disabled={busy}
        className="flex items-center gap-1 px-2 py-1 bg-red-600/15 hover:bg-red-600/25 border border-red-500/20 rounded-lg text-xs text-red-400 disabled:opacity-50 transition-colors">
        <X size={11} /> Afwijzen
      </button>
    </>
  )
}
