'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw } from 'lucide-react'

type RefreshResult = {
  status: string
  synced_at: string | null
  documents_count: number
  items_count: number
  updated_count: number
  conflicts_count: number
  dispatch_id: string | null
  priorities_count: number | null
}

export default function CanonicalTrackerRefreshButton({
  recompute = false,
  label,
  className,
}: {
  recompute?: boolean
  label?: string
  className?: string
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const text = label ?? (recompute ? 'Refresh + Herbereken Dagprioriteit' : 'Refresh Canonieke Tracker')

  async function run() {
    setBusy(true)
    setMsg(null)
    try {
      const res = await fetch('/api/build-tracker/refresh-canonical', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ recompute_priorities: recompute }),
      })
      const j: RefreshResult & { error?: string } = await res.json()
      if (!res.ok) {
        setMsg(`Fout: ${j.error ?? 'onbekend'}`)
      } else if (j.status === 'no-canonical-document') {
        setMsg('Nog geen canonieke sync — CLI-L re-parse aangevraagd.')
      } else {
        const parts = [
          `${j.items_count} items`,
          `${j.updated_count} bijgewerkt`,
          `${j.conflicts_count} conflicts`,
        ]
        if (recompute && j.priorities_count != null) parts.push(`${j.priorities_count} prioriteiten`)
        setMsg(`Gesynct · ${parts.join(' · ')} · CLI-L re-parse in wachtrij.`)
        router.refresh()
      }
    } catch {
      setMsg('Fout: netwerk/host onbereikbaar.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button
        onClick={run}
        disabled={busy}
        className={
          className ??
          'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/[0.04] hover:bg-white/[0.08] transition-all text-[11px] text-white/65 hover:text-white disabled:opacity-50'
        }
      >
        <RefreshCw size={12} className={busy ? 'animate-spin' : ''} /> {text}
      </button>
      {msg && <span className="text-[10px] text-white/45">{msg}</span>}
    </span>
  )
}
