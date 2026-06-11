'use client'

import { useMemo, useState } from 'react'

type Event = { ts: string; event_type: string; entity_slug: string; node_id: string; label: string }

const ZOOMS = [
  { key: 'day', label: 'Dag', days: 1 }, { key: 'week', label: 'Week', days: 7 },
  { key: 'month', label: 'Maand', days: 31 }, { key: 'quarter', label: 'Kwartaal', days: 92 },
  { key: 'year', label: 'Jaar', days: 366 }, { key: 'all', label: 'Alles', days: null as number | null },
]

const COLOR: Record<string, string> = {
  project_started: '#38bdf8', project_target: '#f59e0b',
}
function evColor(t: string) {
  if (t.startsWith('tracker_item')) return '#22d3ee'
  return COLOR[t] ?? '#64748b'
}

export default function TimelineView({ events }: { events: Event[] }) {
  const [zoom, setZoom] = useState('all')
  const days = ZOOMS.find((z) => z.key === zoom)?.days ?? null

  const filtered = useMemo(() => {
    const list = days == null ? events : events.filter((e) => {
      const t = e.ts ? new Date(e.ts).getTime() : null
      return t != null && t >= Date.now() - days * 86400000
    })
    return list.filter((e) => e.ts).sort((a, b) => +new Date(b.ts) - +new Date(a.ts))
  }, [events, days])

  // groepeer per dag
  const groups = useMemo(() => {
    const m = new Map<string, Event[]>()
    for (const e of filtered) {
      const d = new Date(e.ts).toLocaleDateString('nl-NL', { year: 'numeric', month: 'long', day: 'numeric' })
      if (!m.has(d)) m.set(d, [])
      m.get(d)!.push(e)
    }
    return [...m.entries()]
  }, [filtered])

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1 rounded border border-white/10 bg-[#0e1525] p-0.5 w-fit">
        {ZOOMS.map((z) => (
          <button key={z.key} onClick={() => setZoom(z.key)}
            className={`rounded px-2.5 py-1 text-[11px] font-medium ${zoom === z.key ? 'bg-violet-500/25 text-violet-300' : 'text-white/45 hover:text-white/70'}`}>
            {z.label}
          </button>
        ))}
        <span className="px-2 text-[10px] text-white/35">{filtered.length} events</span>
      </div>

      {groups.length === 0 && <div className="text-sm text-white/40">Geen events in dit venster.</div>}

      <div className="space-y-5">
        {groups.map(([day, evs]) => (
          <div key={day}>
            <div className="mb-1.5 text-xs font-semibold text-white/60">{day}</div>
            <div className="space-y-1.5 border-l border-white/10 pl-4">
              {evs.map((e, i) => (
                <div key={e.node_id + i} className="relative flex items-center gap-2 text-xs">
                  <span className="absolute -left-[21px] h-2 w-2 rounded-full" style={{ background: evColor(e.event_type) }} />
                  <span className="rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide"
                    style={{ color: evColor(e.event_type), background: `${evColor(e.event_type)}1a` }}>
                    {e.event_type.replace(/_/g, ' ')}
                  </span>
                  <span className="text-white/80 line-clamp-1">{e.label}</span>
                  <span className="ml-auto text-[10px] text-white/35">{e.entity_slug}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
