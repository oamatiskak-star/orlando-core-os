'use client'

import { useCallback, useEffect, useState } from 'react'
import clsx from 'clsx'
import { Loader2, Plug, FlaskConical, Rocket, CheckCircle2, XCircle, MousePointerClick, Users, ShoppingCart, Euro, Cookie, Network, Tv } from 'lucide-react'

const POLL_MS = 5000

type Detail = {
  program: {
    id: string; name: string; account_status: string; approval_status: string | null; login_status: string | null
    connect_status: 'NOT_CONNECTED' | 'CONNECTED' | 'ACTIVE'
    network: string; category: string; cookie_days: number | null; commission_model: string | null; recurring: boolean | null
    best_channel: string | null; referral_code: string | null; affiliate_link: string | null
    affiliate_account_id: string | null; last_sync_at: string | null
  }
  metrics: { clicks: number; conversions: number; confirmed: number; revenue_eur: number; epc: number }
  first_euro_status: 'NOT STARTED' | 'FIRST CLICK' | 'FIRST CONVERSION' | 'FIRST COMMISSION' | 'FIRST EURO'
  links: { product: string; url: string; short_code: string | null; active: boolean; status: string }[]
}

type TestResult = { ok: boolean; url_valid: boolean; tag_present: boolean; redirect_works: boolean; health: string; message: string }

const CONNECT_STYLE: Record<string, string> = {
  NOT_CONNECTED: 'bg-white/[0.04] text-white/45 border-white/15',
  CONNECTED: 'bg-amber-500/10 text-amber-300 border-amber-400/30',
  ACTIVE: 'bg-emerald-500/10 text-emerald-300 border-emerald-400/30',
}
const CONNECT_LABEL: Record<string, string> = { NOT_CONNECTED: 'NIET GEKOPPELD', CONNECTED: 'GEKOPPELD', ACTIVE: 'ACTIEF' }

const MILESTONES = ['NOT STARTED', 'FIRST CLICK', 'FIRST CONVERSION', 'FIRST COMMISSION', 'FIRST EURO'] as const
const MILE_LABEL: Record<string, string> = {
  'NOT STARTED': 'Not started', 'FIRST CLICK': 'Eerste click', 'FIRST CONVERSION': 'Eerste conversie',
  'FIRST COMMISSION': 'Eerste commissie', 'FIRST EURO': 'Eerste euro',
}

function eur(n: number) { return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(n) }

export default function ProgramDetailPanel({ programId }: { programId: string }) {
  const [d, setD] = useState<Detail | null>(null)
  const [loading, setLoading] = useState(true)
  const [affiliateId, setAffiliateId] = useState('')
  const [trackingTag, setTrackingTag] = useState('')
  const [referralUrl, setReferralUrl] = useState('')
  const [seeded, setSeeded] = useState(false)
  const [busy, setBusy] = useState('')
  const [msg, setMsg] = useState('')
  const [test, setTest] = useState<TestResult | null>(null)

  const load = useCallback(async () => {
    const res = await fetch(`/api/account-setup/activation/program/${programId}`)
    if (res.ok) {
      const j: Detail = await res.json()
      setD(j)
      if (!seeded) {
        setTrackingTag(j.program.referral_code ?? '')
        setReferralUrl(j.program.affiliate_link ?? '')
        setAffiliateId(j.program.affiliate_account_id ?? '')
        setSeeded(true)
      }
    }
    setLoading(false)
  }, [programId, seeded])

  useEffect(() => { load(); const t = setInterval(load, POLL_MS); return () => clearInterval(t) }, [load])

  async function post(path: string, body: Record<string, unknown>, label: string): Promise<unknown> {
    setBusy(label); setMsg('')
    try {
      const r = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { setMsg(`Fout: ${j.error ?? r.status}`); return null }
      return j
    } finally { setBusy('') }
  }

  async function doConnect() {
    const j = await post('/api/account-setup/activation/connect', { programId, affiliateId, trackingTag, referralUrl }, 'connect')
    if (j) { setMsg('Account gekoppeld.'); await load() }
  }
  async function doTest() {
    setBusy('test'); setTest(null)
    try {
      const r = await fetch('/api/account-setup/activation/test-link', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: referralUrl, tag: trackingTag }),
      })
      setTest(await r.json())
    } finally { setBusy('') }
  }
  async function doActivate() {
    const j = await post('/api/account-setup/activation/activate-program', { programId }, 'activate')
    if (j) { setMsg('Programma geactiveerd — keten is live.'); await load() }
  }

  if (loading) return <div className="p-10 text-center text-xs text-white/40">Laden…</div>
  if (!d) return <div className="p-10 text-center text-xs text-white/40">Programma niet gevonden.</div>

  const p = d.program
  const isActive = p.connect_status === 'ACTIVE'
  const mileIdx = MILESTONES.indexOf(d.first_euro_status)

  return (
    <div className="space-y-4">
      {/* STAP 1+2 — detail + connect-status */}
      <div className="bg-white/[0.04] border border-white/8 rounded-xl p-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <h2 className="text-lg font-semibold text-white">{p.name}</h2>
            <p className="text-[11px] text-white/45">{p.category}</p>
          </div>
          <span className={clsx('inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide rounded-lg border px-2.5 py-1', CONNECT_STYLE[p.connect_status])}>
            <Plug size={12} /> {CONNECT_LABEL[p.connect_status]}
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
          <Meta icon={<Network size={11} />} label="Netwerk" value={p.network} />
          <Meta icon={<Tv size={11} />} label="Kanaal" value={p.best_channel ?? '—'} />
          <Meta icon={<Cookie size={11} />} label="Cookie" value={p.cookie_days != null ? `${p.cookie_days} dagen` : '—'} />
          <Meta label="Commissie" value={p.commission_model ?? (p.recurring ? 'recurring' : 'one-time')} />
          <Meta label="Clicks" value={String(d.metrics.clicks)} />
          <Meta label="Conversies" value={String(d.metrics.conversions)} />
          <Meta label="Omzet" value={eur(d.metrics.revenue_eur)} />
          <Meta label="Laatste sync" value={p.last_sync_at ? new Date(p.last_sync_at).toLocaleDateString('nl-NL') : '—'} />
        </div>
      </div>

      {/* STAP 3 — account koppelen */}
      <div className="bg-white/[0.04] border border-white/8 rounded-xl p-4">
        <h3 className="text-[10px] font-semibold text-white/40 uppercase tracking-wider mb-3">Stap 1 · Account koppelen</h3>
        <div className="grid sm:grid-cols-3 gap-2 mb-3">
          <Field label="Affiliate ID" value={affiliateId} onChange={setAffiliateId} placeholder="bv. orlando-21" />
          <Field label="Tracking Tag" value={trackingTag} onChange={setTrackingTag} placeholder="bv. hermes-21" />
          <Field label="Referral URL" value={referralUrl} onChange={setReferralUrl} placeholder="https://www.amazon.nl/?tag=hermes-21" />
        </div>
        <button onClick={doConnect} disabled={busy === 'connect'}
          className="inline-flex items-center gap-1.5 bg-white/[0.08] border border-white/15 hover:bg-white/[0.14] disabled:opacity-50 text-white text-[11px] font-medium px-3 py-1.5 rounded-lg">
          {busy === 'connect' ? <Loader2 size={12} className="animate-spin" /> : <Plug size={12} />} Opslaan & koppelen
        </button>
      </div>

      {/* STAP 4 — test link */}
      <div className="bg-white/[0.04] border border-white/8 rounded-xl p-4">
        <h3 className="text-[10px] font-semibold text-white/40 uppercase tracking-wider mb-3">Stap 2 · Test link</h3>
        <button onClick={doTest} disabled={busy === 'test' || !referralUrl}
          className="inline-flex items-center gap-1.5 bg-cyan-500/15 border border-cyan-500/30 hover:bg-cyan-500/25 disabled:opacity-50 text-cyan-200 text-[11px] font-medium px-3 py-1.5 rounded-lg mb-3">
          {busy === 'test' ? <Loader2 size={12} className="animate-spin" /> : <FlaskConical size={12} />} TEST LINK
        </button>
        {test && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
            <Check label="URL geldig" ok={test.url_valid} />
            <Check label="Redirect werkt" ok={test.redirect_works} />
            <Check label="Affiliate-tag" ok={test.tag_present} />
            <Check label="Link-health" ok={test.health === 'ok'} note={test.health} />
            <p className="col-span-2 sm:col-span-4 text-white/55">{test.message}</p>
          </div>
        )}
      </div>

      {/* STAP 5 — go live */}
      <div className="bg-white/[0.04] border border-white/8 rounded-xl p-4">
        <h3 className="text-[10px] font-semibold text-white/40 uppercase tracking-wider mb-3">Stap 3 · Activeren</h3>
        {isActive ? (
          <span className="inline-flex items-center gap-1.5 text-[12px] text-emerald-300"><CheckCircle2 size={14} /> Programma is live — keten actief</span>
        ) : (
          <button onClick={doActivate} disabled={busy === 'activate' || p.connect_status === 'NOT_CONNECTED'}
            className="inline-flex items-center gap-1.5 bg-emerald-500/20 border border-emerald-500/30 hover:bg-emerald-500/30 disabled:opacity-40 text-emerald-200 text-[12px] font-semibold px-4 py-2 rounded-lg">
            {busy === 'activate' ? <Loader2 size={13} className="animate-spin" /> : <Rocket size={13} />} ACTIVATE PROGRAM
          </button>
        )}
        {p.connect_status === 'NOT_CONNECTED' && <p className="mt-2 text-[10px] text-white/40">Koppel eerst een account (stap 1).</p>}
      </div>

      {msg && <div className="bg-white/[0.04] border border-white/10 rounded-lg px-4 py-2 text-[11px] text-white/70">{msg}</div>}

      {/* STAP 6 — live resultaten */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Stat icon={<MousePointerClick size={11} />} label="Clicks" value={String(d.metrics.clicks)} color="text-white" />
        <Stat icon={<ShoppingCart size={11} />} label="Conversies" value={String(d.metrics.confirmed)} color="text-violet-300" />
        <Stat icon={<Euro size={11} />} label="Revenue" value={eur(d.metrics.revenue_eur)} color="text-emerald-300" />
        <Stat icon={<Users size={11} />} label="EPC" value={eur(d.metrics.epc)} color="text-amber-300" />
      </div>

      {/* STAP 7 — first euro status */}
      <div className="bg-white/[0.04] border border-white/8 rounded-xl p-4">
        <h3 className="text-[10px] font-semibold text-white/40 uppercase tracking-wider mb-3">First euro status</h3>
        <div className="flex flex-wrap items-center gap-1.5">
          {MILESTONES.map((m, i) => {
            const done = i <= mileIdx && mileIdx >= 0 && !(m === 'NOT STARTED' && mileIdx > 0)
            const current = m === d.first_euro_status
            return (
              <span key={m} className={clsx('inline-flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-lg border',
                current ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-200'
                : done ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-300/80'
                : 'bg-white/[0.03] border-white/10 text-white/40')}>
                <span className={done || current ? 'text-emerald-400' : 'text-white/30'}>{done || current ? '●' : '○'}</span>
                {MILE_LABEL[m]}
              </span>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function Meta({ icon, label, value }: { icon?: React.ReactNode; label: string; value: string }) {
  return (
    <div>
      <div className="flex items-center gap-1 text-[9px] text-white/40 uppercase tracking-wide mb-0.5">{icon}<span>{label}</span></div>
      <p className="text-white/80 truncate">{value}</p>
    </div>
  )
}
function Stat({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  return (
    <div className="bg-white/[0.04] border border-white/8 rounded-xl p-3">
      <div className="flex items-center gap-1 text-[9px] text-white/40 uppercase tracking-wide mb-1">{icon}<span>{label}</span></div>
      <p className={`text-base font-semibold tabular-nums ${color}`}>{value}</p>
    </div>
  )
}
function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <p className="text-[9px] text-white/40 uppercase tracking-wider mb-1">{label}</p>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="w-full bg-white/[0.06] border border-white/10 rounded px-2 py-1.5 text-xs text-white placeholder:text-white/30" />
    </div>
  )
}
function Check({ label, ok, note }: { label: string; ok: boolean; note?: string }) {
  return (
    <div className="flex items-center gap-1.5">
      {ok ? <CheckCircle2 size={13} className="text-emerald-400" /> : <XCircle size={13} className="text-red-400" />}
      <span className="text-white/70">{label}{note && !ok ? ` (${note})` : ''}</span>
    </div>
  )
}
