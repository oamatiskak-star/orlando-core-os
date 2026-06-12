'use client'

import { useEffect, useState } from 'react'
import { MonitorPlay } from 'lucide-react'

type ChannelRev = {
  channel_id: string; channel_name: string
  revenue_today: number; revenue_7d: number; revenue_30d: number
  views_30d: number; avg_ctr_7d: number | null; avg_rpm_30d: number | null
}
type TopVideo = {
  video_id: string; channel_name: string; title: string
  revenue_30d: number; views_30d: number; avg_ctr: number | null; avg_rpm: number | null
}
type Resp = {
  totals: { revenue_today: number; revenue_7d: number; revenue_30d: number; views_30d: number }
  channels: ChannelRev[]
  topVideos: TopVideo[]
}

const eur = (n: number | null | undefined) => `€ ${Number(n ?? 0).toFixed(2)}`
const num = (n: number | null | undefined) => Number(n ?? 0).toLocaleString('nl-NL')

// S1 — YouTube-omzet (organisch/AdSense) + CTR. Bron: /api/media-holding/metrics/revenue.
export default function YoutubeRevenueCard() {
  const [data, setData] = useState<Resp | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    fetch('/api/media-holding/metrics/revenue')
      .then((r) => (r.ok ? r.json() : null))
      .then((d: Resp | null) => { if (alive) setData(d) })
      .catch(() => { if (alive) setData(null) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [])

  const t = data?.totals
  const noYpp = !loading && (t?.revenue_30d ?? 0) === 0

  return (
    <div className="bg-white/[0.03] border border-white/10 rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <MonitorPlay size={15} className="text-red-400" />
        <h2 className="text-sm font-semibold text-white">YouTube-omzet (organisch)</h2>
        <span className="text-[10px] text-white/40">live uit youtube_video_analytics</span>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white/[0.04] border border-white/5 rounded-lg p-3">
          <p className="text-[10px] text-white/45">Vandaag</p>
          <p className="text-base font-semibold text-emerald-300">{loading ? '…' : eur(t?.revenue_today)}</p>
        </div>
        <div className="bg-white/[0.04] border border-white/5 rounded-lg p-3">
          <p className="text-[10px] text-white/45">7 dagen</p>
          <p className="text-base font-semibold text-emerald-300">{loading ? '…' : eur(t?.revenue_7d)}</p>
        </div>
        <div className="bg-white/[0.04] border border-white/5 rounded-lg p-3">
          <p className="text-[10px] text-white/45">30 dagen</p>
          <p className="text-base font-semibold text-emerald-300">{loading ? '…' : eur(t?.revenue_30d)}</p>
        </div>
      </div>

      {noYpp && (
        <p className="text-[10px] text-amber-300/80 bg-amber-500/5 border border-amber-500/15 rounded-md px-3 py-2">
          €0 — kanalen nog niet in YouTube Partner Program (YPP). De omzet-pijplijn is actief en vult
          zich automatisch zodra YPP + de monetary-scope geregeld zijn. CTR-data werkt los van YPP.
        </p>
      )}

      <div className="space-y-1.5">
        <p className="text-[11px] text-white/55 font-medium">Top videos op omzet (30d)</p>
        {loading ? (
          <p className="text-[11px] text-white/40">Laden…</p>
        ) : !data?.topVideos?.length ? (
          <p className="text-[11px] text-white/40 italic">Nog geen video-omzetdata.</p>
        ) : (
          <div className="space-y-1">
            {data.topVideos.slice(0, 8).map((v) => (
              <div key={v.video_id} className="flex items-center justify-between gap-3 bg-white/[0.03] border border-white/5 rounded-md px-2.5 py-1.5">
                <div className="min-w-0">
                  <p className="text-[11px] text-white/85 truncate">{v.title || 'Untitled'}</p>
                  <p className="text-[10px] text-white/40">{v.channel_name} · {num(v.views_30d)} views{v.avg_ctr ? ` · CTR ${Number(v.avg_ctr).toFixed(1)}%` : ''}</p>
                </div>
                <span className="text-[11px] font-medium text-emerald-300 shrink-0">{eur(v.revenue_30d)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
