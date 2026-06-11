'use client'

// Roadmap Timeline (hero) — Gantt-achtig. Priority-lanes (P0-P3), bars op start_at→end_at
// (estimated gestreept), milestone-markers op echte target_date, zoom + vandaag-lijn.
import { useMemo, useState } from 'react'
import { statusColor } from '@/lib/build-war-room/graph'

type Proj = {
  id: string; name: string; status_norm: string; priority_norm: string | null
  progress: number | null; start_at: string | null; end_at: string | null
  end_source: string; program: string
}
type Milestone = { naam: string; target_date: string | null; status: string | null }

const ZOOMS = [
  { key: 'month', label: 'Maand', days: 60 },
  { key: 'quarter', label: 'Kwartaal', days: 140 },
  { key: 'year', label: 'Jaar', days: 400 },
  { key: 'all', label: 'Alles', days: null as number | null },
]
const LANES = ['P0', 'P1', 'P2', 'P3', 'none'] as const
const LANE_LABEL: Record<string, string> = { P0: 'P0 · Kritiek', P1: 'P1 · Hoog', P2: 'P2 · Normaal', P3: 'P3 · Laag', none: 'Geen prio' }
const LANE_COLOR: Record<string, string> = { P0: '#ef4444', P1: '#f59e0b', P2: '#38bdf8', P3: '#64748b', none: '#475569' }
const DAY = 86400000

export default function RoadmapTimeline({ projects, milestones }: { projects: Proj[]; milestones: Milestone[] }) {
  const [zoom, setZoom] = useState('quarter')
  const dated = useMemo(() => projects.filter((p) => p.start_at && p.end_at), [projects])

  const { t0, t1 } = useMemo(() => {
    const now = Date.now()
    const z = ZOOMS.find((z) => z.key === zoom)
    if (z?.days == null) {
      const starts = dated.map((p) => +new Date(p.start_at!))
      const ends = dated.map((p) => +new Date(p.end_at!))
      const mn = starts.length ? Math.min(...starts) : now - 30 * DAY
      const mx = ends.length ? Math.max(...ends) : now + 30 * DAY
      return { t0: mn - 3 * DAY, t1: mx + 3 * DAY }
    }
    return { t0: now - z!.days * DAY * 0.25, t1: now + z!.days * DAY * 0.75 }
  }, [dated, zoom])

  const span = Math.max(1, t1 - t0)
  const pct = (ms: number) => ((ms - t0) / span) * 100
  const todayPct = pct(Date.now())

  // maand-ticks
  const ticks = useMemo(() => {
    const out: { left: number; label: string }[] = []
    const d = new Date(t0); d.setDate(1); d.setHours(0, 0, 0, 0)
    while (+d <= t1) {
      out.push({ left: pct(+d), label: d.toLocaleDateString('nl-NL', { month: 'short', year: '2-digit' }) })
      d.setMonth(d.getMonth() + 1)
    }
    return out.filter((t) => t.left >= -5 && t.left <= 105)
  }, [t0, t1, span])

  const lanes = useMemo(() => {
    const m = new Map<string, Proj[]>()
    for (const p of dated) {
      const lane = (p.priority_norm && LANES.includes(p.priority_norm as never)) ? p.priority_norm : 'none'
      if (!m.has(lane)) m.set(lane, [])
      m.get(lane)!.push(p)
    }
    return m
  }, [dated])

  const markers = useMemo(
    () => milestones.filter((mi) => mi.target_date).map((mi) => ({ ...mi, left: pct(+new Date(mi.target_date!)) }))
      .filter((mi) => mi.left >= 0 && mi.left <= 100),
    [milestones, t0, t1, span]
  )

  const undated = projects.length - dated.length

  return (
    <div className="rounded-lg border border-white/5 bg-[#0e1525] p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-semibold text-white/80">Roadmap Timeline</span>
        <div className="flex items-center gap-1 rounded border border-white/10 bg-[#070b14] p-0.5">
          {ZOOMS.map((z) => (
            <button key={z.key} onClick={() => setZoom(z.key)}
              className={`rounded px-2 py-1 text-[10px] font-medium ${zoom === z.key ? 'bg-violet-500/25 text-violet-300' : 'text-white/45 hover:text-white/70'}`}>
              {z.label}
            </button>
          ))}
        </div>
      </div>

      {/* tijd-as */}
      <div className="relative ml-40 h-5 border-b border-white/10">
        {ticks.map((t, i) => (
          <span key={i} className="absolute -translate-x-1/2 text-[9px] text-white/35" style={{ left: `${t.left}%` }}>{t.label}</span>
        ))}
        {markers.map((mi, i) => (
          <span key={`m${i}`} className="absolute top-0 -translate-x-1/2 text-[9px] text-amber-400" style={{ left: `${mi.left}%` }} title={mi.naam}>◆</span>
        ))}
      </div>

      {/* lanes */}
      <div className="relative max-h-[460px] overflow-y-auto">
        {/* vandaag-lijn */}
        {todayPct >= 0 && todayPct <= 100 && (
          <div className="pointer-events-none absolute top-0 bottom-0 z-10 w-px bg-violet-400/60"
            style={{ left: `calc(10rem + ${todayPct}% * (100% - 10rem) / 100)` }} />
        )}
        {LANES.map((lane) => {
          const items = lanes.get(lane) ?? []
          if (items.length === 0) return null
          return (
            <div key={lane} className="border-t border-white/5 py-1">
              <div className="flex items-center gap-1 px-1 text-[10px] font-bold" style={{ color: LANE_COLOR[lane] }}>
                <span className="h-2 w-2 rounded-sm" style={{ background: LANE_COLOR[lane] }} />{LANE_LABEL[lane]} <span className="text-white/30">({items.length})</span>
              </div>
              {items.map((p) => {
                const l = Math.max(0, pct(+new Date(p.start_at!)))
                const r = Math.min(100, pct(+new Date(p.end_at!)))
                const w = Math.max(1.5, r - l)
                if (r <= 0 || l >= 100) return null
                const col = statusColor(p.status_norm)
                const est = p.end_source === 'estimated'
                return (
                  <div key={p.id} className="flex items-center gap-2 py-0.5">
                    <div className="w-40 shrink-0 truncate pl-3 text-[10px] text-white/60" title={`${p.name} · ${p.program}`}>{p.name}</div>
                    <div className="relative h-4 flex-1">
                      <div className="absolute top-0.5 h-3 rounded" title={`${p.name} · ${p.status_norm} · ${p.progress ?? 0}% · ${est ? 'geschatte einddatum' : 'deadline'}`}
                        style={{ left: `${l}%`, width: `${w}%`, background: `${col}33`, border: `1px solid ${col}`, borderStyle: est ? 'dashed' : 'solid' }}>
                        <div className="h-full rounded-l" style={{ width: `${Math.min(100, p.progress ?? 0)}%`, background: col }} />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>

      <div className="mt-1.5 flex flex-wrap items-center gap-3 text-[9px] text-white/35">
        <span><span className="mr-1 inline-block h-2 w-2 rounded-sm bg-violet-400/60" />vandaag</span>
        <span>◆ milestone (target_date)</span>
        <span>— deadline · ┄ geschatte einddatum</span>
        {undated > 0 && <span className="text-amber-400/70">{undated} project(en) zonder datum (niet getoond)</span>}
      </div>
    </div>
  )
}
