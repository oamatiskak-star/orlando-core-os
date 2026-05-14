'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import clsx from 'clsx'

type QRow = { id: string; naam: string; upload_quota_used: number | null; oauth_status: string }

const MAX = 6

function timeUntilReset() {
  const now = new Date()
  const next = new Date(now)
  next.setUTCHours(7, 0, 0, 0)
  if (next <= now) next.setUTCDate(next.getUTCDate() + 1)
  const ms = next.getTime() - now.getTime()
  const h = Math.floor(ms / 3_600_000)
  const m = Math.floor((ms % 3_600_000) / 60_000)
  return `${h}u ${m}m`
}

export default function QuotaBoard() {
  const [rows, setRows] = useState<QRow[]>([])

  useEffect(() => {
    const sb = createClient()
    const load = async () => {
      const { data } = await sb
        .from('youtube_channels')
        .select('id, naam, upload_quota_used, oauth_status')
        .order('naam')
      if (data) setRows(data as QRow[])
    }
    load()
    const t = setInterval(load, 30_000)
    return () => clearInterval(t)
  }, [])

  return (
    <div className="space-y-3">
      <p className="text-[11px] text-white/35">Reset over {timeUntilReset()} · max {MAX} uploads/dag</p>
      {rows.map(r => {
        const used = r.upload_quota_used ?? 0
        const pct  = Math.min((used / MAX) * 100, 100)
        const bar  = used >= MAX ? 'bg-red-500' : used >= MAX - 1 ? 'bg-yellow-400' : 'bg-green-500'
        return (
          <div key={r.id} className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-white/80">{r.naam}</span>
              <span className={clsx('text-xs font-mono tabular-nums', used >= MAX ? 'text-red-400' : 'text-white/45')}>
                {used}/{MAX}
              </span>
            </div>
            <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div className={clsx('h-full rounded-full transition-all duration-500', bar)} style={{ width: `${pct}%` }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}
