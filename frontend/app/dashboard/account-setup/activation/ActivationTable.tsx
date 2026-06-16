'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Zap, ChevronDown, ChevronRight, Loader2, Link2, Power } from 'lucide-react'
import clsx from 'clsx'
import { ActivationStatusBadge } from '@/lib/affiliate-programs/badges'
import { mapActivationStatus, type ActivationRow } from '@/lib/affiliate-programs/types'
import GoLiveForm from './GoLiveForm'

const POLL_MS = 2500

type RunRow = { id: string; run_kind: string; status: string; started_at: string | null }
type StepRow = { id: string; run_id: string; step_kind: string; status: string; output: Record<string, unknown> | null }

function eur(n: number | null) {
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(Number(n ?? 0))
}

export default function ActivationTable({ initialRows }: { initialRows: ActivationRow[] }) {
  const [rows] = useState<ActivationRow[]>(initialRows)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [busy, setBusy] = useState<Record<string, boolean>>({})
  const [msg, setMsg] = useState<Record<string, string>>({})
  const [runs, setRuns] = useState<RunRow[]>([])
  const [steps, setSteps] = useState<StepRow[]>([])
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)

  const pollStatus = useCallback(async (programId: string) => {
    const res = await fetch(`/api/account-setup/activation/status?programId=${programId}`)
    if (!res.ok) return
    const j = await res.json()
    setRuns(j.runs ?? [])
    setSteps(j.steps ?? [])
  }, [])

  useEffect(() => {
    if (timer.current) { clearInterval(timer.current); timer.current = null }
    if (!expanded) { setRuns([]); setSteps([]); return }
    pollStatus(expanded)
    timer.current = setInterval(() => pollStatus(expanded), POLL_MS)
    return () => { if (timer.current) clearInterval(timer.current) }
  }, [expanded, pollStatus])

  async function activate(programId: string) {
    setBusy(b => ({ ...b, [programId]: true }))
    setMsg(m => ({ ...m, [programId]: '' }))
    try {
      const res = await fetch('/api/account-setup/activation/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ programId }),
      })
      const j = await res.json().catch(() => ({}))
      if (res.ok) {
        setMsg(m => ({ ...m, [programId]: 'Geactiveerd — agents draaien. Volg de stappen hieronder.' }))
        setExpanded(programId)
      } else {
        setMsg(m => ({ ...m, [programId]: `Fout: ${j.error ?? res.status}` }))
      }
    } finally {
      setBusy(b => ({ ...b, [programId]: false }))
    }
  }

  async function linkContent(programId: string) {
    setBusy(b => ({ ...b, [`c_${programId}`]: true }))
    setMsg(m => ({ ...m, [programId]: '' }))
    try {
      const res = await fetch('/api/account-setup/activation/content-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ programId, topN: 10 }),
      })
      const j = await res.json().catch(() => ({}))
      setMsg(m => ({ ...m, [programId]: res.ok ? `${j.created} content-link(s) gegenereerd.` : `Fout: ${j.error ?? res.status}` }))
    } finally {
      setBusy(b => ({ ...b, [`c_${programId}`]: false }))
    }
  }

  return (
    <div className="bg-white/[0.04] border border-white/8 rounded-xl overflow-hidden">
      <div className="hidden md:grid grid-cols-[1.6fr_0.9fr_0.5fr_0.5fr_0.6fr_0.7fr_1fr_0.9fr_auto] gap-2 px-4 py-2.5 text-[9px] font-semibold text-white/40 uppercase tracking-wider border-b border-white/8">
        <span>Programma</span>
        <span>Status</span>
        <span className="text-right">Tier</span>
        <span className="text-right">RPM</span>
        <span className="text-right">EPC</span>
        <span className="text-right">Cookie</span>
        <span>Kanaal match</span>
        <span className="text-right">Verw. omzet</span>
        <span className="text-right">Actie</span>
      </div>

      {rows.length === 0 ? (
        <div className="p-10 text-center text-xs text-white/40">Geen prioriteitsprogramma’s gevonden.</div>
      ) : rows.map((r) => {
        const status = mapActivationStatus(r.account_status, r.approval_status)
        const isOpen = expanded === r.id
        return (
          <div key={r.id} className="border-b border-white/5 last:border-0">
            <div className="grid grid-cols-2 md:grid-cols-[1.6fr_0.9fr_0.5fr_0.5fr_0.6fr_0.7fr_1fr_0.9fr_auto] gap-2 px-4 py-3 items-center text-xs">
              <span className="flex items-center gap-1.5 min-w-0">
                <button onClick={() => setExpanded(isOpen ? null : r.id)} className="shrink-0 text-white/40 hover:text-white">
                  {isOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                </button>
                <Link href={`/dashboard/account-setup/activation/${r.id}`} className="font-semibold text-white truncate hover:text-violet-300">{r.name}</Link>
              </span>
              <span><ActivationStatusBadge status={status} size="xs" /></span>
              <span className="text-right tabular-nums text-white/70">{r.tier ?? '—'}</span>
              <span className="text-right tabular-nums text-white/70">{r.rpm_equiv ?? '—'}</span>
              <span className="text-right tabular-nums text-amber-300">{eur(r.avg_epc)}</span>
              <span className="text-right tabular-nums text-white/70">{r.cookie_days != null ? `${r.cookie_days}d` : '—'}</span>
              <span className="text-violet-300/90 truncate">{r.best_channel_name ?? '—'}</span>
              <span className="text-right tabular-nums text-emerald-300">{eur(r.revenue_potential)}</span>
              <span className="flex justify-end">
                {status === 'ACTIVE' ? (
                  <span className="text-[10px] text-emerald-300/80 inline-flex items-center gap-1"><Power size={11} /> live</span>
                ) : (
                  <button
                    onClick={() => activate(r.id)}
                    disabled={busy[r.id]}
                    className="inline-flex items-center gap-1 bg-violet-500/20 border border-violet-500/30 hover:bg-violet-500/30 disabled:opacity-50 text-violet-200 text-[10px] font-semibold px-2 py-1 rounded-lg whitespace-nowrap"
                  >
                    {busy[r.id] ? <Loader2 size={11} className="animate-spin" /> : <Zap size={11} />} ACTIVEER
                  </button>
                )}
              </span>
            </div>

            {msg[r.id] && <div className="px-4 pb-2 text-[10px] text-white/60">{msg[r.id]}</div>}

            {isOpen && (
              <div className="px-4 pb-4 pt-1 grid gap-4 lg:grid-cols-[1fr_320px]">
                <div className="space-y-3">
                  <GoLiveForm
                    programId={r.id}
                    programName={r.name}
                    referralCode={r.referral_code}
                    affiliateLink={r.affiliate_link}
                    isActive={status === 'ACTIVE'}
                  />
                  {status === 'ACTIVE' && (
                    <button
                      onClick={() => linkContent(r.id)}
                      disabled={busy[`c_${r.id}`]}
                      className="inline-flex items-center gap-1.5 bg-emerald-500/15 border border-emerald-500/30 hover:bg-emerald-500/25 disabled:opacity-50 text-emerald-200 text-[11px] font-medium px-3 py-1.5 rounded-lg"
                    >
                      {busy[`c_${r.id}`] ? <Loader2 size={12} className="animate-spin" /> : <Link2 size={12} />}
                      Genereer content-links (top 10 video’s)
                    </button>
                  )}
                </div>

                {/* Live run/step status */}
                <div className="rounded-lg border border-white/8 bg-white/[0.02] p-3">
                  <p className="text-[9px] font-semibold text-white/40 uppercase tracking-wider mb-2">Agent-status</p>
                  {runs.length === 0 ? (
                    <p className="text-[11px] text-white/40">Nog geen runs. Klik ACTIVEER om de agents te starten.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {runs.map(run => (
                        <div key={run.id} className="text-[11px]">
                          <div className="flex items-center justify-between">
                            <span className="text-white/70">{run.run_kind}</span>
                            <span className={clsx(
                              run.status === 'completed' ? 'text-emerald-300'
                              : run.status === 'failed' ? 'text-red-300'
                              : run.status === 'cancelled' ? 'text-white/40'
                              : 'text-amber-300',
                            )}>{run.status}</span>
                          </div>
                          {steps.filter(s => s.run_id === run.id).slice(0, 4).map(s => (
                            <div key={s.id} className="ml-2 text-[10px] text-white/45">
                              · {s.step_kind} <span className="text-white/30">{s.status}</span>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
