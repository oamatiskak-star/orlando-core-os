'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw } from 'lucide-react'

export default function RefreshButton() {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [loading, setLoading] = useState(false)

  async function run() {
    setLoading(true)
    try {
      await fetch('/api/hermes/refresh', { method: 'POST' })
    } catch {
      // stil falen — de hercheck draait sowieso elke 20 min via pg_cron
    } finally {
      setLoading(false)
      startTransition(() => router.refresh())
    }
  }

  const busy = loading || pending
  return (
    <button
      onClick={run}
      disabled={busy}
      className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-fuchsia-500/30 bg-fuchsia-500/10 text-fuchsia-200 text-xs hover:bg-fuchsia-500/20 disabled:opacity-50 transition"
    >
      <RefreshCw size={13} className={busy ? 'animate-spin' : ''} />
      {busy ? 'Hermes checkt…' : 'Ververs & hercheck'}
    </button>
  )
}
