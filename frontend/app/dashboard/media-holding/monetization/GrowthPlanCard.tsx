'use client'

import { useEffect, useState } from 'react'
import { Rocket, Crown, Sprout, Ban } from 'lucide-react'

type Alloc = {
  channel_id: string; channel_name: string | null; priority_rank: number | null
  growth_score: number | null; capacity_share: number | null; videos_per_day: number | null
  director_action: string | null
}
type Niche = { niche: string; win_rate: number | null; niche_action: string }
type Resp = {
  allocations: Alloc[]
  priority_channel: Alloc | null
  niches: { expand: Niche[]; terminate: Niche[]; all: Niche[] }
  forecast: { channel_name: string | null; projected_views_30d: number | null; subs_to_ypp: number | null }[]
}

const num = (n: number | null | undefined) => Number(n ?? 0).toLocaleString('nl-NL')
const pct = (n: number | null | undefined) => `${Math.round(Number(n ?? 0) * 100)}%`

// S6 — Autonomous growth: prioriteitskanaal + capaciteitsallocatie + niche expand/terminate.
export default function GrowthPlanCard() {
  const [data, setData] = useState<Resp | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    fetch('/api/media-holding/metrics/growth')
      .then((r) => (r.ok ? r.json() : null))
      .then((d: Resp | null) => { if (alive) setData(d) })
      .catch(() => { if (alive) setData(null) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [])

  const allocs = data?.allocations ?? []
  const prio = data?.priority_channel

  return (
    <div className="bg-gradient-to-br from-sky-500/[0.06] to-transparent border border-sky-500/15 rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Rocket size={15} className="text-sky-400" />
        <h2 className="text-sm font-semibold text-white">Autonomous Growth Plan</h2>
        <span className="text-[10px] text-white/40">prioritering + capaciteitsallocatie</span>
      </div>

      {loading ? (
        <p className="text-[11px] text-white/40">Laden…</p>
      ) : allocs.length === 0 ? (
        <p className="text-[10px] text-amber-300/80 bg-amber-500/5 border border-amber-500/15 rounded-md px-3 py-2">
          Nog geen groeiplan — draait wekelijks; cron kan handmatig getriggerd worden.
        </p>
      ) : (
        <>
          {prio && (
            <div className="flex items-center gap-2 bg-sky-500/10 border border-sky-500/20 rounded-lg px-3 py-2">
              <Crown size={14} className="text-amber-300 shrink-0" />
              <p className="text-[11px] text-white/85">
                Prioriteitskanaal: <span className="font-semibold text-white">{prio.channel_name}</span>
                <span className="text-white/45"> · {prio.videos_per_day}/dag · {pct(prio.capacity_share)} capaciteit</span>
              </p>
            </div>
          )}

          <div className="space-y-1">
            {allocs.slice(0, 10).map((a) => (
              <div key={a.channel_id} className="flex items-center gap-2 bg-white/[0.03] border border-white/5 rounded-md px-2.5 py-1.5">
                <span className="text-[10px] text-white/35 w-5 shrink-0">#{a.priority_rank ?? '–'}</span>
                <p className="text-[11px] text-white/85 truncate flex-1">{a.channel_name || 'Onbekend'}</p>
                <div className="w-20 h-1.5 bg-white/[0.06] rounded-full overflow-hidden shrink-0">
                  <div className="h-full bg-sky-400/70" style={{ width: pct(a.capacity_share) }} />
                </div>
                <span className="text-[10px] text-white/55 w-12 text-right shrink-0">{a.videos_per_day ?? 0}/dag</span>
              </div>
            ))}
          </div>

          {((data?.niches?.expand?.length ?? 0) > 0 || (data?.niches?.terminate?.length ?? 0) > 0) && (
            <div className="pt-2 border-t border-white/5 grid grid-cols-2 gap-3">
              <div>
                <div className="flex items-center gap-1 mb-1"><Sprout size={11} className="text-emerald-300" /><p className="text-[10px] text-white/55">Uitbreiden</p></div>
                {(data?.niches?.expand ?? []).slice(0, 4).map((nx) => (
                  <p key={nx.niche} className="text-[10px] text-emerald-200/80 truncate">{nx.niche} · {pct(nx.win_rate)}</p>
                ))}
                {(data?.niches?.expand?.length ?? 0) === 0 && <p className="text-[10px] text-white/30 italic">geen</p>}
              </div>
              <div>
                <div className="flex items-center gap-1 mb-1"><Ban size={11} className="text-red-300" /><p className="text-[10px] text-white/55">Beëindigen</p></div>
                {(data?.niches?.terminate ?? []).slice(0, 4).map((nx) => (
                  <p key={nx.niche} className="text-[10px] text-red-200/80 truncate">{nx.niche} · {pct(nx.win_rate)}</p>
                ))}
                {(data?.niches?.terminate?.length ?? 0) === 0 && <p className="text-[10px] text-white/30 italic">geen</p>}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
