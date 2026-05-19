'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Megaphone, ChevronLeft, Sparkles, X, Mail, Copy, Trash2 } from 'lucide-react'
import clsx from 'clsx'

type Target = {
  id: string
  brand_name: string
  website: string | null
  industry: string | null
  category: string | null
  fit_score: number
  est_budget: string | null
  contact_name: string | null
  contact_email: string | null
  outreach_draft: string | null
  notes: string | null
  status: 'prospect'|'researched'|'contacted'|'negotiating'|'won'|'lost'
  channel: { id: string; name: string } | null
  last_outreach_at: string | null
}

type Channel = { id: string; name: string; niche: string }

const STATUSES = ['prospect','researched','contacted','negotiating','won','lost'] as const

const STATUS_COLORS: Record<string, string> = {
  prospect:    'bg-white/[0.08] text-white/55',
  researched:  'bg-amber-500/10 text-amber-300',
  contacted:   'bg-indigo-500/10 text-indigo-300',
  negotiating: 'bg-orange-500/10 text-orange-300',
  won:         'bg-emerald-500/10 text-emerald-300',
  lost:        'bg-red-500/10 text-red-400',
}

export default function SponsorEnginePage() {
  const [targets, setTargets] = useState<Target[]>([])
  const [channels, setChannels] = useState<Channel[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedChannel, setSelectedChannel] = useState('')
  const [discovering, setDiscovering] = useState(false)
  const [discoverMsg, setDiscoverMsg] = useState('')
  const [detail, setDetail] = useState<Target | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [tRes, cRes] = await Promise.all([
        fetch('/api/media-holding/sponsor-engine/targets?limit=300'),
        fetch('/api/media-holding/channels'),
      ])
      if (tRes.ok) setTargets(((await tRes.json()).targets ?? []) as Target[])
      if (cRes.ok) setChannels(((await cRes.json()).channels ?? []) as Channel[])
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  async function discover() {
    if (!selectedChannel) return
    setDiscovering(true); setDiscoverMsg('')
    try {
      const r = await fetch(`/api/media-holding/sponsor-engine/discover/${selectedChannel}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ n: 10, region: 'NL' }),
      })
      if (r.ok) {
        const j = await r.json()
        setDiscoverMsg(`Sponsor discovery dispatched — task ${j.task_id?.slice(0, 8)}… (~45s)`)
        setTimeout(load, 45_000)
      } else {
        const j = await r.json().catch(() => ({}))
        setDiscoverMsg(`Fout: ${j.error ?? r.status}`)
      }
    } finally { setDiscovering(false) }
  }

  async function updateStatus(id: string, status: Target['status']) {
    await fetch(`/api/media-holding/sponsor-engine/targets/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    setTargets((prev) => prev.map((t) => t.id === id ? { ...t, status } : t))
    if (detail?.id === id) setDetail({ ...detail, status })
  }

  async function removeTarget(id: string) {
    if (!confirm('Sponsor target verwijderen?')) return
    await fetch(`/api/media-holding/sponsor-engine/targets/${id}`, { method: 'DELETE' })
    setTargets((prev) => prev.filter((t) => t.id !== id))
    if (detail?.id === id) setDetail(null)
  }

  const byStatus: Record<string, Target[]> = {}
  for (const s of STATUSES) byStatus[s] = targets.filter((t) => t.status === s)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/media-holding" className="text-white/40 hover:text-white">
            <ChevronLeft size={16} />
          </Link>
          <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
            <Megaphone size={16} className="text-indigo-400" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-white">Sponsor Engine</h1>
            <p className="text-xs text-white/50">Persona: <span className="text-emerald-300">Eve</span> — brand discovery + outreach drafts per channel.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={selectedChannel}
            onChange={(e) => setSelectedChannel(e.target.value)}
            className="bg-white/[0.06] border border-white/10 rounded-lg px-3 py-2 text-xs text-white"
          >
            <option value="">Kies channel…</option>
            {channels.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <button
            onClick={discover}
            disabled={!selectedChannel || discovering}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-medium px-4 py-2 rounded-lg"
          >
            <Sparkles size={13} className={discovering ? 'animate-pulse' : ''} />
            {discovering ? 'Genereren…' : 'Discover 10 brands'}
          </button>
        </div>
      </div>

      {discoverMsg && (
        <div className="bg-white/[0.04] border border-white/10 rounded-lg px-4 py-2.5 text-[11px] text-white/70">{discoverMsg}</div>
      )}

      {loading ? (
        <div className="p-10 text-center text-xs text-white/40">Laden…</div>
      ) : targets.length === 0 ? (
        <div className="p-10 text-center bg-white/[0.04] border border-white/5 rounded-xl">
          <Megaphone size={32} className="mx-auto text-white/30 mb-3" />
          <p className="text-sm text-white/65">Nog geen sponsor targets.</p>
          <p className="text-[11px] text-white/40 mt-1">Kies een kanaal en klik &quot;Discover 10 brands&quot;.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {STATUSES.map((s) => (
            <div key={s} className="bg-white/[0.04] border border-white/5 rounded-xl p-3 min-h-[200px]">
              <div className="flex items-center justify-between mb-2">
                <span className={clsx('px-2 py-0.5 rounded-full text-[10px] font-medium', STATUS_COLORS[s])}>{s}</span>
                <span className="text-[10px] text-white/40">{byStatus[s].length}</span>
              </div>
              <div className="space-y-1.5">
                {byStatus[s].map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setDetail(t)}
                    className="w-full text-left bg-white/[0.06] border border-white/5 rounded-lg p-2 hover:bg-white/[0.10]"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs text-white/90 font-medium line-clamp-1">{t.brand_name}</p>
                      <span className={clsx(
                        'px-1.5 py-0.5 rounded text-[9px] font-bold ml-1 shrink-0',
                        t.fit_score >= 85 ? 'bg-emerald-500/15 text-emerald-300' :
                        t.fit_score >= 70 ? 'bg-amber-500/15 text-amber-300' :
                                            'bg-white/[0.06] text-white/55',
                      )}>{t.fit_score}</span>
                    </div>
                    <p className="text-[10px] text-white/45 line-clamp-1">{t.category ?? t.industry ?? '—'}</p>
                    {t.est_budget && <p className="text-[10px] text-white/55 mt-0.5">{t.est_budget}</p>}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#0f1117] border border-white/10 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-white/5">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-white">{detail.brand_name}</h2>
                <span className={clsx(
                  'px-2 py-0.5 rounded text-[10px] font-bold',
                  detail.fit_score >= 85 ? 'bg-emerald-500/15 text-emerald-300' :
                  detail.fit_score >= 70 ? 'bg-amber-500/15 text-amber-300' :
                                            'bg-white/[0.06] text-white/55',
                )}>fit {detail.fit_score}</span>
                <span className={clsx('px-2 py-0.5 rounded-full text-[10px] font-medium', STATUS_COLORS[detail.status])}>{detail.status}</span>
              </div>
              <button onClick={() => setDetail(null)}><X size={16} className="text-white/50 hover:text-white" /></button>
            </div>

            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <p className="text-[10px] text-white/40 uppercase tracking-wider mb-0.5">Industry</p>
                  <p className="text-white/85">{detail.industry ?? '—'}</p>
                </div>
                <div>
                  <p className="text-[10px] text-white/40 uppercase tracking-wider mb-0.5">Category</p>
                  <p className="text-white/85">{detail.category ?? '—'}</p>
                </div>
                <div>
                  <p className="text-[10px] text-white/40 uppercase tracking-wider mb-0.5">Website</p>
                  <p className="text-white/85">{detail.website ?? '—'}</p>
                </div>
                <div>
                  <p className="text-[10px] text-white/40 uppercase tracking-wider mb-0.5">Est. budget</p>
                  <p className="text-white/85">{detail.est_budget ?? '—'}</p>
                </div>
                <div>
                  <p className="text-[10px] text-white/40 uppercase tracking-wider mb-0.5">Contact</p>
                  <p className="text-white/85">{detail.contact_name ?? '—'}</p>
                </div>
                <div>
                  <p className="text-[10px] text-white/40 uppercase tracking-wider mb-0.5">Email</p>
                  <p className="text-white/85">{detail.contact_email ?? '—'}</p>
                </div>
              </div>

              {detail.notes && (
                <div>
                  <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1">Fit notes</p>
                  <p className="text-xs text-white/75">{detail.notes}</p>
                </div>
              )}

              {detail.outreach_draft && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-[10px] text-white/40 uppercase tracking-wider flex items-center gap-1.5">
                      <Mail size={11} /> Outreach draft
                    </p>
                    <button
                      onClick={() => navigator.clipboard.writeText(detail.outreach_draft ?? '')}
                      className="flex items-center gap-1 text-[10px] text-indigo-300 hover:text-indigo-200"
                    >
                      <Copy size={11} /> kopieer
                    </button>
                  </div>
                  <pre className="text-[11px] text-white/85 whitespace-pre-wrap font-sans bg-white/[0.03] border border-white/5 rounded-lg p-3">{detail.outreach_draft}</pre>
                </div>
              )}

              <div className="flex flex-wrap gap-2 pt-3 border-t border-white/5">
                {STATUSES.filter((s) => s !== detail.status).map((s) => (
                  <button
                    key={s}
                    onClick={() => updateStatus(detail.id, s)}
                    className={clsx('px-3 py-1.5 rounded-lg text-[11px] font-medium', STATUS_COLORS[s], 'hover:brightness-125')}
                  >
                    → {s}
                  </button>
                ))}
                <button
                  onClick={() => removeTarget(detail.id)}
                  className="ml-auto flex items-center gap-1 text-[11px] text-red-400/60 hover:text-red-400"
                >
                  <Trash2 size={11} /> verwijder
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
