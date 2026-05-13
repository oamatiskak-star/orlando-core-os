'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Clock, Calendar, Tv2, AlertCircle } from 'lucide-react'
import clsx from 'clsx'

type ScheduledItem = {
  id: string
  title: string | null
  status: string
  scheduled_publish_at: string
  channel_id: string
  youtube_channels: { naam: string } | null
  retry_count: number
}

const STATUS_COLOR: Record<string, string> = {
  queued:     'text-sky-400 bg-sky-500/10',
  uploading:  'text-indigo-400 bg-indigo-500/10',
  processing: 'text-amber-400 bg-amber-500/10',
  verifying:  'text-violet-400 bg-violet-500/10',
  verified_live: 'text-green-400 bg-green-500/10',
  failed:     'text-red-400 bg-red-500/10',
}

function fmt(iso: string) {
  const d = new Date(iso)
  return d.toLocaleString('nl-NL', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function timeUntil(iso: string) {
  const diff = new Date(iso).getTime() - Date.now()
  if (diff < 0) return 'Verlopen'
  const h = Math.floor(diff / 3_600_000)
  const m = Math.floor((diff % 3_600_000) / 60_000)
  if (h > 24) return `${Math.floor(h / 24)}d ${h % 24}u`
  return `${h}u ${m}m`
}

export default function ScheduledPage() {
  const [items, setItems] = useState<ScheduledItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()

    async function load() {
      const { data } = await supabase
        .from('youtube_upload_queue')
        .select('id, title, status, scheduled_publish_at, channel_id, retry_count, youtube_channels(naam)')
        .not('video_id', 'is', null)
        .not('status', 'eq', 'planned')
        .order('scheduled_publish_at', { ascending: true })
        .limit(200)

      setItems((data ?? []) as unknown as ScheduledItem[])
      setLoading(false)
    }

    load()
    const t = setInterval(load, 15_000)
    return () => clearInterval(t)
  }, [])

  const upcoming = items.filter(i => new Date(i.scheduled_publish_at) > new Date())
  const past     = items.filter(i => new Date(i.scheduled_publish_at) <= new Date())

  return (
    <div className="space-y-5">
      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Totaal gepland',  value: items.length,    color: 'text-white/70' },
          { label: 'Upcoming',        value: upcoming.length,  color: 'text-indigo-400' },
          { label: 'Verlopen',        value: past.length,      color: 'text-amber-400' },
          { label: 'Failed',          value: items.filter(i => i.status === 'failed').length, color: 'text-red-400' },
        ].map(s => (
          <div key={s.label} className="bg-white/[0.06] border border-white/5 rounded-xl p-4">
            <p className={clsx('text-2xl font-bold', s.color)}>{s.value}</p>
            <p className="text-[11px] text-white/50 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white/[0.06] border border-white/5 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Clock size={14} className="text-white/65" />
          <h2 className="text-sm font-semibold text-white">Geplande Uploads</h2>
          <div className="ml-auto flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
            <span className="text-[11px] text-white/45">Live · 15s</span>
          </div>
        </div>

        {loading ? (
          <p className="text-xs text-white/50 text-center py-8">Laden...</p>
        ) : items.length === 0 ? (
          <div className="text-center py-10 space-y-2">
            <Calendar size={28} className="text-white/10 mx-auto" />
            <p className="text-xs text-white/50">Geen geplande uploads</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left py-2 pr-4 text-white/50 font-medium">Titel</th>
                  <th className="text-left py-2 pr-4 text-white/50 font-medium">Kanaal</th>
                  <th className="text-left py-2 pr-4 text-white/50 font-medium">Gepland</th>
                  <th className="text-left py-2 pr-4 text-white/50 font-medium">Over</th>
                  <th className="text-left py-2 pr-4 text-white/50 font-medium">Status</th>
                  <th className="text-right py-2 text-white/50 font-medium">Pogingen</th>
                </tr>
              </thead>
              <tbody>
                {items.map(item => (
                  <tr key={item.id} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                    <td className="py-2.5 pr-4 text-white/70 max-w-[200px] truncate">
                      {item.title ?? '—'}
                    </td>
                    <td className="py-2.5 pr-4">
                      <div className="flex items-center gap-1.5">
                        <Tv2 size={11} className="text-white/45" />
                        <span className="text-white/50">{item.youtube_channels?.naam ?? '—'}</span>
                      </div>
                    </td>
                    <td className="py-2.5 pr-4 text-white/65 font-mono">{fmt(item.scheduled_publish_at)}</td>
                    <td className={clsx('py-2.5 pr-4 font-medium', new Date(item.scheduled_publish_at) > new Date() ? 'text-indigo-400' : 'text-white/45')}>
                      {timeUntil(item.scheduled_publish_at)}
                    </td>
                    <td className="py-2.5 pr-4">
                      <span className={clsx('px-2 py-0.5 rounded-full text-[10px] font-medium', STATUS_COLOR[item.status] ?? 'text-white/50 bg-white/5')}>
                        {item.status}
                      </span>
                    </td>
                    <td className={clsx('py-2.5 text-right font-mono', item.retry_count > 0 ? 'text-amber-400' : 'text-white/38')}>
                      {item.retry_count}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
