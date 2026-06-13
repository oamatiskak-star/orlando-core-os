'use client'

// CEO-OS "glazen wand" — ververst de server-gerenderde Command Center periodiek (router.refresh
// re-runt de force-dynamic page → alle views/health/minutes/incidenten updaten zichzelf).
// Pauzeerbaar; pauzeert automatisch wanneer de tab niet zichtbaar is (geen onnodige load).
import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function AutoRefresh({ intervalSec = 30 }: { intervalSec?: number }) {
  const router = useRouter()
  const [paused, setPaused] = useState(false)
  const [last, setLast] = useState<string | null>(null)
  const tick = useCallback(() => {
    if (typeof document !== 'undefined' && document.hidden) return
    router.refresh()
    setLast(new Date().toLocaleTimeString('nl-NL'))
  }, [router])
  const tickRef = useRef(tick)
  tickRef.current = tick

  useEffect(() => {
    if (paused) return
    const id = setInterval(() => tickRef.current(), Math.max(10, intervalSec) * 1000)
    return () => clearInterval(id)
  }, [paused, intervalSec])

  return (
    <div className="flex items-center gap-2 text-[10px] text-white/40">
      <span className="flex items-center gap-1">
        <span className={`h-1.5 w-1.5 rounded-full ${paused ? 'bg-white/30' : 'bg-emerald-400 animate-pulse'}`} />
        {paused ? 'verversen gepauzeerd' : `live · elke ${intervalSec}s`}
      </span>
      {last && <span>· bijgewerkt {last}</span>}
      <button onClick={() => setPaused((p) => !p)}
        className="rounded border border-white/10 px-1.5 py-0.5 hover:text-white/70">
        {paused ? 'hervat' : 'pauze'}
      </button>
    </div>
  )
}
