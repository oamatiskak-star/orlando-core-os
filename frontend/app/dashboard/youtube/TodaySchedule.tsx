'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import clsx from 'clsx'

const DOT: Record<string, string> = {
  VermogenTv:        'bg-indigo-500',
  VastgoedTv:        'bg-sky-500',
  CryptoVermogen:    'bg-amber-500',
  BeleggingsTv:      'bg-violet-500',
  PropertyInvestorTv:'bg-pink-500',
  SpaarTv:           'bg-emerald-500',
}

const ST: Record<string, { l: string; c: string }> = {
  queued:                      { l: 'Gepland',     c: 'text-white/40' },
  retrying:                    { l: 'Retry',        c: 'text-orange-400' },
  preparing:                   { l: 'Bezig',        c: 'text-sky-400' },
  uploading:                   { l: 'Uploaden',     c: 'text-blue-400' },
  uploaded_pending_processing: { l: 'Verwerking',   c: 'text-violet-400' },
  verifying:                   { l: 'Verificatie',  c: 'text-yellow-400' },
  verified_live:               { l: 'Live ✓',       c: 'text-green-400' },
  failed:                      { l: 'Fout',         c: 'text-red-400' },
  manual_review_required:      { l: 'Review',       c: 'text-orange-400' },
}

type Row = { id: string; title: string; channel: string; at: string; status: string }

export default function TodaySchedule() {
  const [rows, setRows] = useState<Row[]>([])

  useEffect(() => {
    const sb = createClient()
    const load = async () => {
      const from = new Date(); from.setHours(0, 0, 0, 0)
      const to   = new Date(from); to.setDate(to.getDate() + 2)

      const { data } = await sb
        .from('youtube_upload_queue')
        .select('id, status, scheduled_publish_at, youtube_videos(title), youtube_channels(naam)')
        .gte('scheduled_publish_at', from.toISOString())
        .lt('scheduled_publish_at', to.toISOString())
        .order('scheduled_publish_at')
        .limit(40)

      if (data) setRows((data as any[]).map(r => ({
        id: r.id,
        title:   r.youtube_videos?.title  ?? '—',
        channel: r.youtube_channels?.naam ?? '—',
        at:      r.scheduled_publish_at,
        status:  r.status,
      })))
    }
    load()
    const t = setInterval(load, 60_000)
    return () => clearInterval(t)
  }, [])

  const todayStr    = new Date().toDateString()
  const today       = rows.filter(r => new Date(r.at).toDateString() === todayStr)
  const tomorrow    = rows.filter(r => new Date(r.at).toDateString() !== todayStr)

  const renderList  = (items: Row[]) => (
    <div className="divide-y divide-white/[0.04]">
      {items.map(r => {
        const dot  = DOT[r.channel] ?? 'bg-white/30'
        const st   = ST[r.status]   ?? { l: r.status, c: 'text-white/30' }
        const time = new Date(r.at).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })
        return (
          <div key={r.id} className="flex items-center gap-2.5 py-1.5">
            <span className="text-[11px] font-mono text-white/35 w-9 shrink-0">{time}</span>
            <span className={clsx('w-1.5 h-1.5 rounded-full shrink-0', dot)} />
            <span className="text-xs text-white/75 flex-1 truncate">{r.title}</span>
            <span className={clsx('text-[10px] shrink-0', st.c)}>{st.l}</span>
          </div>
        )
      })}
    </div>
  )

  if (rows.length === 0)
    return <p className="text-xs text-white/30 py-2">Geen uploads gepland</p>

  return (
    <div className="space-y-4">
      {today.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-widest text-white/25 mb-2">Vandaag — {today.length} video{today.length !== 1 ? "'s" : ''}</p>
          {renderList(today)}
        </div>
      )}
      {tomorrow.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-widest text-white/25 mb-2">Morgen — {tomorrow.length} video{tomorrow.length !== 1 ? "'s" : ''}</p>
          {renderList(tomorrow)}
        </div>
      )}
    </div>
  )
}
