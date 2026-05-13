'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { TrendingUp, Eye, Clock, MousePointerClick, DollarSign } from 'lucide-react'
import clsx from 'clsx'

type Analytics = {
  video_id: string
  youtube_video_id: string | null
  recorded_at: string
  views: number
  likes: number
  impressions: number
  ctr: number | null
  watch_time_minutes: number | null
  avg_view_percentage: number | null
  estimated_revenue: number | null
  rpm: number | null
  viral_score: number | null
  title_performance_score: number | null
  thumbnail_performance_score: number | null
  youtube_videos: { title: string; youtube_channels: { naam: string } | null } | null
}

type AggregateStats = {
  totalViews: number
  totalWatchTime: number
  avgCtr: number
  avgRetention: number
  totalRevenue: number
  avgViralScore: number
}

function ScoreBar({ label, score, color }: { label: string; score: number | null; color: string }) {
  const val = score ?? 0
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[10px]">
        <span className="text-white/50">{label}</span>
        <span className={color}>{val}</span>
      </div>
      <div className="h-1 bg-white/5 rounded-full overflow-hidden">
        <div className={clsx('h-full rounded-full transition-all', color.replace('text-', 'bg-'))}
          style={{ width: `${Math.min(val, 100)}%` }} />
      </div>
    </div>
  )
}

export default function AnalyticsInsights() {
  const [analytics, setAnalytics] = useState<Analytics[]>([])
  const [agg, setAgg] = useState<AggregateStats | null>(null)

  useEffect(() => {
    const supabase = createClient()

    async function fetch() {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

      const { data } = await supabase
        .from('youtube_video_analytics')
        .select(`
          *,
          youtube_videos(title, youtube_channels(naam))
        `)
        .gte('recorded_at', oneDayAgo)
        .order('recorded_at', { ascending: false })
        .limit(20)

      const rows = (data as Analytics[]) ?? []
      setAnalytics(rows)

      if (rows.length > 0) {
        setAgg({
          totalViews: rows.reduce((s, r) => s + (r.views ?? 0), 0),
          totalWatchTime: rows.reduce((s, r) => s + (r.watch_time_minutes ?? 0), 0),
          avgCtr: rows.reduce((s, r) => s + (r.ctr ?? 0), 0) / rows.length,
          avgRetention: rows.reduce((s, r) => s + (r.avg_view_percentage ?? 0), 0) / rows.length,
          totalRevenue: rows.reduce((s, r) => s + (r.estimated_revenue ?? 0), 0),
          avgViralScore: rows.reduce((s, r) => s + (r.viral_score ?? 0), 0) / rows.length,
        })
      }
    }

    fetch()
    const interval = setInterval(fetch, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  if (analytics.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10">
        <TrendingUp size={20} className="text-white/10 mb-2" />
        <p className="text-xs text-white/45">Geen analytics data beschikbaar</p>
        <p className="text-[11px] text-white/50 mt-1">Data verschijnt 24-48u na publicatie</p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {agg && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: 'Views', value: agg.totalViews.toLocaleString('nl-NL'), icon: Eye, color: 'text-sky-400' },
            { label: 'Watch time', value: `${Math.round(agg.totalWatchTime / 60)}u`, icon: Clock, color: 'text-violet-400' },
            { label: 'CTR', value: `${(agg.avgCtr * 100).toFixed(1)}%`, icon: MousePointerClick, color: agg.avgCtr > 0.07 ? 'text-green-400' : agg.avgCtr > 0.04 ? 'text-amber-400' : 'text-red-400' },
            { label: 'Retentie', value: `${Math.round(agg.avgRetention)}%`, icon: TrendingUp, color: agg.avgRetention > 50 ? 'text-green-400' : 'text-amber-400' },
            { label: 'Omzet', value: `€${agg.totalRevenue.toFixed(2)}`, icon: DollarSign, color: 'text-emerald-400' },
            { label: 'Viral', value: Math.round(agg.avgViralScore).toString(), icon: TrendingUp, color: agg.avgViralScore > 70 ? 'text-green-400' : agg.avgViralScore > 40 ? 'text-amber-400' : 'text-white/50' },
          ].map(s => {
            const Icon = s.icon
            return (
              <div key={s.label} className="bg-white/[0.06] border border-white/5 rounded-xl p-3">
                <Icon size={12} className={clsx('mb-2', s.color)} />
                <p className={clsx('text-lg font-bold', s.color)}>{s.value}</p>
                <p className="text-[10px] text-white/45">{s.label}</p>
              </div>
            )
          })}
        </div>
      )}

      <div className="space-y-2">
        {analytics.slice(0, 10).map((item, i) => (
          <div key={`${item.video_id}-${i}`} className="bg-white/[0.02] border border-white/5 rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-xs text-white/80 truncate">{item.youtube_videos?.title ?? 'Onbekend'}</p>
                <p className="text-[10px] text-white/45">{item.youtube_videos?.youtube_channels?.naam}</p>
              </div>
              <div className="text-right flex-shrink-0 ml-3">
                <p className="text-xs text-white/50">{(item.views ?? 0).toLocaleString('nl-NL')} views</p>
                <p className="text-[10px] text-white/45">CTR {((item.ctr ?? 0) * 100).toFixed(1)}%</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <ScoreBar label="Viral" score={item.viral_score} color="text-green-400" />
              <ScoreBar label="Titel" score={item.title_performance_score} color="text-sky-400" />
              <ScoreBar label="Thumbnail" score={item.thumbnail_performance_score} color="text-violet-400" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
