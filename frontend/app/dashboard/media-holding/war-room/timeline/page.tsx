import { createClient } from '@/lib/supabase/server'
import { statusColor } from '@/lib/war-room/graph'

export const dynamic = 'force-dynamic'

type Item = {
  id: string
  date: string | null
  channel: string | null
  title: string | null
  thumbnail_concept: string | null
  video_type: string | null
  status: string | null
}

const DAYS = 7

function dayLabel(dateISO: string, todayISO: string): string {
  const d = new Date(dateISO + 'T00:00:00')
  const t = new Date(todayISO + 'T00:00:00')
  const diff = Math.round((d.getTime() - t.getTime()) / 86400000)
  if (diff === 0) return 'Vandaag'
  if (diff === 1) return 'Morgen'
  if (diff === 2) return 'Overmorgen'
  return d.toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'short' })
}

export default async function TimelinePage() {
  const supabase = await createClient()
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayISO = today.toISOString().slice(0, 10)
  const horizon = new Date(today)
  horizon.setDate(horizon.getDate() + DAYS)
  const horizonISO = horizon.toISOString().slice(0, 10)

  const { data, error } = await supabase
    .from('yt_content_calendar')
    .select('id, channel_id, publish_date, title, thumbnail_concept, video_type, status')
    .gte('publish_date', todayISO)
    .lt('publish_date', horizonISO)
    .order('publish_date', { ascending: true })
    .limit(300)

  if (error) {
    return <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-300">Fout: {error.message}</div>
  }

  const items = (data ?? []).map((r) => ({
    id: r.id, date: r.publish_date, channel: r.channel_id, title: r.title,
    thumbnail_concept: r.thumbnail_concept, video_type: r.video_type, status: r.status,
  })) as Item[]

  const byDay = new Map<string, Item[]>()
  for (const it of items) {
    if (!it.date) continue
    if (!byDay.has(it.date)) byDay.set(it.date, [])
    byDay.get(it.date)!.push(it)
  }
  const days = [...byDay.keys()].sort()

  return (
    <div className="space-y-4">
      <p className="text-xs text-white/45">
        Wat komt eraan ({DAYS} dagen). De fabriek werkt vooruit — vroeg patronen of fouten spotten, niet goedkeuren.
      </p>
      {days.length === 0 && (
        <div className="rounded-lg border border-white/10 bg-[#0e1525] p-6 text-sm text-white/50">
          Geen geplande content in de komende {DAYS} dagen.
        </div>
      )}
      {days.map((day) => (
        <div key={day}>
          <div className="mb-2 flex items-center gap-2">
            <h3 className="text-sm font-semibold capitalize text-white">{dayLabel(day, todayISO)}</h3>
            <span className="text-[10px] text-white/35">{byDay.get(day)!.length} items</span>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {byDay.get(day)!.map((it) => (
              <div key={it.id} className="flex gap-2 rounded-lg border border-white/8 bg-[#0e1525] p-2.5">
                <div className="flex h-14 w-20 shrink-0 items-center justify-center rounded bg-gradient-to-br from-violet-500/15 to-cyan-500/10 p-1 text-center text-[8px] leading-tight text-white/50 border border-white/5">
                  {it.thumbnail_concept ? <span className="line-clamp-4">{it.thumbnail_concept}</span> : <span className="italic text-white/25">geen concept</span>}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-medium text-white">{it.title ?? 'Zonder titel'}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[9px] text-white/40">
                    {it.channel && <span className="truncate max-w-[90px]">{it.channel}</span>}
                    {it.video_type && <span className="rounded bg-white/5 px-1">{it.video_type}</span>}
                    {it.status && (
                      <span style={{ color: statusColor(it.status) }} className="font-semibold uppercase">{it.status}</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
