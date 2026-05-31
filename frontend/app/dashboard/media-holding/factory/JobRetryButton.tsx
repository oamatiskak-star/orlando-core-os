'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw } from 'lucide-react'

const RETRYABLE = ['failed', 'manual_review_required', 'retrying']

export default function JobRetryButton({ id, status }: { id: string; status: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  if (!RETRYABLE.includes(status)) return <span className="text-white/20">—</span>

  async function retry() {
    setBusy(true)
    try {
      await fetch('/api/media-holding/factory/retry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      onClick={retry}
      disabled={busy}
      className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md border border-sky-500/30 bg-sky-500/10 text-sky-300 hover:bg-sky-500/20 disabled:opacity-50 transition-colors"
    >
      <RefreshCw size={10} className={busy ? 'animate-spin' : ''} /> {busy ? '…' : 'Opnieuw'}
    </button>
  )
}
