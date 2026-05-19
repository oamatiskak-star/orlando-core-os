'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Link as LinkIcon, ChevronLeft, Plus, Trash2, Power, ExternalLink, MousePointerClick, TrendingUp } from 'lucide-react'
import clsx from 'clsx'

type AffLink = {
  id: string
  affiliate_id: string
  product: string
  network: string | null
  niche: string | null
  url: string
  commission_pct: number | null
  channel_id: string | null
  active: boolean
  channel: { id: string; name: string | null; naam: string | null; niche: string | null } | null
}

type Perf = {
  link_id: string
  product: string | null
  network: string | null
  niche: string | null
  channel_id: string | null
  click_count: number
  confirmed_count: number
  confirmed_commission_eur: number
  pending_commission_eur: number
  conversion_rate_pct: number
  epc_eur: number
  link: { id: string; product: string; network: string | null; niche: string | null; url: string; active: boolean } | null
  channel: { id: string; name: string | null; naam: string | null } | null
}

type Channel = { id: string; name: string | null; naam: string | null; niche: string | null }

const NEW_LINK = {
  affiliate_id: '',
  product: '',
  network: '',
  niche: '',
  url: '',
  commission_pct: '',
  channel_id: '',
}

function eur(n: number) {
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(n)
}

export default function AffiliateEnginePage() {
  const [links, setLinks] = useState<AffLink[]>([])
  const [perf, setPerf] = useState<Perf[]>([])
  const [channels, setChannels] = useState<Channel[]>([])
  const [totals, setTotals] = useState({
    total_links: 0,
    total_clicks: 0,
    total_confirmed: 0,
    total_confirmed_commission: 0,
    total_pending_commission: 0,
  })
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState('')
  const [creating, setCreating] = useState(false)
  const [newLink, setNewLink] = useState(NEW_LINK)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [lRes, pRes] = await Promise.all([
        fetch('/api/media-holding/affiliate-engine/links'),
        fetch('/api/media-holding/affiliate-engine/performance'),
      ])
      if (lRes.ok) {
        const j = await lRes.json()
        setLinks(j.links ?? [])
        setChannels(j.channels ?? [])
      }
      if (pRes.ok) {
        const j = await pRes.json()
        setPerf(j.performance ?? [])
        setTotals(j.totals ?? totals)
      }
    } finally { setLoading(false) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { load() }, [load])

  async function createLink() {
    if (!newLink.affiliate_id || !newLink.product || !newLink.url) {
      setMsg('affiliate_id, product, url verplicht')
      return
    }
    setCreating(true); setMsg('')
    try {
      const r = await fetch('/api/media-holding/affiliate-engine/links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newLink,
          commission_pct: newLink.commission_pct ? parseFloat(newLink.commission_pct) : null,
          channel_id: newLink.channel_id || null,
          niche: newLink.niche || null,
          network: newLink.network || null,
        }),
      })
      if (r.ok) {
        setNewLink(NEW_LINK)
        await load()
        setMsg('Link aangemaakt.')
      } else {
        const j = await r.json().catch(() => ({}))
        setMsg(`Fout: ${j.error ?? r.status}`)
      }
    } finally { setCreating(false) }
  }

  async function toggleActive(id: string, active: boolean) {
    await fetch(`/api/media-holding/affiliate-engine/links/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active }),
    })
    await load()
  }

  async function deleteLink(id: string) {
    if (!confirm('Link verwijderen?')) return
    await fetch(`/api/media-holding/affiliate-engine/links/${id}`, { method: 'DELETE' })
    await load()
  }

  const perfByLink = new Map(perf.map((p) => [p.link_id, p]))

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/media-holding" className="text-white/40 hover:text-white">
          <ChevronLeft size={16} />
        </Link>
        <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
          <LinkIcon size={16} className="text-amber-400" />
        </div>
        <div>
          <h1 className="text-base font-semibold text-white">Affiliate Engine</h1>
          <p className="text-xs text-white/50">{totals.total_links} links · {totals.total_clicks} clicks · {totals.total_confirmed} confirmed</p>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Kpi label="Confirmed revenue" value={eur(totals.total_confirmed_commission)} color="text-emerald-300" />
        <Kpi label="Pending revenue"   value={eur(totals.total_pending_commission)}   color="text-amber-300" />
        <Kpi label="Total clicks"      value={totals.total_clicks.toLocaleString('nl-NL')} color="text-white" icon={<MousePointerClick size={11} />} />
        <Kpi label="Confirmed conv."   value={totals.total_confirmed.toLocaleString('nl-NL')} color="text-violet-300" icon={<TrendingUp size={11} />} />
      </div>

      {msg && (
        <div className="bg-white/[0.04] border border-white/10 rounded-lg px-4 py-2.5 text-[11px] text-white/70">
          {msg}
        </div>
      )}

      {/* New link form */}
      <div className="bg-white/[0.04] border border-white/8 rounded-xl p-4">
        <h2 className="text-[10px] font-semibold text-white/40 uppercase tracking-wider mb-3">Nieuwe affiliate link</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
          <Field label="affiliate_id"   value={newLink.affiliate_id}   onChange={(v) => setNewLink({ ...newLink, affiliate_id: v })} placeholder="bv. 12345" />
          <Field label="product"        value={newLink.product}        onChange={(v) => setNewLink({ ...newLink, product: v })} placeholder="bv. AeroPress" />
          <Field label="network"        value={newLink.network}        onChange={(v) => setNewLink({ ...newLink, network: v })} placeholder="bv. Amazon" />
          <Field label="niche"          value={newLink.niche}          onChange={(v) => setNewLink({ ...newLink, niche: v })} placeholder="bv. coffee" />
          <div className="col-span-2 sm:col-span-3">
            <Field label="url" value={newLink.url} onChange={(v) => setNewLink({ ...newLink, url: v })} placeholder="https://..." />
          </div>
          <Field label="commission_pct" value={newLink.commission_pct} onChange={(v) => setNewLink({ ...newLink, commission_pct: v })} placeholder="bv. 8.5" />
          <div>
            <p className="text-[9px] text-white/40 uppercase tracking-wider mb-1">channel</p>
            <select
              value={newLink.channel_id}
              onChange={(e) => setNewLink({ ...newLink, channel_id: e.target.value })}
              className="w-full bg-white/[0.06] border border-white/10 rounded px-2 py-1.5 text-xs text-white"
            >
              <option value="">— geen —</option>
              {channels.map((c) => (
                <option key={c.id} value={c.id}>{c.naam ?? c.name}</option>
              ))}
            </select>
          </div>
        </div>
        <button
          onClick={createLink}
          disabled={creating}
          className="flex items-center gap-1 bg-amber-500/20 border border-amber-500/30 hover:bg-amber-500/30 disabled:opacity-50 text-amber-300 text-[11px] font-medium px-2.5 py-1.5 rounded-lg"
        >
          <Plus size={11} /> Voeg toe
        </button>
      </div>

      {/* Links table */}
      {loading ? (
        <div className="p-10 text-center text-xs text-white/40">Laden…</div>
      ) : links.length === 0 ? (
        <div className="p-10 text-center bg-white/[0.04] border border-white/5 rounded-xl">
          <LinkIcon size={32} className="mx-auto text-white/30 mb-3" />
          <p className="text-sm text-white/65">Nog geen affiliate links.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {links.map((link) => {
            const p = perfByLink.get(link.id)
            return (
              <div key={link.id} className={clsx(
                'flex items-center gap-3 p-3 rounded-xl border',
                link.active ? 'bg-white/[0.04] border-white/8' : 'bg-white/[0.02] border-white/5 opacity-60'
              )}>
                <button
                  onClick={() => toggleActive(link.id, !link.active)}
                  className={clsx(
                    'shrink-0 w-8 h-5 rounded-full transition-colors flex items-center px-0.5',
                    link.active ? 'bg-emerald-500/40 justify-end' : 'bg-white/10 justify-start'
                  )}
                >
                  <span className="w-4 h-4 rounded-full bg-white" />
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-semibold text-white truncate">{link.product}</span>
                    {link.network && <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.08] text-white/55">{link.network}</span>}
                    {link.niche && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300">{link.niche}</span>}
                    {link.channel && <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-500/10 text-violet-300">{link.channel.naam ?? link.channel.name}</span>}
                  </div>
                  <a href={link.url} target="_blank" rel="noreferrer" className="text-[10px] text-white/40 hover:text-white/70 line-clamp-1 inline-flex items-center gap-1">
                    {link.url} <ExternalLink size={9} />
                  </a>
                </div>
                <div className="grid grid-cols-4 gap-3 text-right shrink-0">
                  <Stat label="Clicks"      value={String(p?.click_count ?? 0)} color="text-white/70" />
                  <Stat label="Conv."       value={String(p?.confirmed_count ?? 0)} color="text-violet-300" />
                  <Stat label="EPC"         value={eur(Number(p?.epc_eur ?? 0))} color="text-amber-300" />
                  <Stat label="Confirmed"   value={eur(Number(p?.confirmed_commission_eur ?? 0))} color="text-emerald-300" />
                </div>
                <button
                  onClick={() => deleteLink(link.id)}
                  className="shrink-0 text-white/30 hover:text-red-400 p-1"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function Kpi({ label, value, color, icon }: { label: string; value: string; color: string; icon?: React.ReactNode }) {
  return (
    <div className="bg-white/[0.04] border border-white/8 rounded-xl p-3.5">
      <div className="flex items-center gap-1 text-[10px] text-white/40 uppercase tracking-wide mb-1">
        {icon}<span>{label}</span>
      </div>
      <p className={`text-lg font-semibold tabular-nums ${color}`}>{value}</p>
    </div>
  )
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div>
      <p className="text-[9px] text-white/35 uppercase">{label}</p>
      <p className={`text-xs font-semibold tabular-nums ${color}`}>{value}</p>
    </div>
  )
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <p className="text-[9px] text-white/40 uppercase tracking-wider mb-1">{label}</p>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-white/[0.06] border border-white/10 rounded px-2 py-1.5 text-xs text-white placeholder:text-white/30"
      />
    </div>
  )
}
