'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Sparkles, Check, X, Loader2, TrendingUp, FileText, Calculator, LayoutTemplate, GraduationCap, Users, MessagesSquare, Package } from 'lucide-react'

type Row = {
  id: string; niche: string; offer_type: string; title: string; description: string | null
  demand_signal: number; est_margin: number; est_price_eur: number; est_monthly_eur: number
  score: number; status: string; source: string; rationale: string | null
  score_rank: number; niche_rank: number
}
type Run = { status: string; proposed: number; enriched: number; model: string | null; fallback_reason: string | null; created_at: string } | null

const TYPE_ICON: Record<string, typeof FileText> = {
  rapport: FileText, calculator: Calculator, template: LayoutTemplate,
  cursus: GraduationCap, membership: Users, community: MessagesSquare,
}
const STATUS_C: Record<string, string> = {
  proposed: '#f59e0b', approved: '#22c55e', building: '#38bdf8', live: '#a855f7', rejected: '#64748b',
}
const eur = (n: number) => '€' + (n ?? 0).toLocaleString('nl-NL', { maximumFractionDigits: 0 })

export default function OfferEngineClient({ initial, lastRun }: { initial: Row[]; lastRun: Run }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  const rows = initial
  const proposed = rows.filter((r) => r.status === 'proposed')
  const decided = rows.filter((r) => r.status !== 'proposed')
  const potentialMonthly = proposed.reduce((s, r) => s + (r.est_monthly_eur ?? 0), 0)
  const approvedMonthly = rows.filter((r) => ['approved', 'building', 'live'].includes(r.status))
    .reduce((s, r) => s + (r.est_monthly_eur ?? 0), 0)

  async function propose() {
    setBusy(true); setMsg(null)
    try {
      const res = await fetch('/api/media-holding/offer-engine/propose', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })
      const j = await res.json()
      setMsg(j.note ?? j.error ?? 'klaar')
      router.refresh()
    } catch (e) { setMsg(e instanceof Error ? e.message : 'fout') }
    finally { setBusy(false) }
  }

  async function decide(id: string, status: string) {
    setBusyId(id); setMsg(null)
    try {
      const res = await fetch('/api/media-holding/offer-engine/decide', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id, status }) })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) { setMsg(j.error ?? `Fout ${res.status}`); return }
      setMsg(status === 'approved' ? '✓ Goedgekeurd' : status === 'rejected' ? '✗ Afgewezen' : `Status → ${status}`)
      router.refresh()
    } catch (e) { setMsg(e instanceof Error ? e.message : 'Netwerkfout') }
    finally { setBusyId(null) }
  }

  return (
    <div className="space-y-5">
      {/* actiebalk + KPI's */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white/[0.04] border border-white/8 rounded-2xl p-4 flex items-center justify-between gap-4">
          <div>
            <div className="text-xs text-white/55">Indicatieve maand-potentie (proxy)</div>
            <div className="text-2xl font-bold text-white">{eur(potentialMonthly)}<span className="text-xs font-normal text-white/35"> voorgesteld</span></div>
            <div className="text-[11px] text-white/40">{eur(approvedMonthly)} goedgekeurd/in aanbouw · {proposed.length} voorstellen · {decided.length} besloten</div>
          </div>
          <button onClick={propose} disabled={busy}
            className="flex items-center gap-2 rounded-xl bg-amber-500/15 border border-amber-500/30 px-4 py-2.5 text-sm font-medium text-amber-300 hover:bg-amber-500/25 disabled:opacity-50 transition-colors">
            {busy ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
            Genereer voorstellen
          </button>
        </div>
        <div className="bg-white/[0.04] border border-white/8 rounded-2xl p-4">
          <div className="text-xs text-white/55 mb-1">Laatste run</div>
          {lastRun ? (
            <>
              <div className="text-sm text-white/80">{lastRun.proposed} nieuw · {lastRun.enriched} AI-verrijkt</div>
              <div className="text-[11px] mt-1" style={{ color: lastRun.status === 'ok' ? '#22c55e' : '#f59e0b' }}>
                {lastRun.status === 'ok' ? 'AI-verrijking actief' : 'deterministisch'}{lastRun.model ? ` · ${lastRun.model}` : ''}
              </div>
              {lastRun.fallback_reason && <div className="text-[10px] text-white/35 mt-1 truncate" title={lastRun.fallback_reason}>reden: {lastRun.fallback_reason}</div>}
            </>
          ) : <div className="text-[11px] text-white/35">nog geen run — klik &quot;Genereer voorstellen&quot;</div>}
        </div>
      </div>

      {msg && <div className="text-[11px] text-white/50 bg-white/[0.03] border border-white/8 rounded-lg px-3 py-2">{msg}</div>}

      {/* voorstellen per niche */}
      {Object.entries(groupBy(proposed, 'niche')).map(([niche, items]) => (
        <div key={niche} className="space-y-2">
          <div className="flex items-center gap-2">
            <TrendingUp size={13} className="text-amber-400" />
            <span className="text-xs font-semibold text-white/80">{labelNiche(niche)}</span>
            <span className="text-[10px] text-white/30">demand {items[0]?.demand_signal?.toFixed?.(2)}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {items.sort((a, b) => b.score - a.score).map((r) => {
              const Icon = TYPE_ICON[r.offer_type] ?? Package
              return (
                <div key={r.id} className="bg-white/[0.03] border border-white/8 rounded-2xl p-4 space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Icon size={14} className="text-amber-400 shrink-0" />
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-300/80">{r.offer_type}</span>
                    </div>
                    {r.source === 'ai' && <span className="text-[9px] text-violet-300/70">AI</span>}
                  </div>
                  <div className="text-sm font-medium text-white leading-snug">{r.title}</div>
                  {r.description && <div className="text-[11px] text-white/45 leading-snug line-clamp-2">{r.description}</div>}
                  <div className="grid grid-cols-3 gap-1.5 text-[10px]">
                    <Mini label="prijs" value={eur(r.est_price_eur)} />
                    <Mini label="marge" value={`${Math.round(r.est_margin * 100)}%`} />
                    <Mini label="~/mnd" value={eur(r.est_monthly_eur)} />
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <button onClick={() => decide(r.id, 'approved')} disabled={busyId === r.id}
                      className="flex-1 flex items-center justify-center gap-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 py-1.5 text-[11px] font-medium text-emerald-300 hover:bg-emerald-500/25 disabled:opacity-50">
                      {busyId === r.id ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Keur goed
                    </button>
                    <button onClick={() => decide(r.id, 'rejected')} disabled={busyId === r.id}
                      className="flex items-center justify-center gap-1 rounded-lg bg-white/5 border border-white/10 px-2.5 py-1.5 text-[11px] text-white/50 hover:bg-white/10 disabled:opacity-50">
                      <X size={12} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}

      {proposed.length === 0 && (
        <div className="text-[12px] text-white/40 bg-white/[0.03] border border-white/8 rounded-2xl p-6 text-center">
          Geen openstaande voorstellen. Klik &quot;Genereer voorstellen&quot; om uit de niche-vraagsignalen aanbod te laten voorstellen.
        </div>
      )}

      {/* besloten */}
      {decided.length > 0 && (
        <div className="bg-white/[0.04] border border-white/8 rounded-2xl overflow-hidden">
          <div className="px-4 py-2.5 border-b border-white/5 text-xs font-semibold text-white">Besloten ({decided.length})</div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead className="text-white/35"><tr className="border-b border-white/5">
                <th className="px-4 py-2 font-medium">Aanbod</th><th className="px-3 py-2 font-medium">Niche</th>
                <th className="px-3 py-2 font-medium text-right">~/mnd</th><th className="px-3 py-2 font-medium">Status</th><th className="px-3 py-2 font-medium">Actie</th>
              </tr></thead>
              <tbody>
                {decided.map((r) => (
                  <tr key={r.id} className="border-b border-white/5 last:border-0">
                    <td className="px-4 py-2 text-white/75">{r.title}</td>
                    <td className="px-3 py-2 text-white/45">{labelNiche(r.niche)}</td>
                    <td className="px-3 py-2 text-right text-white/55">{eur(r.est_monthly_eur)}</td>
                    <td className="px-3 py-2">
                      <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase" style={{ color: STATUS_C[r.status], background: `${STATUS_C[r.status]}1a` }}>{r.status}</span>
                    </td>
                    <td className="px-3 py-2">
                      <select defaultValue={r.status} onChange={(e) => decide(r.id, e.target.value)}
                        className="bg-white/5 border border-white/10 rounded px-1.5 py-1 text-[10px] text-white/60">
                        {['proposed', 'approved', 'building', 'live', 'rejected'].map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p className="text-[10px] text-white/30 leading-relaxed">
        Bron: <code className="text-white/40">v_niche_ranking</code> + <code className="text-white/40">v_niche_momentum</code> + <code className="text-white/40">v_attribution_niche</code>.
        Score = demand × marge (deterministisch). &quot;~/mnd&quot; is een indicatieve proxy, geen voorspelling. Alleen monetiseerbare (buyer-intent) niches.
        Propose-only: de engine zet niets live — een mens keurt goed.
      </p>
    </div>
  )
}

function Mini({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg bg-black/20 px-1.5 py-1"><div className="text-white/30 text-[9px]">{label}</div><div className="font-semibold text-white/75">{value}</div></div>
}
function groupBy<T extends Record<string, unknown>>(arr: T[], key: keyof T): Record<string, T[]> {
  return arr.reduce((acc, x) => { const k = String(x[key]); (acc[k] ??= []).push(x); return acc }, {} as Record<string, T[]>)
}
function labelNiche(n: string) {
  return n.replace(/_/g, ' ').replace(/\bnl\b/i, 'NL').replace(/\b\w/g, (c) => c.toUpperCase())
}
