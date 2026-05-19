'use client'

import { useState } from 'react'
import { RefreshCw, AlertCircle } from 'lucide-react'

export default function SyncButton() {
  const [loading, setLoading] = useState(false)
  const [done,    setDone]    = useState(false)
  const [error,   setError]   = useState(false)

  async function sync() {
    setLoading(true)
    setDone(false)
    setError(false)
    try {
      const res = await fetch('/api/youtube/sync', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
      if (!res.ok) throw new Error()
      setDone(true)
      setTimeout(() => setDone(false), 3000)
    } catch {
      setError(true)
      setTimeout(() => setError(false), 4000)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={sync}
      disabled={loading}
      className={`flex items-center gap-2 px-3 py-1.5 border rounded-lg text-xs transition-all disabled:opacity-50 ${
        error
          ? 'bg-red-500/10 border-red-500/30 text-red-400'
          : 'bg-white/5 border-white/10 text-white/60 hover:text-white hover:bg-white/10'
      }`}
    >
      {error
        ? <AlertCircle size={12} />
        : <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
      }
      {error ? 'Sync mislukt' : done ? 'Gesynchroniseerd ✓' : loading ? 'Syncing…' : 'Sync'}
    </button>
  )
}
