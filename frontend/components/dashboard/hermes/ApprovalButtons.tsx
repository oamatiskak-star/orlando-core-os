'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function ApprovalButtons({ approvalId }: { approvalId: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState<null | 'approve' | 'reject'>(null)
  const [error, setError] = useState<string | null>(null)

  async function decide(decision: 'approve' | 'reject') {
    setBusy(decision)
    setError(null)
    try {
      const res = await fetch('/api/hermes/approvals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approval_id: approvalId, decision }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        setError(j.error ?? 'Mislukt')
        setBusy(null)
        return
      }
      router.refresh()
    } catch {
      setError('Netwerkfout')
      setBusy(null)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => decide('approve')}
        disabled={busy !== null}
        className="text-[10.5px] px-2 py-1 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/25 hover:bg-emerald-500/25 disabled:opacity-50"
      >
        {busy === 'approve' ? '…' : 'Goedkeuren'}
      </button>
      <button
        onClick={() => decide('reject')}
        disabled={busy !== null}
        className="text-[10.5px] px-2 py-1 rounded bg-rose-500/15 text-rose-300 border border-rose-500/25 hover:bg-rose-500/25 disabled:opacity-50"
      >
        {busy === 'reject' ? '…' : 'Afwijzen'}
      </button>
      {error && <span className="text-[10px] text-rose-400">{error}</span>}
    </div>
  )
}
