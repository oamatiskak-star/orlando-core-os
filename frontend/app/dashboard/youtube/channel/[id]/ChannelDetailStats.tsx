'use client'

import { useState } from 'react'
import { RefreshCw, Loader2, AlertCircle } from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function ChannelDetailStats({ channelId }: { channelId: string }) {
  const [syncing, setSyncing] = useState(false)
  const [error,   setError]   = useState(false)
  const router = useRouter()

  async function sync() {
    setSyncing(true)
    setError(false)
    try {
      const res = await fetch('/api/youtube/sync', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ channelId }),
      })
      if (!res.ok) throw new Error()
      router.refresh()
    } catch {
      setError(true)
      setTimeout(() => setError(false), 4000)
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="flex items-center justify-end gap-2">
      {error && (
        <span className="flex items-center gap-1.5 text-[11px] text-red-400">
          <AlertCircle size={11} /> Sync mislukt — probeer opnieuw
        </span>
      )}
      <button
        onClick={sync}
        disabled={syncing}
        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/50 hover:text-white/80 text-xs transition-colors disabled:opacity-50"
      >
        {syncing ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
        {syncing ? 'Syncing...' : 'Sync kanaal via YouTube API'}
      </button>
    </div>
  )
}
