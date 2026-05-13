'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import clsx from 'clsx'
import NextLink from 'next/link'

type ChannelRow = {
  id: string
  naam: string
  subscriber_count: number
  view_count: number
  video_count: number
  today_views: number
  estimated_revenue: number
  oauth_status: string
  gepland: number
  uploads: number
  fouten: number
}

const COLORS: Record<string, string> = {
  VermogenTv:        '#6366f1',
  VastgoedTv:        '#0ea5e9',
  SpaarTv:           '#10b981',
  CryptoVermogen:    '#f59e0b',
  BeleggingsTv:      '#8b5cf6',
  PropertyInvestorTv:'#ec4899',
}

function num(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + 'K'
  return String(n)
}

export default function ChannelStatsTable() {
  const [rows, setRows] = useState<ChannelRow[]>([])

  useEffect(() => {
    const supabase = createClient()

    async function load() {
      const { data: channels } = await supabase
        .from('youtube_channels')
        .select('id, naam, subscriber_count, view_count, video_count, today_views, estimated_revenue, oauth_status')
        .order('subscriber_count', { ascending: false })

      if (!channels) return

      const enriched = await Promise.all(channels.map(async (ch) => {
        const [gepland, uploads, fouten] = await Promise.all([
          supabase.from('youtube_upload_queue')
            .select('id', { count: 'exact', head: true })
            .eq('channel_id', ch.id)
            .not('scheduled_publish_at', 'is', null)
            .gt('scheduled_publish_at', new Date().toISOString()),
          supabase.from('youtube_upload_queue')
            .select('id', { count: 'exact', head: true })
            .eq('channel_id', ch.id)
            .in('status', ['queued', 'uploading', 'processing', 'verifying', 'preparing', 'normalizing', 'retrying']),
          supabase.from('youtube_upload_queue')
            .select('id', { count: 'exact', head: true })
            .eq('channel_id', ch.id)
            .in('status', ['failed', 'manual_review_required']),
        ])
        return {
          id:                ch.id,
          naam:              ch.naam,
          subscriber_count:  ch.subscriber_count ?? 0,
          view_count:        ch.view_count ?? 0,
          video_count:       ch.video_count ?? 0,
          today_views:       ch.today_views ?? 0,
          estimated_revenue: ch.estimated_revenue ?? 0,
          oauth_status:      ch.oauth_status,
          gepland:           gepland.count ?? 0,
          uploads:           uploads.count ?? 0,
          fouten:            fouten.count ?? 0,
        }
      }))

      setRows(enriched)
    }

    load()
    const t = setInterval(load, 60_000)
    return () => clearInterval(t)
  }, [])

  const totals = rows.reduce(
    (acc, r) => ({
      subscriber_count:  acc.subscriber_count  + r.subscriber_count,
      view_count:        acc.view_count        + r.view_count,
      video_count:       acc.video_count       + r.video_count,
      today_views:       acc.today_views       + r.today_views,
      estimated_revenue: acc.estimated_revenue + r.estimated_revenue,
      gepland:           acc.gepland           + r.gepland,
      uploads:           acc.uploads           + r.uploads,
      fouten:            acc.fouten            + r.fouten,
    }),
    { subscriber_count: 0, view_count: 0, video_count: 0, today_views: 0, estimated_revenue: 0, gepland: 0, uploads: 0, fouten: 0 },
  )

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-white/5">
            <th className="text-left py-2 pr-4 text-white/50 font-medium">Kanaal</th>
            <th className="text-right py-2 px-3 text-white/50 font-medium">Abonnees</th>
            <th className="text-right py-2 px-3 text-white/50 font-medium">Views totaal</th>
            <th className="text-right py-2 px-3 text-white/50 font-medium">Vandaag</th>
            <th className="text-right py-2 px-3 text-white/50 font-medium">Video's</th>
            <th className="text-right py-2 px-3 text-white/50 font-medium">Gepland</th>
            <th className="text-right py-2 px-3 text-white/50 font-medium">Uploads</th>
            <th className="text-right py-2 px-3 text-white/50 font-medium">Revenue</th>
            <th className="text-right py-2 text-white/50 font-medium">Fouten</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => {
            const color = COLORS[row.naam] ?? '#6366f1'
            return (
              <tr key={row.id} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                <td className="py-2.5 pr-4">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                    <NextLink href={`/dashboard/youtube/channel/${row.id}`} className="text-white/70 font-medium hover:text-indigo-300 transition-colors">
                      {row.naam}
                    </NextLink>
                    {row.oauth_status !== 'connected' && (
                      <span className="text-[9px] px-1 py-0.5 rounded bg-amber-500/10 text-amber-400">{row.oauth_status}</span>
                    )}
                  </div>
                </td>
                <td className={clsx('text-right py-2.5 px-3 font-mono tabular-nums', row.subscriber_count > 0 ? 'text-indigo-400' : 'text-white/50')}>
                  {num(row.subscriber_count)}
                </td>
                <td className={clsx('text-right py-2.5 px-3 font-mono tabular-nums', row.view_count > 0 ? 'text-sky-400' : 'text-white/50')}>
                  {num(row.view_count)}
                </td>
                <td className={clsx('text-right py-2.5 px-3 font-mono tabular-nums', row.today_views > 0 ? 'text-green-400' : 'text-white/50')}>
                  {num(row.today_views)}
                </td>
                <td className={clsx('text-right py-2.5 px-3 font-mono tabular-nums', row.video_count > 0 ? 'text-white/60' : 'text-white/50')}>
                  {row.video_count}
                </td>
                <td className={clsx('text-right py-2.5 px-3 font-mono tabular-nums', row.gepland > 0 ? 'text-violet-400' : 'text-white/50')}>
                  {row.gepland}
                </td>
                <td className={clsx('text-right py-2.5 px-3 font-mono tabular-nums', row.uploads > 0 ? 'text-amber-400' : 'text-white/50')}>
                  {row.uploads}
                </td>
                <td className={clsx('text-right py-2.5 px-3 font-mono tabular-nums', row.estimated_revenue > 0 ? 'text-amber-400' : 'text-white/50')}>
                  €{row.estimated_revenue.toFixed(2)}
                </td>
                <td className={clsx('text-right py-2.5 font-mono tabular-nums font-bold', row.fouten > 0 ? 'text-red-400' : 'text-white/50')}>
                  {row.fouten}
                </td>
              </tr>
            )
          })}
        </tbody>
        <tfoot>
          <tr className="border-t border-white/10">
            <td className="py-2.5 pr-4 text-white/65 font-semibold text-[11px]">Totaal</td>
            <td className={clsx('text-right py-2.5 px-3 font-mono tabular-nums font-semibold', totals.subscriber_count > 0 ? 'text-indigo-400' : 'text-white/50')}>{num(totals.subscriber_count)}</td>
            <td className={clsx('text-right py-2.5 px-3 font-mono tabular-nums font-semibold', totals.view_count > 0 ? 'text-sky-400' : 'text-white/50')}>{num(totals.view_count)}</td>
            <td className={clsx('text-right py-2.5 px-3 font-mono tabular-nums font-semibold', totals.today_views > 0 ? 'text-green-400' : 'text-white/50')}>{num(totals.today_views)}</td>
            <td className={clsx('text-right py-2.5 px-3 font-mono tabular-nums font-semibold', totals.video_count > 0 ? 'text-white/60' : 'text-white/50')}>{totals.video_count}</td>
            <td className={clsx('text-right py-2.5 px-3 font-mono tabular-nums font-semibold', totals.gepland > 0 ? 'text-violet-400' : 'text-white/50')}>{totals.gepland}</td>
            <td className={clsx('text-right py-2.5 px-3 font-mono tabular-nums font-semibold', totals.uploads > 0 ? 'text-amber-400' : 'text-white/50')}>{totals.uploads}</td>
            <td className={clsx('text-right py-2.5 px-3 font-mono tabular-nums font-semibold', totals.estimated_revenue > 0 ? 'text-amber-400' : 'text-white/50')}>€{totals.estimated_revenue.toFixed(2)}</td>
            <td className={clsx('text-right py-2.5 font-mono tabular-nums font-semibold', totals.fouten > 0 ? 'text-red-400' : 'text-white/50')}>{totals.fouten}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
