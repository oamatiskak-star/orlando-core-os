'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Wallet, ChevronLeft, RefreshCw, Plus, Trash2, Link as LinkIcon, X } from 'lucide-react'
import clsx from 'clsx'

type Stream = {
  id: string
  channel_id: string
  platform: string | null
  stream_type: 'adsense'|'sponsor'|'affiliate'|'product'|'membership'|'tips'
  monthly_revenue: number
  active: boolean
  channel: { id: string; name: string; niche: string } | null
}

type Metric = {
  id: string
  channel_id: string
  platform: string
  period_start: string
  period_end: string
  views: number
  estimated_revenue: number
  ad_revenue: number
  cpm: number | null
  playback_cpm: number | null
  rpm: number | null
  captured_at: string
  channel: { id: string; name: string } | null
}

type Channel = { id: string; name: string; niche: string; status: string }

type AffiliateLink = {
  id: string
  affiliate_id: string
  network: string | null
  product: string
  url: string
  commission_pct: number | null
  channel_id: string | null
  short_code: string | null
  active: boolean
  clicks: number
  conversions: number
  channel: { id: string; name: string } | null
}

const STREAM_COLORS: Record<string, string> = {
  adsense:    'bg-emerald-500/10 text-emerald-300',
  sponsor:    'bg-indigo-500/10 text-indigo-300',
  affiliate:  'bg-amber-500/10 text-amber-300',
  product:    'bg-fuchsia-500/10 text-fuchsia-300',
  membership: 'bg-orange-500/10 text-orange-300',
  tips:       'bg-cyan-500/10 text-cyan-300',
}

export default function MonetizationView() {
  const [streams, setStreams] = useState<Stream[]>([])
  const [metrics, setMetrics] = useState<Metric[]>([])
  const [channels, setChannels] = useState<Channel[]>([])
  const [links, setLinks] = useState<AffiliateLink[]>([])
  const [totals, setTotals] = useState<{ monthly_revenue_active: number; by_stream_type: Record<string, number> }>({ monthly_revenue_active: 0, by_stream_type: {} })
  const [loading, setLoading] = useState(true)
  const [tracking, setTracking] = useState(false)
  const [trackMsg, setTrackMsg] = useState('')
  const [showNewLink, setShowNewLink] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [sRes, lRes] = await Promise.all([
        fetch('/api/media-holding/monetization/streams'),
        fetch('/api/media-holding/affiliate-links'),
      ])
      if (sRes.ok) {
        const j = await sRes.json()
        setStreams(j.streams ?? [])
        setMetrics(j.metrics ?? [])
        setChannels(j.channels ?? [])
        setTotals(j.totals ?? { monthly_revenue_active: 0, by_stream_type: {} })
      }
      if (lRes.ok) {
        const j = await lRes.json()
        setLinks(j.links ?? [])
      }
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  async function trackChannel(channelId: string) {
    setTracking(true); setTrackMsg('')
    try {
      const r = await fetch(`/api/media-holding/monetization/track/${channelId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ period_days: 30 }),
      })
      if (r.ok) {
        const j = await r.json()
        setTrackMsg(`Track dispatched — task ${j.task_id?.slice(0, 8)}…`)
        setTimeout(load, 30_000)
      } else {
        const j = await r.json().catch(() => ({}))
        setTrackMsg(`Fout: ${j.error ?? r.status}`)
      }
    } finally { setTracking(false) }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/media-holding" className="text-white/40 hover:text-white">
            <ChevronLeft size={16} />
          </Link>
          <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
            <Wallet size={16} className="text-indigo-400" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-white">Monetization Engine</h1>
            <p className="text-xs text-white/50">Persona: <span className="text-amber-300">Victoria</span> — revenue tracking + affiliate links.</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Kpi label="Monthly active revenue" value={`€ ${totals.monthly_revenue_active.toFixed(2)}`} color="text-emerald-300" />
        <Kpi label="AdSense" value={`€ ${(totals.by_stream_type.adsense ?? 0).toFixed(2)}`} color="text-emerald-200" />
        <Kpi label="Sponsors" value={`€ ${(totals.by_stream_type.sponsor ?? 0).toFixed(2)}`} color="text-indigo-300" />
        <Kpi label="Affiliate / Product" value={`€ ${((totals.by_stream_type.affiliate ?? 0) + (totals.by_stream_type.product ?? 0)).toFixed(2)}`} color="text-amber-300" />
      </div>

      {trackMsg && <div className="bg-white/[0.04] border border-white/10 rounded-lg px-4 py-2.5 text-[11px] text-white/70">{trackMsg}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel title="Per channel" actions={null}>
          {loading ? (
            <p className="text-xs text-white/40">Laden…</p>
          ) : channels.length === 0 ? (
            <p className="text-[11px] text-white/40 italic">Geen kanalen.</p>
          ) : (
            <div className="space-y-2">
              {channels.map((ch) => {
                const chStreams = streams.filter((s) => s.channel_id === ch.id && s.active)
                const total = chStreams.reduce((a, s) => a + Number(s.monthly_revenue ?? 0), 0)
                const latestMetric = metrics.find((m) => m.channel_id === ch.id)
                return (
                  <div key={ch.id} className="bg-white/[0.04] border border-white/5 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-white/90 font-medium">{ch.name}</p>
                        <p className="text-[10px] text-white/45">{ch.niche}</p>
                      </div>
                      <button
                        onClick={() => trackChannel(ch.id)}
                        disabled={tracking}
                        className="flex items-center gap-1 bg-indigo-500/20 border border-indigo-500/30 hover:bg-indigo-500/30 disabled:opacity-50 text-indigo-300 text-[11px] px-2.5 py-1 rounded-lg"
                      >
                        <RefreshCw size={11} className={tracking ? 'animate-spin' : ''} /> Track
                      </button>
                    </div>
                    {chStreams.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {chStreams.map((s) => (
                          <span key={s.id} className={clsx('px-2 py-0.5 rounded text-[10px]', STREAM_COLORS[s.stream_type])}>
                            {s.stream_type}: €{Number(s.monthly_revenue).toFixed(2)}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[10px] text-white/40 italic">Geen actieve streams</p>
                    )}
                    {latestMetric && (
                      <div className="text-[10px] text-white/55 pt-2 border-t border-white/5 grid grid-cols-3 gap-2">
                        <span>{Number(latestMetric.views).toLocaleString('nl-NL')} views</span>
                        <span>RPM €{Number(latestMetric.rpm ?? 0).toFixed(2)}</span>
                        <span>CPM €{Number(latestMetric.cpm ?? 0).toFixed(2)}</span>
                      </div>
                    )}
                    {total > 0 && (
                      <p className="text-xs text-emerald-300 font-semibold mt-1.5">Total: €{total.toFixed(2)}/mnd</p>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </Panel>

        <Panel title={`Affiliate links (${links.length})`} actions={
          <button onClick={() => setShowNewLink(true)} className="flex items-center gap-1 bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] px-2.5 py-1 rounded-lg">
            <Plus size={11} /> Nieuw
          </button>
        }>
          {loading ? (
            <p className="text-xs text-white/40">Laden…</p>
          ) : links.length === 0 ? (
            <p className="text-[11px] text-white/40 italic">Geen affiliate links. Klik &quot;Nieuw&quot; om te starten.</p>
          ) : (
            <div className="space-y-1.5">
              {links.map((l) => (
                <div key={l.id} className="bg-white/[0.04] border border-white/5 rounded-lg p-2 flex items-center gap-2">
                  <LinkIcon size={12} className="text-white/40 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-white/85 truncate">{l.product}</p>
                    <div className="flex items-center gap-2 text-[10px] text-white/45">
                      {l.network && <span>{l.network}</span>}
                      {l.commission_pct != null && <span>{l.commission_pct}% commission</span>}
                      {l.channel?.name && <span>{l.channel.name}</span>}
                      <span>{l.clicks} clicks · {l.conversions} conv</span>
                    </div>
                  </div>
                  <button
                    onClick={async () => {
                      if (!confirm('Verwijder affiliate link?')) return
                      await fetch(`/api/media-holding/affiliate-links/${l.id}`, { method: 'DELETE' })
                      setLinks((prev) => prev.filter((x) => x.id !== l.id))
                    }}
                    className="text-white/30 hover:text-red-400"
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      {metrics.length > 0 && (
        <Panel title="Recente metric snapshots" actions={null}>
          <table className="w-full text-xs">
            <thead className="text-white/40">
              <tr className="border-b border-white/5">
                <th className="text-left py-1.5 font-medium">Kanaal</th>
                <th className="text-left py-1.5 font-medium">Periode</th>
                <th className="text-right py-1.5 font-medium">Views</th>
                <th className="text-right py-1.5 font-medium">Revenue</th>
                <th className="text-right py-1.5 font-medium">RPM</th>
                <th className="text-right py-1.5 font-medium">CPM</th>
              </tr>
            </thead>
            <tbody>
              {metrics.slice(0, 15).map((m) => (
                <tr key={m.id} className="border-b border-white/5">
                  <td className="py-1.5 text-white/75">{m.channel?.name ?? '—'}</td>
                  <td className="py-1.5 text-white/55">{m.period_start} → {m.period_end}</td>
                  <td className="py-1.5 text-right text-white/75">{Number(m.views).toLocaleString('nl-NL')}</td>
                  <td className="py-1.5 text-right text-emerald-300">€{Number(m.estimated_revenue).toFixed(2)}</td>
                  <td className="py-1.5 text-right text-white/65">€{Number(m.rpm ?? 0).toFixed(2)}</td>
                  <td className="py-1.5 text-right text-white/55">€{Number(m.cpm ?? 0).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      )}

      {showNewLink && (
        <NewAffiliateModal channels={channels} onClose={() => setShowNewLink(false)} onCreated={() => { setShowNewLink(false); load() }} />
      )}
    </div>
  )
}

function Kpi({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-white/[0.06] border border-white/5 rounded-xl p-4">
      <p className="text-[11px] text-white/50 mb-1">{label}</p>
      <p className={`text-2xl font-semibold ${color}`}>{value}</p>
    </div>
  )
}

function Panel({ title, actions, children }: { title: string; actions: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-white/[0.06] border border-white/5 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] text-white/40 uppercase tracking-wider">{title}</p>
        {actions}
      </div>
      {children}
    </div>
  )
}

function NewAffiliateModal({ channels, onClose, onCreated }: { channels: Channel[]; onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ affiliate_id: '', network: '', product: '', url: '', commission_pct: '', channel_id: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function save() {
    if (!form.affiliate_id || !form.product || !form.url) { setError('affiliate_id, product en url vereist'); return }
    setSaving(true); setError('')
    try {
      const r = await fetch('/api/media-holding/affiliate-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          commission_pct: form.commission_pct ? Number(form.commission_pct) : null,
          channel_id: form.channel_id || null,
        }),
      })
      if (r.ok) onCreated()
      else {
        const j = await r.json().catch(() => ({}))
        setError(j.error ?? 'Aanmaken faalde')
      }
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-[#0f1117] border border-white/10 rounded-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-white/5">
          <h2 className="text-sm font-semibold text-white">Nieuwe affiliate link</h2>
          <button onClick={onClose}><X size={16} className="text-white/50 hover:text-white" /></button>
        </div>
        <div className="p-5 space-y-3">
          {(['affiliate_id','network','product'] as const).map((f) => (
            <div key={f}>
              <label className="block text-[11px] text-white/50 mb-1">{f === 'affiliate_id' ? 'Affiliate ID *' : f === 'product' ? 'Product *' : 'Netwerk'}</label>
              <input
                className="w-full bg-white/[0.06] border border-white/10 rounded-lg px-3 py-2 text-xs text-white"
                value={form[f]}
                onChange={(e) => setForm((p) => ({ ...p, [f]: e.target.value }))}
              />
            </div>
          ))}
          <div>
            <label className="block text-[11px] text-white/50 mb-1">URL *</label>
            <input
              className="w-full bg-white/[0.06] border border-white/10 rounded-lg px-3 py-2 text-xs text-white font-mono"
              value={form.url}
              onChange={(e) => setForm((p) => ({ ...p, url: e.target.value }))}
              placeholder="https://..."
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] text-white/50 mb-1">Commission %</label>
              <input
                type="number"
                step="0.1"
                className="w-full bg-white/[0.06] border border-white/10 rounded-lg px-3 py-2 text-xs text-white"
                value={form.commission_pct}
                onChange={(e) => setForm((p) => ({ ...p, commission_pct: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-[11px] text-white/50 mb-1">Kanaal</label>
              <select
                value={form.channel_id}
                onChange={(e) => setForm((p) => ({ ...p, channel_id: e.target.value }))}
                className="w-full bg-white/[0.06] border border-white/10 rounded-lg px-3 py-2 text-xs text-white"
              >
                <option value="">— geen —</option>
                {channels.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
          <div className="flex gap-2 pt-2">
            <button onClick={onClose} className="flex-1 border border-white/10 text-white/60 text-xs py-2 rounded-lg">Annuleer</button>
            <button onClick={save} disabled={saving} className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs py-2 rounded-lg">
              {saving ? 'Opslaan…' : 'Aanmaken'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
