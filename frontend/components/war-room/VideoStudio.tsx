'use client'

import { useEffect, useState } from 'react'
import { Sparkles, FileText, Music, TrendingUp, Clapperboard } from 'lucide-react'
import { Sparkline } from '@/components/executive/Sparkline'
import { WINNER_LABEL, WINNER_COLOR, type WinnerStatus } from '@/lib/war-room/scoring'
import type { Preview } from '@/lib/war-room/preview'
import CreativePreview from './CreativePreview'

export type VideoRow = {
  id: string
  name: string
  kind: string | null
  channel: string | null
  preview: Preview
  winner: WinnerStatus | null
  views: number | null
  ctr: number | null
  retention: number | null
  revenue: number | null
}

type Detail = {
  title: string; preview: Preview; hook: string | null
  script: string | null; voice_music: string | null; thumbnail_concept: string | null
  retention_analysis: unknown; failure_reason: string | null; retention_strategy: string | null
  performance: { watchtime_min: number | null; revenue: number | null; retention_pct: number | null }
}

const compact = (n: number) => Intl.NumberFormat('nl-NL', { notation: 'compact' }).format(n)
const eur = (n: number) => Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)

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
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
        {rows.length === 0 && <div className="col-span-full rounded-lg border border-white/10 bg-[#0e1525] p-6 text-sm text-white/50">Nog geen video&apos;s.</div>}
        {rows.map((v) => {
          const wc = v.winner ? WINNER_COLOR[v.winner] : '#475569'
          return (
            <button key={v.id} onClick={() => setSel(v.id)}
              className={`group overflow-hidden rounded-lg border bg-[#0e1525] text-left transition-all hover:-translate-y-0.5 ${sel === v.id ? 'border-violet-400/50' : 'border-white/8 hover:border-white/25'}`}>
              <div className="relative">
                <CreativePreview preview={v.preview} ratio="video" />
                {v.winner && <span className="absolute left-1.5 top-1.5 rounded px-1 py-0.5 text-[8px] font-bold uppercase backdrop-blur-sm" style={{ color: wc, background: `${wc}26` }}>{WINNER_LABEL[v.winner]}</span>}
              </div>
              <div className="p-2">
                <div className="text-[11px] font-medium leading-tight text-white line-clamp-2">{v.name}</div>
                <div className="mt-1 flex gap-2 text-[9px] text-white/40">
                  <span>{v.views != null ? `${compact(v.views)} views` : '— views'}</span>
                  {v.ctr != null && <span className="text-emerald-400/70">CTR {v.ctr}%</span>}
                  {v.revenue != null && <span className="ml-auto text-emerald-400/80">{eur(v.revenue)}</span>}
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
            <CreativePreview preview={detail.preview} mode="full" ratio="video" rounded="rounded-lg" />
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
