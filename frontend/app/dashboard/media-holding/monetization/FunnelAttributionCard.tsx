'use client'

import { useEffect, useState } from 'react'
import { Filter, Eye, MousePointerClick, UserPlus, BadgeEuro } from 'lucide-react'

type VideoRow = { content_item_id: string; title: string | null; channel_name: string | null; clicks: number; leads: number; sales: number; revenue: number }
type Resp = {
  totals: { views: number; clicks: number; leads: number; sales: number; revenue: number }
  channels: unknown[]
  top_videos: VideoRow[]
}

const num = (n: number | null | undefined) => Number(n ?? 0).toLocaleString('nl-NL')
const eur = (n: number | null | undefined) => `€ ${Number(n ?? 0).toFixed(2)}`

// S4 — Funnel & attributie: Kanaal → Video → Klik → Lead → Sale → Omzet.
export default function FunnelAttributionCard() {
  const [data, setData] = useState<Resp | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    fetch('/api/media-holding/metrics/funnel')
      .then((r) => (r.ok ? r.json() : null))
      .then((d: Resp | null) => { if (alive) setData(d) })
      .catch(() => { if (alive) setData(null) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [])

  const t = data?.totals
  const noData = !loading && (t?.clicks ?? 0) === 0 && (t?.revenue ?? 0) === 0

  const stages = [
    { icon: Eye,                label: 'Views',  value: num(t?.views) },
    { icon: MousePointerClick,  label: 'Klikken', value: num(t?.clicks) },
    { icon: UserPlus,           label: 'Leads',  value: num(t?.leads) },
    { icon: BadgeEuro,          label: 'Sales',  value: num(t?.sales) },
  ]

  return (
    <div className="bg-white/[0.03] border border-white/10 rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Filter size={15} className="text-cyan-400" />
        <h2 className="text-sm font-semibold text-white">Funnel &amp; attributie</h2>
        <span className="text-[10px] text-white/40">kanaal → video → klik → lead → sale</span>
        <span className="ml-auto text-[11px] font-semibold text-emerald-300">{loading ? '…' : eur(t?.revenue)}</span>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {stages.map((s) => (
          <div key={s.label} className="bg-white/[0.04] border border-white/5 rounded-lg p-2.5">
            <div className="flex items-center gap-1 text-white/45"><s.icon size={11} /><span className="text-[10px]">{s.label}</span></div>
            <p className="text-sm font-semibold text-white mt-0.5">{loading ? '…' : s.value}</p>
          </div>
        ))}
      </div>

      {noData && (
        <p className="text-[10px] text-amber-300/80 bg-amber-500/5 border border-amber-500/15 rounded-md px-3 py-2">
          Nog geen klikken/omzet — de funnel vult zich zodra affiliate-links via <code>/r/&lt;code&gt;</code>
          geklikt worden en netwerk-conversies via de webhook binnenkomen.
        </p>
      )}

      {!loading && (data?.top_videos?.length ?? 0) > 0 && (
        <div className="space-y-1">
          <p className="text-[11px] text-white/55 font-medium">Top videos op omzet (attributie)</p>
          {data!.top_videos.slice(0, 6).map((v) => (
            <div key={v.content_item_id} className="flex items-center justify-between gap-3 bg-white/[0.03] border border-white/5 rounded-md px-2.5 py-1.5">
              <div className="min-w-0">
                <p className="text-[11px] text-white/85 truncate">{v.title || 'Untitled'}</p>
                <p className="text-[10px] text-white/40">{v.channel_name} · {num(v.clicks)} klik · {num(v.sales)} sale</p>
              </div>
              <span className="text-[11px] font-medium text-emerald-300 shrink-0">{eur(v.revenue)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
