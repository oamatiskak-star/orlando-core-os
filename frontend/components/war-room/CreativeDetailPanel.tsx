'use client'

import { useEffect, useState } from 'react'
import { X, Play, Sparkles } from 'lucide-react'

type Detail = {
  id: string
  title: string
  kind: string | null
  status: string | null
  output_url: string | null
  channel: { name: string; niche: string | null } | null
  platforms: { platform: string | null; status: string | null }[]
  language: string | null
  duration_seconds: number | null
  failure_reason: string | null
  hook: string | null
  description: string | null
  thumbnail_concept: string | null
  hook_pattern: string | null
  retention_strategy: string | null
  generated_by: string | null
  source_score: unknown
  cta: string | null
  audience: string | null
  funnel_phase: string | null
  performance: {
    views: number | null; ctr_pct: number | null; retention_pct: number | null
    watchtime_min: number | null; engagement_pct: number | null
    revenue: number | null; cost: number | null; roas: number | null; commission: number
    metric_at: string | null
  }
}

const compact = (n: number) => Intl.NumberFormat('nl-NL', { notation: 'compact' }).format(n)
const eur = (n: number) => Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <div className="text-[9px] uppercase tracking-wide text-white/35">{label}</div>
      <div className="text-[11px] text-white/70">{value && value !== '' ? value : <span className="italic text-white/30">Geen data beschikbaar</span>}</div>
    </div>
  )
}

function Perf({ label, value, accent }: { label: string; value: string | null; accent?: string }) {
  return (
    <div className="rounded bg-white/[0.03] px-2 py-1.5 text-center">
      <div className="text-[8px] uppercase tracking-wide text-white/35">{label}</div>
      <div className="text-sm font-semibold tabular-nums" style={{ color: value === null ? 'rgba(255,255,255,0.25)' : accent ?? '#fff' }}>{value ?? '—'}</div>
    </div>
  )
}

export default function CreativeDetailPanel({ creativeId, onClose }: { creativeId: string; onClose: () => void }) {
  const [d, setD] = useState<Detail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    fetch(`/api/media-holding/war-room/creative/${creativeId}`, { cache: 'no-store' })
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? 'Laden mislukt')
        return r.json()
      })
      .then((j) => { if (alive) setD(j as Detail) })
      .catch((e) => { if (alive) setError(String(e.message ?? e)) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [creativeId])

  const p = d?.performance

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50" onClick={onClose}>
      <div className="h-full w-full max-w-md overflow-y-auto border-l border-white/10 bg-[#0b1120] p-4" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">Creative</h2>
          <button onClick={onClose} className="rounded p-1 text-white/50 hover:text-white"><X size={16} /></button>
        </div>

        {loading && <div className="h-40 animate-pulse rounded-lg bg-white/[0.04]" />}
        {error && <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3 text-xs text-red-300">{error}</div>}

        {d && p && (
          <div className="space-y-4">
            {/* preview */}
            <div className="relative flex h-40 items-center justify-center overflow-hidden rounded-lg border border-white/5 bg-gradient-to-br from-cyan-500/15 to-violet-500/10 p-3 text-center text-[10px] text-white/55">
              {d.output_url ? (
                <a href={d.output_url} target="_blank" rel="noreferrer" className="flex flex-col items-center gap-1 text-white/80 hover:text-white">
                  <Play size={28} /> <span className="text-[11px]">Video preview openen</span>
                </a>
              ) : d.thumbnail_concept ? (
                <span className="line-clamp-6">{d.thumbnail_concept}</span>
              ) : (
                <span className="italic text-white/30">Geen preview beschikbaar</span>
              )}
            </div>

            <div>
              <div className="text-sm font-semibold text-white">{d.title}</div>
              <div className="mt-1 flex flex-wrap gap-1.5 text-[10px] text-white/45">
                {d.kind && <span className="rounded bg-white/5 px-1.5 py-0.5">{d.kind}</span>}
                {d.channel && <span className="rounded bg-white/5 px-1.5 py-0.5">{d.channel.name}</span>}
                {d.channel?.niche && <span className="rounded bg-white/5 px-1.5 py-0.5 capitalize">{d.channel.niche}</span>}
                {d.platforms.map((pl, i) => <span key={i} className="rounded bg-white/5 px-1.5 py-0.5">{pl.platform}</span>)}
                {d.status && <span className="rounded bg-white/5 px-1.5 py-0.5 uppercase">{d.status}</span>}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Field label="Hook" value={d.hook} />
              <Field label="CTA" value={d.cta} />
              <Field label="Doelgroep" value={d.audience} />
              <Field label="Funnel fase" value={d.funnel_phase} />
            </div>
            <Field label="Beschrijving" value={d.description} />

            {/* Performance */}
            <div>
              <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-white/45">Performance</div>
              <div className="grid grid-cols-4 gap-1.5">
                <Perf label="views" value={p.views != null ? compact(p.views) : null} />
                <Perf label="ctr" value={p.ctr_pct != null ? `${p.ctr_pct}%` : null} accent="#34d399" />
                <Perf label="watch" value={p.watchtime_min != null ? `${p.watchtime_min}m` : null} accent="#38bdf8" />
                <Perf label="ret" value={p.retention_pct != null ? `${p.retention_pct}%` : null} accent="#38bdf8" />
                <Perf label="rev" value={p.revenue != null ? eur(p.revenue) : null} accent="#22c55e" />
                <Perf label="cost" value={p.cost != null ? eur(p.cost) : null} accent="#f59e0b" />
                <Perf label="roas" value={p.roas != null ? `${p.roas}×` : null} accent="#a855f7" />
                <Perf label="eng" value={p.engagement_pct != null ? `${p.engagement_pct}%` : null} />
              </div>
            </div>

            {/* Hermes analyse */}
            <div>
              <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-violet-300">
                <Sparkles size={12} /> Hermes analyse
              </div>
              <div className="space-y-2 rounded-lg border border-violet-400/20 bg-violet-500/[0.06] p-3">
                <Field label="Waarom gemaakt" value={d.retention_strategy ?? d.generated_by} />
                <Field label="Waarom gekozen (hook-patroon)" value={d.hook_pattern} />
                <Field label="Welke doelgroep" value={d.audience} />
                <Field label="Welke funnel fase" value={d.funnel_phase} />
                <Field label="Concurrentie" value={null} />
                <Field label="Verwachte prestaties" value={d.source_score != null ? `bron-score ${d.source_score}` : null} />
                <Field label="Risico's" value={d.failure_reason} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
