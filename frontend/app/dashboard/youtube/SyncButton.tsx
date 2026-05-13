'use client'

import { useState } from 'react'
import { RefreshCw } from 'lucide-react'

export default function SyncButton() {
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  async function sync() {
    setLoading(true)
    setDone(false)
    try {
      await fetch('/api/youtube/sync', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
      setDone(true)
      setTimeout(() => setDone(false), 3000)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={sync}
      disabled={loading}
      className="flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs text-white/60 hover:text-white hover:bg-white/10 transition-all disabled:opacity-50"
    >
      <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
      {done ? 'Gesynchroniseerd' : loading ? 'Syncing…' : 'Sync'}
    </button>
  )
}
