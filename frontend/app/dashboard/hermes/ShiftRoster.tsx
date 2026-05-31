'use client'

import { useEffect, useState } from 'react'

type ShiftWorkers = { shift: string; workers: number; errors: number; actief: number; offline: number }

const SHIFTS = [
  { key: 'nacht', icon: '🌙', label: 'Nacht-productie',  time: '00:00–06:00', taak: 'render · queue · DB-onderhoud',      start: 0,  end: 6,  work: 'nacht' },
  { key: 's2',    icon: '🧹', label: 'Janitor + prep',   time: '06:00–07:00', taak: 'controle nacht · opschonen',         start: 6,  end: 7,  janitor: true },
  { key: 'dag',   icon: '☀️', label: 'Dag-intelligence', time: '07:00–17:00', taak: 'scrapers · analyse · planning',      start: 7,  end: 17, work: 'dag' },
  { key: 's4',    icon: '🧹', label: 'Janitor + prep',   time: '17:00–18:00', taak: 'controle dag · opschonen',           start: 17, end: 18, janitor: true },
  { key: 'avond', icon: '🌆', label: 'Avond-publicatie', time: '18:00–00:00', taak: 'uploads · distributie · rapportage', start: 18, end: 24, work: 'avond' },
] as const

function nlHour(): number {
  const s = new Date().toLocaleString('en-US', { timeZone: 'Europe/Amsterdam', hour: '2-digit', hour12: false })
  return parseInt(s, 10) % 24
}

export default function ShiftRoster({ shifts }: { shifts: ShiftWorkers[] }) {
  const [hour, setHour] = useState<number | null>(null)
  useEffect(() => {
    setHour(nlHour())
    const t = setInterval(() => setHour(nlHour()), 60_000)
    return () => clearInterval(t)
  }, [])

  const byShift = new Map(shifts.map((s) => [s.shift, s]))

  return (
    <section className="space-y-2">
      <h2 className="text-xs font-semibold text-white/60">🗓️ 5-Ploegenrooster · 24/7 bewaakt door Hermes</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
        {SHIFTS.map((s) => {
          const active = hour !== null && hour >= s.start && hour < s.end
          const w = 'work' in s ? byShift.get(s.work as string) : undefined
          return (
            <div key={s.key} className={`rounded-xl border p-3 transition-colors ${
              active ? 'border-fuchsia-500/40 bg-fuchsia-500/[0.08]'
                : 'janitor' in s ? 'border-emerald-500/15 bg-emerald-500/[0.04]'
                : 'border-white/10 bg-white/[0.04]'}`}>
              <div className="flex items-center justify-between">
                <span className="text-base">{s.icon}</span>
                {active && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-fuchsia-500/20 text-fuchsia-300 font-medium">nu</span>}
              </div>
              <p className="text-[11px] font-semibold text-white/85 mt-1 leading-tight">{s.label}</p>
              <p className="text-[10px] text-white/40 tabular-nums">{s.time}</p>
              <p className="text-[10px] text-white/45 mt-1 leading-snug">{s.taak}</p>
              {w && (
                <p className="text-[10px] mt-1.5">
                  <span className="text-white/70 tabular-nums">{w.workers} workers</span>
                  {w.errors > 0 && <span className="text-red-400"> · {w.errors} error</span>}
                </p>
              )}
              {'janitor' in s && <p className="text-[10px] text-emerald-400/70 mt-1.5">auto-opschoning</p>}
            </div>
          )
        })}
      </div>
    </section>
  )
}
