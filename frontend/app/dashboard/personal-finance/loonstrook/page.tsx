'use client'

import { useState, useEffect, useCallback } from 'react'
import { ReceiptText, RefreshCw, Plus, Download, CheckCircle, Zap } from 'lucide-react'
import { berekenDgaLoonstrook, getPeriodeLabel } from '@/lib/bank/dga-loonstrook'

type Loonstrook = {
  id: string
  periode: string
  bruto: number
  loonheffing: number
  heffingskorting: number
  zvw_bijdrage: number
  netto: number
  vakantiegeld: number
  pensioen: number
  bonus: number
  status: string
  betaald_op: string | null
  berekenings_data: Record<string, number>
}

function fmt(n: number) {
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(n)
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    concept:   'bg-white/5 text-white/50',
    definitief:'bg-blue-500/10 text-blue-400',
    betaald:   'bg-green-500/10 text-green-400',
  }
  return <span className={`${map[status] ?? 'bg-white/5 text-white/50'} text-[10px] font-medium px-2 py-0.5 rounded-full capitalize`}>{status}</span>
}

export default function DgaLoonstrookPage() {
  const [stroken,    setStroken]    = useState<Loonstrook[]>([])
  const [loading,    setLoading]    = useState(true)
  const [generating, setGenerating] = useState(false)
  const [selected,   setSelected]   = useState<Loonstrook | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/personal-finance/loonstrook')
    if (res.ok) { const d = await res.json(); setStroken(d.loonstroken ?? []) }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function generateYear(year: number) {
    setGenerating(true)
    const periodes = Array.from({ length: 12 }, (_, i) =>
      `${year}-${String(i + 1).padStart(2, '0')}`
    )
    await fetch('/api/personal-finance/loonstrook', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ periodes, bruto: 5833 }),
    })
    setGenerating(false)
    await load()
  }

  async function generateSingle(periode: string) {
    setGenerating(true)
    await fetch('/api/personal-finance/loonstrook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ periode, bruto: 5833 }),
    })
    setGenerating(false)
    await load()
  }

  // Huidige maand als default
  const now = new Date()
  const currentPeriode = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const hasCurrentMonth = stroken.some(s => s.periode === currentPeriode)

  // Preview berekening voor huidige maand
  const preview = berekenDgaLoonstrook({ bruto: 5833, periode: currentPeriode })

  return (
    <div className="space-y-5 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-white">DGA Loonstroken</h1>
          <p className="text-xs text-white/50 mt-0.5">O.S.M. Amatiskak · Modiwerijo Financial Management BV · €5.833 bruto/maand</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => generateYear(2025)}
            disabled={generating}
            className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-medium px-3 py-2 rounded-lg"
          >
            {generating ? <RefreshCw size={11} className="animate-spin" /> : <Zap size={11} />}
            Genereer 2025
          </button>
          {!hasCurrentMonth && (
            <button
              onClick={() => generateSingle(currentPeriode)}
              disabled={generating}
              className="flex items-center gap-1.5 bg-white/5 hover:bg-white/10 text-white/70 text-xs px-3 py-2 rounded-lg"
            >
              <Plus size={11} /> Huidige maand
            </button>
          )}
        </div>
      </div>

      {/* Live preview berekening */}
      <div className="bg-white/[0.04] border border-white/5 rounded-xl p-5">
        <p className="text-[10px] text-white/40 uppercase tracking-wider mb-4">Berekening {getPeriodeLabel(currentPeriode)} — 2025 tabellen</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Bruto maand',      value: fmt(preview.bruto_maand),       color: 'text-white' },
            { label: 'Loonheffing',      value: fmt(preview.loonheffing),        color: 'text-red-400' },
            { label: 'Heffingskorting',  value: fmt(preview.heffingskorting_totaal), color: 'text-green-400' },
            { label: 'Netto uitbetaald', value: fmt(preview.netto_uitbetaald),   color: 'text-indigo-400' },
          ].map(item => (
            <div key={item.label}>
              <p className="text-[10px] text-white/40 mb-1">{item.label}</p>
              <p className={`text-base font-semibold ${item.color}`}>{item.value}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 pt-4 border-t border-white/5 grid grid-cols-3 gap-4 text-[10px] text-white/40">
          <div>Arbeidskorting: <span className="text-white/60">{fmt(preview.arbeidskorting)}</span></div>
          <div>Alg. heffkorting: <span className="text-white/60">{fmt(preview.algemene_heffkorting)}</span></div>
          <div>Zvw werkgever: <span className="text-white/60">{fmt(preview.zvw_werkgever)}</span></div>
          <div>Tarief schijf: <span className="text-white/60">{preview.tarief_box1_pct}%</span></div>
          <div>Jaarinkomen: <span className="text-white/60">{fmt(preview.jaarinkomen_est)}</span></div>
          <div>Zvw werknemer: <span className="text-white/60">€ 0,00 (werkgever)</span></div>
        </div>
      </div>

      {/* Loonstrokenlijst */}
      {loading ? (
        <div className="space-y-2">{[...Array(4)].map((_,i) => <div key={i} className="bg-white/[0.04] border border-white/5 rounded-xl p-4 h-14 animate-pulse" />)}</div>
      ) : stroken.length === 0 ? (
        <div className="flex flex-col items-center py-12 text-white/30 gap-2">
          <ReceiptText size={28} className="opacity-50" />
          <p className="text-xs">Geen loonstroken — klik op "Genereer 2025"</p>
        </div>
      ) : (
        <div className="bg-white/[0.04] border border-white/5 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
            <p className="text-xs font-medium text-white">{stroken.length} loonstroken</p>
            <p className="text-[10px] text-white/40">Netto totaal: {fmt(stroken.reduce((s, l) => s + l.netto, 0))}</p>
          </div>
          <div className="divide-y divide-white/5">
            {stroken.map(strook => (
              <button
                key={strook.id}
                onClick={() => setSelected(selected?.id === strook.id ? null : strook)}
                className="w-full flex items-center gap-4 px-4 py-3 hover:bg-white/[0.03] text-left transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-medium text-white">{getPeriodeLabel(strook.periode)}</p>
                    <StatusBadge status={strook.status} />
                  </div>
                  <p className="text-[10px] text-white/40 mt-0.5">Bruto: {fmt(strook.bruto)} · Loonheffing: {fmt(strook.loonheffing)}</p>
                </div>
                <p className="text-sm font-semibold text-indigo-400 flex-shrink-0">{fmt(strook.netto)}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Detail panel */}
      {selected && (
        <div className="bg-[#1e1e32] border border-white/10 rounded-xl p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-white">Loonstrook {getPeriodeLabel(selected.periode)}</h2>
              <p className="text-[10px] text-white/40 mt-0.5">Modiwerijo Financial Management BV · O.S.M. Amatiskak</p>
            </div>
            <StatusBadge status={selected.status} />
          </div>

          <div className="space-y-2">
            <p className="text-[10px] text-white/40 uppercase tracking-wider">Brutodeel</p>
            {[
              { label: 'Bruto maandsalaris', value: fmt(selected.bruto) },
              ...(selected.vakantiegeld > 0 ? [{ label: 'Vakantiegeld', value: fmt(selected.vakantiegeld) }] : []),
              ...(selected.bonus > 0 ? [{ label: 'Bonus / tantième', value: fmt(selected.bonus) }] : []),
            ].map(row => (
              <div key={row.label} className="flex justify-between">
                <span className="text-xs text-white/60">{row.label}</span>
                <span className="text-xs text-white">{row.value}</span>
              </div>
            ))}
          </div>

          <div className="space-y-2 pt-3 border-t border-white/5">
            <p className="text-[10px] text-white/40 uppercase tracking-wider">Inhoudingen</p>
            {[
              { label: 'Loonbelasting (36.97% / 49.50%)', value: `-${fmt(selected.loonheffing)}`, color: 'text-red-400' },
              { label: 'Arbeidskorting', value: `+${fmt(selected.berekenings_data?.arbeidskorting_jaar ? selected.berekenings_data.arbeidskorting_jaar / 12 : 0)}`, color: 'text-green-400' },
              { label: 'Algemene heffingskorting', value: `+${fmt(selected.berekenings_data?.alg_heffkorting_jaar ? selected.berekenings_data.alg_heffkorting_jaar / 12 : 0)}`, color: 'text-green-400' },
              { label: 'Zvw werknemer (DGA)', value: '€ 0,00', color: 'text-white/50' },
              ...(selected.pensioen > 0 ? [{ label: 'Pensioen eigen bijdrage', value: `-${fmt(selected.pensioen)}`, color: 'text-red-400' }] : []),
            ].map(row => (
              <div key={row.label} className="flex justify-between">
                <span className="text-xs text-white/60">{row.label}</span>
                <span className={`text-xs font-medium ${row.color}`}>{row.value}</span>
              </div>
            ))}
          </div>

          <div className="flex justify-between pt-3 border-t border-white/5">
            <span className="text-sm font-semibold text-white">Netto uitbetaald</span>
            <span className="text-sm font-semibold text-indigo-400">{fmt(selected.netto)}</span>
          </div>

          <div className="pt-2 border-t border-white/5 text-[10px] text-white/30">
            <p>Zvw bijdrage werkgever: {fmt(selected.zvw_bijdrage)}/maand (apart)</p>
            <p>Jaarinkomen: {fmt(selected.berekenings_data?.jaarbruto ?? 0)}</p>
            {selected.betaald_op && <p>Betaald op: {new Date(selected.betaald_op).toLocaleDateString('nl-NL')}</p>}
          </div>
        </div>
      )}
    </div>
  )
}
