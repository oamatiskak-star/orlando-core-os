'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { ShieldCheck, ChevronLeft, Lock, CheckCircle2 } from 'lucide-react'
import clsx from 'clsx'

// Read-only Content Quality Center. Approval gebeurt out-of-band via de
// approve_video_project RPC (Phase 1 = geen schrijfacties in dit dashboard).
type GateRow = {
  project_id: string
  youtube_upload_queue_id: string | null
  status: string
  content_category: 'viral_growth' | 'authority' | 'revenue'
  approved: boolean
  title: string | null
  hook_score: number | null
  thumbnail_score: number | null
  voice_score: number | null
  visual_score: number | null
  music_score: number | null
  cta_score: number | null
  retention_prediction: number | null
  cqi: number | null
  revenue_score: number | null
  leads_score: number | null
  authority_score: number | null
  viral_score: number | null
  content_impact_score: number | null
  upload_eligible: boolean
  block_reason: string | null
}

// Kleurcodering uit spec: groen >=90, oranje 80-89, rood <80.
function scoreClass(v: number | null): string {
  if (v == null) return 'bg-white/[0.08] text-white/40'
  if (v >= 90) return 'bg-emerald-500/15 text-emerald-300'
  if (v >= 80) return 'bg-orange-500/15 text-orange-300'
  return 'bg-red-500/15 text-red-300'
}

const QUALITY: { key: keyof GateRow; label: string }[] = [
  { key: 'hook_score', label: 'Hook' },
  { key: 'thumbnail_score', label: 'Thumbnail' },
  { key: 'voice_score', label: 'Voice' },
  { key: 'visual_score', label: 'Visual' },
  { key: 'music_score', label: 'Music' },
  { key: 'cta_score', label: 'CTA' },
  { key: 'retention_prediction', label: 'Retentie' },
  { key: 'cqi', label: 'CQI' },
]
const IMPACT: { key: keyof GateRow; label: string }[] = [
  { key: 'revenue_score', label: 'Revenue' },
  { key: 'leads_score', label: 'Leads' },
  { key: 'authority_score', label: 'Authority' },
  { key: 'viral_score', label: 'Viral' },
]
const CATEGORY_LABEL: Record<string, string> = {
  viral_growth: 'Viral Growth',
  authority: 'Authority',
  revenue: 'Revenue',
}

export default function ContentQualityCenterPage() {
  const [rows, setRows] = useState<GateRow[]>([])
  const [loading, setLoading] = useState(true)
  const [category, setCategory] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const qs = category ? `?category=${category}` : ''
      const r = await fetch(`/api/media-holding/content-quality-center${qs}`)
      if (r.ok) {
        const j = await r.json()
        setRows(j.projects ?? [])
      }
    } finally { setLoading(false) }
  }, [category])

  useEffect(() => { load() }, [load])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/media-holding" className="text-white/40 hover:text-white">
            <ChevronLeft size={16} />
          </Link>
          <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
            <ShieldCheck size={16} className="text-emerald-400" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-white">Content Quality Center</h1>
            <p className="text-xs text-white/50">Content Impact Score = 40% revenue · 30% leads · 20% authority · 10% viral. Upload-gate vereist alle drempels + goedkeuring.</p>
          </div>
        </div>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="bg-white/[0.06] border border-white/10 rounded-lg px-3 py-2 text-xs text-white"
        >
          <option value="">Alle categorieën</option>
          <option value="viral_growth">Viral Growth</option>
          <option value="authority">Authority</option>
          <option value="revenue">Revenue</option>
        </select>
      </div>

      {loading ? (
        <div className="p-10 text-center text-xs text-white/40">Laden…</div>
      ) : rows.length === 0 ? (
        <div className="p-10 text-center bg-white/[0.04] border border-white/5 rounded-xl">
          <ShieldCheck size={32} className="mx-auto text-white/30 mb-3" />
          <p className="text-sm text-white/65">Nog geen video-projecten.</p>
          <p className="text-[11px] text-white/40 mt-1">Projecten verschijnen hier zodra de Content Factory video_projects aanmaakt.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((p) => (
            <div key={p.project_id} className="bg-white/[0.06] border border-white/5 rounded-xl p-4">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={clsx(
                      'inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold',
                      p.upload_eligible ? 'bg-emerald-500/15 text-emerald-300' : 'bg-red-500/15 text-red-300',
                    )}>
                      {p.upload_eligible ? <CheckCircle2 size={11} /> : <Lock size={11} />}
                      {p.upload_eligible ? 'Upload-eligible' : (p.block_reason ?? 'geblokkeerd')}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-white/[0.06] text-white/60 text-[10px]">{CATEGORY_LABEL[p.content_category] ?? p.content_category}</span>
                    <span className="px-2 py-0.5 rounded bg-white/[0.06] text-white/60 text-[10px]">{p.status}</span>
                  </div>
                  <p className="text-sm text-white/90 mt-2 truncate">{p.title ?? '(zonder titel)'}</p>
                </div>
                <div className="text-right shrink-0">
                  <div className={clsx('px-3 py-1 rounded-lg text-sm font-bold', scoreClass(p.content_impact_score))}>
                    {p.content_impact_score != null ? Number(p.content_impact_score).toFixed(1) : '—'}
                  </div>
                  <p className="text-[10px] text-white/40 mt-1">Content Impact Score</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-white/40 mb-1.5">Kwaliteit</p>
                  <div className="flex flex-wrap gap-1.5">
                    {QUALITY.map((q) => (
                      <span key={q.key} className={clsx('px-2 py-0.5 rounded text-[10px] font-semibold', scoreClass(p[q.key] as number | null))}>
                        {q.label} {p[q.key] ?? '—'}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-white/40 mb-1.5">Impact</p>
                  <div className="flex flex-wrap gap-1.5">
                    {IMPACT.map((q) => (
                      <span key={q.key} className={clsx('px-2 py-0.5 rounded text-[10px] font-semibold', scoreClass(p[q.key] as number | null))}>
                        {q.label} {p[q.key] ?? '—'}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
