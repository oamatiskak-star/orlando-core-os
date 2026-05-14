'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Gauge, AlertTriangle } from 'lucide-react'
import clsx from 'clsx'

type Channel = {
  id: string
  naam: string
  quota_used: number | null
  quota_limit: number | null
  oauth_connected: boolean
}

export default function QuotaMonitor() {
  const [channels, setChannels] = useState<Channel[]>([])

  useEffect(() => {
    const supabase = createClient()
    const fetch = async () => {
      const { data } = await supabase
        .from('youtube_channels')
        .select('id, naam, quota_used, quota_limit, oauth_connected')
        .order('naam')
      if (data) setChannels(data as Channel[])
    }
    fetch()
    const interval = setInterval(fetch, 30_000)
    return () => clearInterval(interval)
  }, [])

  if (!channels.length) return null

  return (
    <div className="space-y-2">
      {channels.map(ch => {
        const used  = ch.quota_used  ?? 0
        const limit = ch.quota_limit ?? 10_000
        const pct   = Math.min(100, Math.round((used / limit) * 100))
        const warn  = pct >= 80
        const crit  = pct >= 95

        return (
          <div key={ch.id} className="flex items-center gap-3 text-[11px]">
            <span className="text-white/60 w-32 truncate">{ch.naam}</span>
            {!ch.oauth_connected && (
              <span className="text-amber-400 text-[10px]">OAuth niet verbonden</span>
            )}
            <div className="flex-1 h-1.5 bg-white/8 rounded-full overflow-hidden">
              <div
                className={clsx(
                  'h-full rounded-full transition-all duration-500',
                  crit ? 'bg-red-500' : warn ? 'bg-amber-400' : 'bg-green-400'
                )}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className={clsx('w-24 text-right', crit ? 'text-red-400' : warn ? 'text-amber-400' : 'text-white/50')}>
              {used.toLocaleString('nl-NL')} / {limit.toLocaleString('nl-NL')}
            </span>
            <span className={clsx('w-8 text-right font-medium', crit ? 'text-red-400' : warn ? 'text-amber-400' : 'text-white/40')}>
              {pct}%
            </span>
            {warn && <AlertTriangle size={10} className={crit ? 'text-red-400' : 'text-amber-400'} />}
          </div>
        )
      })}
      <p className="text-[10px] text-white/30 pt-1">YouTube Data API — dagelijks quotum resets om 00:00 PT</p>
    </div>
  )
}
