'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { ChevronLeft, ShieldCheck, ShieldAlert, RefreshCw } from 'lucide-react'
import clsx from 'clsx'

/**
 * CONTENT QUALITY CENTER (Content Factory 2.0 — FASE D).
 * READ-ONLY. Geen approve-functie, geen schrijfacties. Toont per video de QC-
 * scores + gate-status + block-reason + upload-eligibility + status.
 */

type Row = {
  project_id: string
  niche: string | null
  title: string | null
  status: string
  approved: boolean | null
  quality_passed: boolean | null
  hook_score: number | null
  thumbnail_score: number | null
  retention_prediction: number | null
  voice_score: number | null
  visual_score: number | null
  music_score: number | null
  cta_score: number | null
  content_quality_index: number | null
  gate_passed: boolean | null
  gate_reason: string | null
  upload_eligible: boolean
  rework_reason: string | null
  thumbnail_variant_count: number
  selected_thumbnail: string | null
  music_selected: boolean
  music_provider: string | null
  learning_status: string
  updated_at: string | null
}

const DIMS: { key: keyof Row; label: string }[] = [
  { key: 'hook_score', label: 'Hook' },
  { key: 'thumbnail_score', label: 'Thumb' },
  { key: 'retention_prediction', label: 'Retentie' },
  { key: 'voice_score', label: 'Voice' },
  { key: 'visual_score', label: 'Visual' },
  { key: 'music_score', label: 'Music' },
  { key: 'cta_score', label: 'CTA' },
  { key: 'content_quality_index', label: 'CQI' },
]

function scoreClass(n: number | null): string {
  if (n == null) return 'text-stone-400 bg-stone-100'
  if (n >= 90) return 'text-emerald-700 bg-emerald-50'
  if (n >= 80) return 'text-amber-700 bg-amber-50'
  return 'text-red-700 bg-red-50'
}

export default function ContentQualityCenter() {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const res = await fetch('/api/youtube/quality/center', { cache: 'no-store' })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error ?? 'laden faalde')
      setRows(json.rows ?? [])
    } catch (e: any) { setError(e?.message ?? 'fout') } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link href="/dashboard/media-holding" className="text-xs text-stone-400 hover:text-stone-600 inline-flex items-center gap-1 mb-2">
            <ChevronLeft size={12} /> Media Holding
          </Link>
          <h1 className="text-2xl font-bold text-stone-900">Content Quality Center</h1>
          <p className="text-sm text-stone-500">Read-only. QC-scores + gate per video. Geen approve hier.</p>
        </div>
        <button onClick={load} disabled={loading}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-stone-200 text-xs text-stone-500 hover:text-stone-800">
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Vernieuwen
        </button>
      </div>

      {error && <div className="p-4 rounded-xl bg-red-50 border border-red-100 text-sm text-red-600 mb-4">{error}</div>}

      <div className="overflow-x-auto border border-stone-200 rounded-xl">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-stone-50 text-stone-500 text-xs uppercase tracking-wider">
              <th className="text-left p-3">Video</th>
              {DIMS.map((d) => <th key={d.key} className="p-2 text-center">{d.label}</th>)}
              <th className="p-2 text-center">Thumb-set</th>
              <th className="p-2 text-center">Muziek</th>
              <th className="p-2 text-center">Learning</th>
              <th className="p-2 text-center">Gate</th>
              <th className="p-2 text-center">Upload</th>
              <th className="p-3 text-left">Status / reden</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.project_id} className="border-t border-stone-100">
                <td className="p-3 max-w-[220px]">
                  <div className="font-medium text-stone-800 truncate">{r.title ?? '(geen titel)'}</div>
                  <div className="text-xs text-stone-400">{r.niche ?? '—'}</div>
                </td>
                {DIMS.map((d) => {
                  const v = r[d.key] as number | null
                  return <td key={d.key} className="p-2 text-center">
                    <span className={clsx('inline-block min-w-[2.2rem] px-1.5 py-0.5 rounded font-semibold text-xs', scoreClass(v))}>{v ?? '—'}</span>
                  </td>
                })}
                <td className="p-2 text-center text-xs">
                  <span className="text-stone-600">{r.thumbnail_variant_count}×</span>
                  {r.selected_thumbnail ? <span className="ml-1 text-emerald-700 font-semibold">{r.selected_thumbnail}</span> : <span className="ml-1 text-stone-400">—</span>}
                </td>
                <td className="p-2 text-center text-xs">
                  {r.music_selected ? <span className="text-emerald-700 font-semibold">{r.music_provider ?? 'ja'}</span> : <span className="text-stone-400">—</span>}
                </td>
                <td className="p-2 text-center text-[11px]">
                  <span className={clsx('px-1.5 py-0.5 rounded',
                    r.learning_status === 'completed' ? 'text-emerald-700 bg-emerald-50'
                    : r.learning_status?.startsWith('blocked') ? 'text-red-700 bg-red-50'
                    : 'text-stone-500 bg-stone-100')}>{r.learning_status ?? 'pending'}</span>
                </td>
                <td className="p-2 text-center">
                  {r.gate_passed
                    ? <ShieldCheck size={16} className="text-emerald-600 inline" />
                    : <ShieldAlert size={16} className="text-red-500 inline" />}
                </td>
                <td className="p-2 text-center text-xs font-semibold">
                  {r.upload_eligible ? <span className="text-emerald-700">ja</span> : <span className="text-stone-400">nee</span>}
                </td>
                <td className="p-3">
                  <div className="text-xs text-stone-600">{r.status}</div>
                  {r.gate_reason && <div className="text-[11px] text-red-500 truncate max-w-[280px]" title={r.gate_reason}>{r.gate_reason}</div>}
                  {r.rework_reason && r.rework_reason !== r.gate_reason && <div className="text-[11px] text-amber-600 truncate max-w-[280px]" title={r.rework_reason}>rework: {r.rework_reason}</div>}
                </td>
              </tr>
            ))}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={DIMS.length + 7} className="p-8 text-center text-stone-400 text-sm">Nog geen gescoorde video-projecten.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
