'use client'

import { useState } from 'react'
import { RefreshCw, Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function ChannelDetailStats({ channelId }: { channelId: string }) {
  const [syncing, setSyncing] = useState(false)
  const router = useRouter()

  async function sync() {
    setSyncing(true)
    await fetch('/api/youtube/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channelId }),
    })
    router.refresh()
    setSyncing(false)
  }

  return (
    <div className="flex justify-end">
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
