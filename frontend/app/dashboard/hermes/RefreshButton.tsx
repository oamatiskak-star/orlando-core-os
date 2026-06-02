'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw } from 'lucide-react'

export default function RefreshButton() {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<string | null>(null)

  async function run() {
    setLoading(true)
    setResult(null)
    try {
      const res = await fetch('/api/hermes/refresh', { method: 'POST' })
      const j = await res.json().catch(() => null)
      if (j?.ok) {
        const cleaned = (j.alerts_resolved ?? 0) + (j.incidents_resolved ?? 0) + (j.workers_reset ?? 0)
        setResult(cleaned > 0
          ? `✓ ${j.alerts_resolved} alarmen · ${j.incidents_resolved} incidenten · ${j.workers_reset} workers opgeschoond`
          : '✓ Hercheck klaar — niets op te schonen')
      } else {
        setResult(`⚠ ${j?.error ?? 'hercheck mislukt'}`)
      }
    } catch {
      setResult('⚠ hercheck-verzoek mislukt')
    } finally {
      setLoading(false)
      startTransition(() => router.refresh())
    }
  }

  const busy = loading || pending
  return (
    <div className="flex items-center gap-3">
      <button
        onClick={run}
        disabled={busy}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-fuchsia-500/30 bg-fuchsia-500/10 text-fuchsia-200 text-xs hover:bg-fuchsia-500/20 disabled:opacity-50 transition"
      >
        <RefreshCw size={13} className={busy ? 'animate-spin' : ''} />
        {busy ? 'Hermes checkt…' : 'Ververs & hercheck'}
      </button>
      {result && <span className="text-[11px] text-white/55">{result}</span>}
    </div>
  )
}
