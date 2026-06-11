'use client'

// Laatste Activiteit — live feed (v_build_activity_feed) met realtime refresh.
import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Event = { ts: string; event_type: string; entity_slug: string | null; node_id: string; label: string }

function ago(ts: string) {
  const s = Math.max(0, (Date.now() - +new Date(ts)) / 1000)
  if (s < 3600) return `${Math.round(s / 60)}m`
  if (s < 86400) return `${Math.round(s / 3600)}u`
  return `${Math.round(s / 86400)}d`
}
function color(t: string) {
  if (t.startsWith('project_started')) return '#38bdf8'
  if (t.startsWith('project_target')) return '#f59e0b'
  if (t.startsWith('project_update')) return '#22d3ee'
  if (t.startsWith('tracker_item')) return '#22d3ee'
  return '#64748b'
}

export default function ActivityFeed({ initial }: { initial: Event[] }) {
  const [events, setEvents] = useState(initial)

  const refetch = useCallback(async () => {
    try {
      const res = await fetch('/api/build-tracker/war-room/timeline', { cache: 'no-store' })
      if (!res.ok) return
      const j = await res.json()
      setEvents((j.events ?? []).slice(0, 30))
    } catch { /* stil */ }
  }, [])

  useEffect(() => {
    const sb = createClient()
    const ch = sb.channel('roadmap-activity')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'build_tracker' }, refetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'build_tracker_items' }, refetch)
      .subscribe()
    return () => { sb.removeChannel(ch) }
  }, [refetch])

  return (
    <div className="rounded-lg border border-white/5 bg-[#0e1525] p-3">
      <div className="mb-2 text-xs font-semibold text-white/80">Laatste Activiteit</div>
      <div className="max-h-64 space-y-1 overflow-y-auto">
        {events.slice(0, 30).map((e, i) => (
          <div key={e.node_id + i} className="flex items-center gap-2 text-[11px]">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: color(e.event_type) }} />
            <span className="flex-1 truncate text-white/70">{e.label}</span>
            <span className="text-[9px] text-white/30">{e.entity_slug}</span>
            <span className="w-7 text-right text-[9px] text-white/35">{ago(e.ts)}</span>
          </div>
        ))}
        {events.length === 0 && <div className="text-[11px] text-white/40">Geen recente activiteit.</div>}
      </div>
    </div>
  )
}
