'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw } from 'lucide-react'

// Lichte ververs-knop voor de Centrale bot-log: haalt de laatste log-entries
// opnieuw op (server re-fetch) zodat je live kunt meekijken of errors stoppen.
export default function BotLogRefresh() {
  const router = useRouter()
  const [pending, start] = useTransition()
  return (
    <button
      onClick={() => start(() => router.refresh())}
      disabled={pending}
      className="inline-flex items-center gap-1 text-[11px] text-white/50 hover:text-white/80 disabled:opacity-50 transition"
      title="Bot-log verversen"
    >
      <RefreshCw size={11} className={pending ? 'animate-spin' : ''} />
      {pending ? 'verversen…' : 'ververs'}
    </button>
  )
}
