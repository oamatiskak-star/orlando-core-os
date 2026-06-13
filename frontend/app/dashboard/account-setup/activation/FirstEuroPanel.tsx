'use client'

import { useCallback, useEffect, useState } from 'react'
import { Euro, MousePointerClick, Users, ShoppingCart, Wallet, Trophy, Radio } from 'lucide-react'
import clsx from 'clsx'
import type { FirstEuroRow } from '@/lib/affiliate-programs/types'

const POLL_MS = 5000

type PerProgram = {
  program_id: string
  program_name: string
  account_status: string
  clicks: number
  conversions: number
  confirmed: number
  revenue_eur: number
  actual_epc: number
}

function eur(n: number | null | undefined) {
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(Number(n ?? 0))
}

const MILESTONES: { key: keyof FirstEuroRow; label: string }[] = [
  { key: 'has_first_click', label: 'Eerste click' },
  { key: 'has_first_lead', label: 'Eerste lead' },
  { key: 'has_first_sale', label: 'Eerste sale' },
  { key: 'has_first_commission', label: 'Eerste commissie' },
  { key: 'has_first_euro', label: 'Eerste euro' },
]

export default function FirstEuroPanel({ initialRollup }: { initialRollup: FirstEuroRow | null }) {
  const [rollup, setRollup] = useState<FirstEuroRow | null>(initialRollup)
  const [perProgram, setPerProgram] = useState<PerProgram[]>([])

  const load = useCallback(async () => {
    const res = await fetch('/api/account-setup/activation/first-euro')
    if (!res.ok) return
    const j = await res.json()
    setRollup(j.rollup ?? null)
    setPerProgram(j.perProgram ?? [])
  }, [])

  useEffect(() => {
    load()
    const t = setInterval(load, POLL_MS)
    return () => clearInterval(t)
  }, [load])

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Euro size={14} className="text-emerald-400" />
        <h2 className="text-sm font-semibold text-white">Eerste euro</h2>
        <span className="text-[10px] text-white/40">realtime</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        <Stat icon={<Radio size={11} />} label="Actief" value={String(rollup?.active_programs ?? 0)} color="text-white" />
        <Stat icon={<MousePointerClick size={11} />} label="Clicks" value={String(rollup?.clicks ?? 0)} color="text-white" />
        <Stat icon={<Users size={11} />} label="Leads" value={String(rollup?.leads ?? 0)} color="text-cyan-300" />
        <Stat icon={<ShoppingCart size={11} />} label="Sales" value={String(rollup?.sales ?? 0)} color="text-violet-300" />
        <Stat icon={<Wallet size={11} />} label="Commissie" value={eur(rollup?.commission_eur)} color="text-amber-300" />
        <Stat icon={<Euro size={11} />} label="Omzet" value={eur(rollup?.revenue_eur)} color="text-emerald-300" />
      </div>

      <div className="grid sm:grid-cols-2 gap-2">
        <div className="bg-white/[0.04] border border-white/8 rounded-xl p-3 flex items-center gap-2">
          <Trophy size={13} className="text-amber-300" />
          <div className="min-w-0">
            <p className="text-[9px] text-white/40 uppercase tracking-wider">Best kanaal</p>
            <p className="text-xs text-white/85 truncate">{rollup?.best_channel ?? '—'}</p>
          </div>
        </div>
        <div className="bg-white/[0.04] border border-white/8 rounded-xl p-3 flex items-center gap-2">
          <Trophy size={13} className="text-emerald-300" />
          <div className="min-w-0">
            <p className="text-[9px] text-white/40 uppercase tracking-wider">Best affiliate</p>
            <p className="text-xs text-white/85 truncate">{rollup?.best_affiliate ?? '—'}</p>
          </div>
        </div>
      </div>

      {/* Milestone-tijdlijn */}
      <div className="flex flex-wrap gap-1.5">
        {MILESTONES.map(m => {
          const done = Boolean(rollup?.[m.key])
          return (
            <span key={m.key} className={clsx(
              'inline-flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-lg border',
              done ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-200' : 'bg-white/[0.03] border-white/10 text-white/40',
            )}>
              <span className={done ? 'text-emerald-400' : 'text-white/30'}>{done ? '●' : '○'}</span>
              {m.label}
            </span>
          )
        })}
      </div>

      {/* Per-programma omzet */}
      {perProgram.some(p => p.clicks > 0 || p.revenue_eur > 0) && (
        <div className="bg-white/[0.04] border border-white/8 rounded-xl overflow-hidden">
          <div className="grid grid-cols-[1.4fr_0.6fr_0.6fr_0.7fr_0.8fr] gap-2 px-4 py-2 text-[9px] font-semibold text-white/40 uppercase tracking-wider border-b border-white/8">
            <span>Programma</span><span className="text-right">Clicks</span><span className="text-right">Conv.</span><span className="text-right">EPC</span><span className="text-right">Omzet</span>
          </div>
          {perProgram.filter(p => p.clicks > 0 || p.revenue_eur > 0).map(p => (
            <div key={p.program_id} className="grid grid-cols-[1.4fr_0.6fr_0.6fr_0.7fr_0.8fr] gap-2 px-4 py-2 text-xs border-b border-white/5 last:border-0">
              <span className="text-white/80 truncate">{p.program_name}</span>
              <span className="text-right tabular-nums text-white/65">{p.clicks}</span>
              <span className="text-right tabular-nums text-violet-300">{p.confirmed}</span>
              <span className="text-right tabular-nums text-amber-300">{eur(p.actual_epc)}</span>
              <span className="text-right tabular-nums text-emerald-300">{eur(p.revenue_eur)}</span>
            </div>
          ))}
        </div>
      )}
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
