'use client'

import { useEffect, useState } from 'react'
import { Play, Clapperboard, Sparkles, FileText, Music, TrendingUp } from 'lucide-react'
import { Sparkline } from '@/components/executive/Sparkline'
import { WINNER_LABEL, WINNER_COLOR, type WinnerStatus } from '@/lib/war-room/scoring'

export type VideoRow = {
  id: string          // content uuid
  name: string
  kind: string | null
  channel: string | null
  thumb: string | null
  winner: WinnerStatus | null
  views: number | null
  ctr: number | null
  retention: number | null
  revenue: number | null
}

type Detail = {
  title: string; output_url: string | null; hook: string | null
  script: string | null; voice_music: string | null; thumbnail_concept: string | null
  retention_analysis: unknown; failure_reason: string | null; retention_strategy: string | null
  performance: { watchtime_min: number | null; revenue: number | null; retention_pct: number | null }
}

const compact = (n: number) => Intl.NumberFormat('nl-NL', { notation: 'compact' }).format(n)
const eur = (n: number) => Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)

// probeer een numerieke retentie-reeks uit retention_analysis te halen (anders null → "Geen data")
function retentionSeries(ra: unknown): number[] | null {
  if (Array.isArray(ra) && ra.every((x) => typeof x === 'number')) return ra as number[]
  if (ra && typeof ra === 'object') {
    for (const v of Object.values(ra as Record<string, unknown>)) {
      if (Array.isArray(v) && v.every((x) => typeof x === 'number')) return v as number[]
    }
  }
  return null
}

function Block({ icon: Icon, label, value }: { icon: typeof FileText; label: string; value: string | null }) {
  return (
    <div>
      <div className="flex items-center gap-1 text-[9px] uppercase tracking-wide text-white/35"><Icon size={10} /> {label}</div>
      <div className="mt-0.5 whitespace-pre-wrap text-[11px] leading-snug text-white/70">{value ? value : <span className="italic text-white/30">Geen data beschikbaar</span>}</div>
    </div>
  )
}

export default function VideoStudio({ rows }: { rows: VideoRow[] }) {
  const [sel, setSel] = useState<string | null>(rows[0]?.id ?? null)
  const [detail, setDetail] = useState<Detail | null>(null)
  const [loadedId, setLoadedId] = useState<string | null>(null)

  useEffect(() => {
    if (!sel) return
    let alive = true
    fetch(`/api/media-holding/war-room/creative/${sel}`, { cache: 'no-store' })
      .then((r) => r.ok ? r.json() : null)
      .then((j) => { if (alive) { setDetail(j as Detail); setLoadedId(sel) } })
    return () => { alive = false }
  }, [sel])

  const loading = sel !== null && sel !== loadedId
  const series = detail ? retentionSeries(detail.retention_analysis) : null

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_360px]">
      {/* grid */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {rows.length === 0 && <div className="col-span-full rounded-lg border border-white/10 bg-[#0e1525] p-6 text-sm text-white/50">Nog geen video&apos;s.</div>}
        {rows.map((v) => {
          const wc = v.winner ? WINNER_COLOR[v.winner] : '#475569'
          return (
            <button key={v.id} onClick={() => setSel(v.id)}
              className={`overflow-hidden rounded-lg border bg-[#0e1525] text-left transition-colors ${sel === v.id ? 'border-violet-400/50' : 'border-white/8 hover:border-white/20'}`}>
              <div className="relative flex h-24 items-center justify-center bg-gradient-to-br from-cyan-500/15 to-violet-500/10 p-2 text-center text-[9px] leading-tight text-white/55">
                {v.thumb ? <span className="line-clamp-3">{v.thumb}</span> : <Clapperboard size={20} className="text-white/30" />}
                <span className="absolute right-1.5 top-1.5 rounded-full bg-black/40 p-1"><Play size={11} className="text-white/80" /></span>
              </div>
              <div className="p-2">
                <div className="flex items-start justify-between gap-1">
                  <div className="text-[11px] font-medium leading-tight text-white line-clamp-2">{v.name}</div>
                  {v.winner && <span className="shrink-0 rounded px-1 py-0.5 text-[8px] font-bold uppercase" style={{ color: wc, background: `${wc}1a` }}>{WINNER_LABEL[v.winner]}</span>}
                </div>
                <div className="mt-1 flex gap-2 text-[9px] text-white/40">
                  <span>{v.views != null ? `${compact(v.views)} views` : '— views'}</span>
                  <span className="text-emerald-400/70">{v.ctr != null ? `CTR ${v.ctr}%` : ''}</span>
                  <span className="ml-auto text-emerald-400/80">{v.revenue != null ? eur(v.revenue) : ''}</span>
                </div>
              </div>
            </button>
          )
        })}
      </div>

      {/* video-detail */}
      <aside className="rounded-lg border border-white/8 bg-[#0b1120] p-3">
        {!sel ? (
          <div className="py-10 text-center text-xs text-white/40">Kies een video.</div>
        ) : loading || !detail ? (
          <div className="h-64 animate-pulse rounded bg-white/[0.04]" />
        ) : (
          <div className="space-y-3">
            <div className="flex h-36 items-center justify-center overflow-hidden rounded-lg border border-white/5 bg-gradient-to-br from-cyan-500/15 to-violet-500/10 p-2 text-center text-[10px] text-white/55">
              {detail.output_url
                ? <a href={detail.output_url} target="_blank" rel="noreferrer" className="flex flex-col items-center gap-1 text-white/80 hover:text-white"><Play size={26} /> Preview player</a>
                : detail.thumbnail_concept ? <span className="line-clamp-5">{detail.thumbnail_concept}</span> : <span className="italic text-white/30">Geen preview</span>}
            </div>
            <div className="text-sm font-semibold text-white">{detail.title}</div>

            <div>
              <div className="flex items-center gap-1 text-[9px] uppercase tracking-wide text-white/35"><TrendingUp size={10} /> Retention curve</div>
              {series ? <Sparkline values={series} width={320} height={40} stroke="#38bdf8" className="mt-1 w-full" /> : <div className="mt-0.5 text-[11px] italic text-white/30">Geen data beschikbaar</div>}
              <div className="mt-1 flex gap-3 text-[10px] text-white/45">
                <span>watchtime: {detail.performance.watchtime_min != null ? `${detail.performance.watchtime_min}m` : <span className="text-white/30">Geen data</span>}</span>
                <span>revenue: {detail.performance.revenue != null ? eur(detail.performance.revenue) : <span className="text-white/30">Geen data</span>}</span>
              </div>
            </div>

            <Block icon={FileText} label="Hook" value={detail.hook} />
            <Block icon={FileText} label="Script" value={detail.script} />
            <Block icon={Music} label="Voice / Muziek" value={detail.voice_music} />
            <Block icon={Clapperboard} label="Scene structuur" value={null} />

            <div className="rounded-lg border border-violet-400/20 bg-violet-500/[0.06] p-2.5">
              <div className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-violet-300"><Sparkles size={12} /> Hermes</div>
              <Block icon={FileText} label="Waarom werkt dit" value={detail.retention_strategy} />
              <div className="mt-1.5" />
              <Block icon={FileText} label="Waarom werkt dit niet" value={detail.failure_reason} />
              <div className="mt-1.5" />
              <Block icon={FileText} label="Nieuwe varianten" value={null} />
            </div>
          </div>
        )}
      </aside>
    </div>
  )
}
