'use client'

import { useEffect, useState } from 'react'
import { Megaphone, Trophy, AlertOctagon, Tv2, Upload, Banknote } from 'lucide-react'

type Board = {
  channels_active: number
  campaigns_active: number
  campaigns_winning: number
  jobs_blocked: number
  uploads_today: number
  revenue_today: number | null
  revenue_week: number | null
  revenue_month: number | null
}

const eur = (n: number) => Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n || 0)
const money = (n: number | null) => (n === null ? 'Geen data' : eur(n))

function Tile({ icon: Icon, label, value, accent }: { icon: typeof Tv2; label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-lg border border-white/8 bg-[#0e1525] px-3 py-2">
      <div className="flex items-center gap-1 text-[9px] uppercase tracking-wide text-white/40">
        <Icon size={11} />
        {label}
      </div>
      <div className="mt-0.5 text-base font-semibold tabular-nums" style={{ color: accent ?? '#fff' }}>{value}</div>
    </div>
  )
}

// Laag 7 — realtime Scoreboard, zichtbaar boven alle War Room-tabs.
export default function Scoreboard() {
  const [b, setB] = useState<Board | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let alive = true
    const load = async () => {
      try {
        const r = await fetch('/api/media-holding/war-room/scoreboard', { cache: 'no-store' })
        if (!r.ok) { if (alive) setFailed(true); return }
        const j = (await r.json()) as Board
        if (alive) { setB(j); setFailed(false) }
      } catch { if (alive) setFailed(true) }
    }
    load()
    const id = setInterval(load, 60_000)
    return () => { alive = false; clearInterval(id) }
  }, [])

  if (failed) {
    return <div className="rounded-lg border border-white/10 bg-[#0e1525] px-3 py-2 text-xs text-white/40">Scoreboard: geen data beschikbaar</div>
  }
  if (!b) {
    return <div className="h-[58px] animate-pulse rounded-lg border border-white/8 bg-[#0e1525]" />
  }

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-8">
      <Tile icon={Megaphone} label="Campagnes" value={String(b.campaigns_active)} />
      <Tile icon={Trophy} label="Winnend" value={String(b.campaigns_winning)} accent={b.campaigns_winning > 0 ? '#22c55e' : undefined} />
      <Tile icon={AlertOctagon} label="Geblokkeerd" value={String(b.jobs_blocked)} accent={b.jobs_blocked > 0 ? '#ef4444' : undefined} />
      <Tile icon={Tv2} label="Kanalen actief" value={String(b.channels_active)} />
      <Tile icon={Upload} label="Uploads vandaag" value={String(b.uploads_today)} />
      <Tile icon={Banknote} label="Omzet vandaag" value={money(b.revenue_today)} accent="#22c55e" />
      <Tile icon={Banknote} label="Omzet week" value={money(b.revenue_week)} accent="#22c55e" />
      <Tile icon={Banknote} label="Omzet maand" value={money(b.revenue_month)} accent="#22c55e" />
    </div>
  )
}
