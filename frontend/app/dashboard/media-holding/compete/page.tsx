'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Crosshair, ChevronLeft, Plus, X, Eye, Zap, Users, Activity,
  Bell, BellOff, Trash2, ExternalLink,
} from 'lucide-react'
import clsx from 'clsx'

type Freq = {
  uploads_14d: number; uploads_7d: number; uploads_24h: number;
  avg_uploads_per_day: number; latest_upload_at: string | null; best_views_14d: number | null
}

type Competitor = {
  id: string
  platform: string
  external_id: string
  name: string
  handle: string | null
  niche: string | null
  language: string | null
  url: string | null
  thumbnail_url: string | null
  subscriber_count: number
  video_count: number
  total_view_count: number
  watched_by_channel: string | null
  notes: string | null
  active: boolean
  last_scanned_at: string | null
  freq: Freq | null
  open_signals: number
}

type Signal = {
  id: string
  signal_type: 'viral_spike'|'format_shift'|'upload_burst'|'dormant'|'niche_pivot'|'sub_surge'
  magnitude: number
  notes: string | null
  detected_at: string
  acknowledged_at: string | null
  competitor: { id: string; name: string; platform: string; niche: string | null; url: string | null }
  video: { id: string; title: string | null; url: string | null; views: number | null } | null
}

const PLATFORMS = ['youtube','tiktok','instagram','facebook','snapchat'] as const

const SIGNAL_STYLE: Record<Signal['signal_type'], { wrap: string; label: string; icon: React.ReactNode }> = {
  viral_spike:  { wrap: 'border-violet-500/30 bg-violet-500/[0.07]', label: 'Viral spike',  icon: <Zap size={11} /> },
  format_shift: { wrap: 'border-amber-500/30  bg-amber-500/[0.07]',  label: 'Format shift', icon: <Activity size={11} /> },
  upload_burst: { wrap: 'border-sky-500/30    bg-sky-500/[0.07]',    label: 'Upload burst', icon: <Activity size={11} /> },
  dormant:      { wrap: 'border-white/10      bg-white/[0.03]',      label: 'Dormant',      icon: <BellOff size={11} /> },
  niche_pivot:  { wrap: 'border-rose-500/30   bg-rose-500/[0.07]',   label: 'Niche pivot',  icon: <Activity size={11} /> },
  sub_surge:    { wrap: 'border-emerald-500/30 bg-emerald-500/[0.07]', label: 'Sub surge',  icon: <Users size={11} /> },
}

function num(n: number | null | undefined) {
  if (n == null || !Number.isFinite(n)) return '—'
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + 'M'
  if (n >= 1_000)     return (n / 1_000).toFixed(1)   + 'K'
  return String(n)
}
function rel(ts: string | null) {
  if (!ts) return '—'
  const diff = (Date.now() - new Date(ts).getTime()) / 1000
  if (diff < 60)      return `${Math.round(diff)}s`
  if (diff < 3600)    return `${Math.round(diff/60)}m`
  if (diff < 86400)   return `${Math.round(diff/3600)}u`
  return `${Math.round(diff/86400)}d`
}

export default function CompetePage() {
  const [competitors, setCompetitors] = useState<Competitor[]>([])
  const [signals, setSignals]         = useState<Signal[]>([])
  const [showOpenOnly, setShowOpenOnly] = useState(true)
  const [loading, setLoading]         = useState(true)
  const [adding, setAdding]           = useState(false)
  const [error, setError]             = useState('')

  // Form state
  const [form, setForm] = useState({
    platform: 'youtube' as typeof PLATFORMS[number],
    external_id: '',
    name: '',
    handle: '',
    niche: '',
    language: 'nl',
    url: '',
    notes: '',
  })

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const [cRes, sRes] = await Promise.all([
        fetch('/api/media-holding/competitors'),
        fetch(`/api/media-holding/competitors/signals?status=${showOpenOnly ? 'open' : 'all'}`),
      ])
      const cJ = await cRes.json(); const sJ = await sRes.json()
      if (!cRes.ok) throw new Error(cJ.error ?? `${cRes.status}`)
      if (!sRes.ok) throw new Error(sJ.error ?? `${sRes.status}`)
      setCompetitors((cJ.competitors ?? []) as Competitor[])
      setSignals((sJ.signals ?? []) as Signal[])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Onbekende fout')
    } finally {
      setLoading(false)
    }
  }, [showOpenOnly])
  useEffect(() => { load() }, [load])

  async function addCompetitor(e: React.FormEvent) {
    e.preventDefault()
    if (!form.external_id || !form.name) return
    const r = await fetch('/api/media-holding/competitors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    if (r.ok) {
      setAdding(false)
      setForm({ ...form, external_id: '', name: '', handle: '', url: '', notes: '' })
      load()
    } else {
      const j = await r.json().catch(() => ({}))
      setError(j.error ?? `${r.status}`)
    }
  }

  async function ack(id: string, acknowledged: boolean) {
    await fetch('/api/media-holding/competitors/signals', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, acknowledged }),
    })
    load()
  }

  async function remove(id: string) {
    if (!confirm('Competitor uitschakelen? (soft delete)')) return
    await fetch(`/api/media-holding/competitors/${id}`, { method: 'DELETE' })
    load()
  }

  const totalOpen = signals.filter((s) => !s.acknowledged_at).length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/media-holding" className="text-white/40 hover:text-white">
            <ChevronLeft size={16} />
          </Link>
          <div className="w-9 h-9 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
            <Crosshair size={16} className="text-rose-400" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-white">Competitor Surveillance</h1>
            <p className="text-xs text-white/50">Upload frequentie · viral spikes · format tracking</p>
          </div>
        </div>
        <button
          onClick={() => setAdding((v) => !v)}
          className="flex items-center gap-1.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-medium px-3 py-2 rounded-lg"
        >
          <Plus size={13} /> Competitor toevoegen
        </button>
      </div>

      {error && (
        <div className="bg-red-500/5 border border-red-500/20 rounded-lg px-4 py-2.5 text-xs text-red-300">{error}</div>
      )}

      {/* Add form */}
      {adding && (
        <form onSubmit={addCompetitor} className="bg-white/[0.04] border border-white/8 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-white/85">Nieuwe competitor</h3>
            <button type="button" onClick={() => setAdding(false)}><X size={14} className="text-white/50" /></button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <SelectField label="Platform">
              <select
                value={form.platform}
                onChange={(e) => setForm({ ...form, platform: e.target.value as typeof PLATFORMS[number] })}
                className="w-full bg-white/[0.06] border border-white/10 rounded-lg px-3 py-2 text-xs text-white"
              >
                {PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </SelectField>
            <Field label="External ID" required value={form.external_id} onChange={(v) => setForm({ ...form, external_id: v })} placeholder="UC… / @handle / channel_id" />
            <Field label="Naam" required value={form.name} onChange={(v) => setForm({ ...form, name: v })} placeholder="Channel display name" />
            <Field label="Handle" value={form.handle} onChange={(v) => setForm({ ...form, handle: v })} placeholder="@handle" />
            <Field label="Niche" value={form.niche} onChange={(v) => setForm({ ...form, niche: v })} placeholder="finance · vastgoed · crypto" />
            <Field label="Taal" value={form.language} onChange={(v) => setForm({ ...form, language: v.toLowerCase() })} placeholder="nl" />
            <Field label="URL" value={form.url} onChange={(v) => setForm({ ...form, url: v })} placeholder="https://…" />
            <div className="sm:col-span-2">
              <Field label="Notes" value={form.notes} onChange={(v) => setForm({ ...form, notes: v })} placeholder="Waarom volgen we deze?" />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={() => setAdding(false)} className="text-xs text-white/50 hover:text-white/80 px-3 py-1.5">
              Annuleren
            </button>
            <button type="submit" className="bg-rose-600 hover:bg-rose-500 text-white text-xs font-medium px-4 py-2 rounded-lg">
              Toevoegen
            </button>
          </div>
        </form>
      )}

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <KpiCard label="Competitors actief" value={String(competitors.length)} />
        <KpiCard label="Open signals" value={String(totalOpen)} accent={totalOpen > 0 ? 'text-rose-400' : 'text-white/50'} />
        <KpiCard label="Viral spikes (open)" value={String(signals.filter((s) => !s.acknowledged_at && s.signal_type === 'viral_spike').length)} accent="text-violet-300" />
        <KpiCard label="Upload bursts (open)" value={String(signals.filter((s) => !s.acknowledged_at && s.signal_type === 'upload_burst').length)} accent="text-sky-300" />
      </div>

      {/* Signal lane */}
      <div className="bg-white/[0.04] border border-white/5 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell size={13} className="text-rose-400" />
            <h3 className="text-xs font-semibold text-white/85">Signal feed</h3>
          </div>
          <label className="flex items-center gap-2 text-[11px] text-white/55">
            <input type="checkbox" checked={showOpenOnly} onChange={(e) => setShowOpenOnly(e.target.checked)} />
            Alleen open
          </label>
        </div>
        {loading ? (
          <div className="p-10 text-center text-xs text-white/40">Laden…</div>
        ) : signals.length === 0 ? (
          <div className="p-10 text-center text-xs text-white/40">
            Geen {showOpenOnly ? 'open' : ''} signalen. Scanner-worker is nog offline (zie media_holding_workers).
          </div>
        ) : (
          <ul className="divide-y divide-white/5">
            {signals.map((s) => {
              const style = SIGNAL_STYLE[s.signal_type]
              return (
                <li key={s.id} className={clsx('px-4 py-3 flex items-start gap-3 border-l-2', style.wrap)}>
                  <span className="text-white/80 mt-0.5">{style.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-medium text-white/90">{s.competitor.name}</span>
                      <span className="text-[10px] uppercase text-white/40 tracking-wider">{s.competitor.platform}</span>
                      <span className="text-[10px] font-semibold text-white/75">· {style.label} ({s.magnitude.toFixed(1)})</span>
                      <span className="text-[10px] text-white/35 ml-auto">{rel(s.detected_at)}</span>
                    </div>
                    {s.video?.title && (
                      <p className="text-[11px] text-white/65 mt-0.5 line-clamp-1">
                        {s.video.url ? <a href={s.video.url} target="_blank" rel="noreferrer" className="hover:text-violet-300">{s.video.title}</a> : s.video.title}
                        {s.video.views ? <span className="text-white/35 ml-2">{num(s.video.views)} views</span> : null}
                      </p>
                    )}
                    {s.notes && <p className="text-[11px] text-white/55 mt-0.5">{s.notes}</p>}
                  </div>
                  <button
                    onClick={() => ack(s.id, !s.acknowledged_at)}
                    className={clsx(
                      'text-[10px] px-2 py-1 rounded border',
                      s.acknowledged_at
                        ? 'border-white/10 text-white/45 hover:text-white/75'
                        : 'border-rose-500/30 text-rose-300 hover:bg-rose-500/10',
                    )}
                  >
                    {s.acknowledged_at ? 'heropen' : 'ack'}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {/* Competitor grid */}
      <div className="bg-white/[0.04] border border-white/5 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
          <h3 className="text-xs font-semibold text-white/85">Watched competitors</h3>
          <span className="text-[10px] text-white/40">{competitors.length} actief</span>
        </div>
        {competitors.length === 0 ? (
          <div className="p-10 text-center text-xs text-white/40">
            Nog geen competitors. Klik &quot;Competitor toevoegen&quot; om te starten.
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead className="bg-white/[0.02]">
              <tr className="text-[10px] uppercase text-white/40 tracking-wider">
                <th className="text-left px-4 py-2">Naam</th>
                <th className="text-left">Platform</th>
                <th className="text-right px-2">Subs</th>
                <th className="text-right px-2">Uploads 7d</th>
                <th className="text-right px-2">Avg/dag</th>
                <th className="text-right px-2">Best 14d</th>
                <th className="text-right px-2">Open signals</th>
                <th className="text-left px-2">Laatste upload</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {competitors.map((c) => (
                <tr key={c.id} className="border-t border-white/5 hover:bg-white/[0.03]">
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <p className="text-white/90 font-medium">{c.name}</p>
                      {c.url && (
                        <a href={c.url} target="_blank" rel="noreferrer" className="text-white/35 hover:text-violet-300">
                          <ExternalLink size={11} />
                        </a>
                      )}
                    </div>
                    <p className="text-[10px] text-white/40">{c.niche ?? '—'} · {(c.language ?? '').toUpperCase()}</p>
                  </td>
                  <td className="capitalize text-white/75">{c.platform}</td>
                  <td className="px-2 text-right tabular-nums text-white/85">{num(c.subscriber_count)}</td>
                  <td className="px-2 text-right tabular-nums text-white/85">{c.freq?.uploads_7d ?? 0}</td>
                  <td className="px-2 text-right tabular-nums text-white/85">{c.freq?.avg_uploads_per_day?.toFixed(1) ?? '0.0'}</td>
                  <td className="px-2 text-right tabular-nums text-white/85">{num(c.freq?.best_views_14d ?? 0)}</td>
                  <td className="px-2 text-right">
                    <span className={clsx(
                      'tabular-nums px-1.5 py-0.5 rounded',
                      c.open_signals > 0 ? 'bg-rose-500/10 text-rose-300' : 'text-white/40',
                    )}>
                      {c.open_signals}
                    </span>
                  </td>
                  <td className="px-2 text-white/55 text-[11px]">{rel(c.freq?.latest_upload_at ?? null)}</td>
                  <td className="px-2 text-right">
                    <button onClick={() => remove(c.id)} className="text-white/40 hover:text-red-400">
                      <Trash2 size={12} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

function KpiCard({ label, value, accent = 'text-white' }: { label: string; value: string; accent?: string }) {
  return (
    <div className="bg-white/[0.04] border border-white/8 rounded-xl p-3">
      <p className="text-[10px] text-white/40 uppercase tracking-wide mb-1">{label}</p>
      <p className={clsx('text-xl font-semibold tabular-nums', accent)}>{value}</p>
    </div>
  )
}

function Field({
  label, value, onChange, placeholder, required,
}: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; required?: boolean }) {
  return (
    <label className="block">
      <span className="text-[10px] text-white/40 uppercase tracking-wider mb-1 block">
        {label}{required && <span className="text-rose-400 ml-0.5">*</span>}
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className="w-full bg-white/[0.06] border border-white/10 rounded-lg px-3 py-2 text-xs text-white"
      />
    </label>
  )
}
function SelectField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[10px] text-white/40 uppercase tracking-wider mb-1 block">{label}</span>
      {children}
    </label>
  )
}
