'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ExternalLink, Trash2, MoveRight, MapPin, TrendingUp, FileBarChart } from 'lucide-react'
import { updateDealFase, deleteDeal } from './actions'
import type { VastgoedDeal } from '@/lib/supabase/queries'

const FASES = ['analyse', 'due_diligence', 'bod', 'gewonnen', 'verloren']
const FASE_LABELS: Record<string, string> = {
  analyse:      'Analyse',
  due_diligence:'Due Diligence',
  bod:          'Bod',
  gewonnen:     'Gewonnen',
  verloren:     'Verloren',
}

const SCORE_COLORS: Record<string, string> = {
  A: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  B: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  C: 'bg-red-500/15 text-red-400 border-red-500/30',
}

function fmt(n: number | null) {
  if (n == null) return '—'
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)
}

export default function DealCard({ deal }: { deal: VastgoedDeal }) {
  const router = useRouter()
  const [moving, setMoving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const currentFase = deal.pipeline_fase ?? 'analyse'
  const nextFase = FASES[FASES.indexOf(currentFase) + 1]
  const label = deal.title ?? deal.address ?? `${deal.city ?? 'Deal'}`

  async function handleMove() {
    if (!nextFase) return
    setMoving(true)
    await updateDealFase(deal.id, nextFase)
    setMoving(false)
  }

  async function handleDelete() {
    if (!confirm(`Deal "${label}" verwijderen?`)) return
    setDeleting(true)
    await deleteDeal(deal.id)
    setDeleting(false)
  }

  return (
    <div className="bg-white/[0.06] border border-white/8 rounded-xl p-4 space-y-3 hover:border-white/15 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white leading-tight truncate">{label}</p>
          {deal.city && (
            <div className="flex items-center gap-1 mt-1">
              <MapPin size={10} className="text-white/45 flex-shrink-0" />
              <span className="text-[11px] text-white/58 truncate">{deal.city}</span>
            </div>
          )}
        </div>
        {deal.class && (
          <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold border flex-shrink-0 ${SCORE_COLORS[deal.class] ?? 'bg-white/5 text-white/50'}`}>
            {deal.class}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        {deal.asking_price != null && (
          <div className="bg-white/[0.06] rounded-lg px-2.5 py-2">
            <p className="text-[9px] text-white/50 uppercase tracking-wide mb-0.5">Vraagprijs</p>
            <p className="text-xs font-semibold text-white">{fmt(deal.asking_price)}</p>
          </div>
        )}
        {deal.potential_profit != null && deal.potential_profit > 0 && (
          <div className="bg-white/[0.06] rounded-lg px-2.5 py-2">
            <p className="text-[9px] text-white/50 uppercase tracking-wide mb-0.5">Potentieel</p>
            <p className="text-xs font-semibold text-emerald-400">+{fmt(deal.potential_profit)}</p>
          </div>
        )}
        {deal.roi_percentage != null && (
          <div className="bg-white/[0.06] rounded-lg px-2.5 py-2">
            <p className="text-[9px] text-white/50 uppercase tracking-wide mb-0.5">ROI</p>
            <div className="flex items-center gap-1">
              <TrendingUp size={10} className="text-indigo-400" />
              <p className="text-xs font-semibold text-indigo-400">{Number(deal.roi_percentage).toFixed(1)}%</p>
            </div>
          </div>
        )}
        {deal.sqm != null && (
          <div className="bg-white/[0.06] rounded-lg px-2.5 py-2">
            <p className="text-[9px] text-white/50 uppercase tracking-wide mb-0.5">Oppervlak</p>
            <p className="text-xs font-semibold text-white">{deal.sqm}m²</p>
          </div>
        )}
      </div>

      <div className="flex items-center gap-1 flex-wrap">
        {deal.source && <span className="px-2 py-0.5 bg-white/5 rounded text-[10px] text-white/58">{deal.source}</span>}
        {deal.energy_label && <span className="px-2 py-0.5 bg-white/5 rounded text-[10px] text-white/58">Label {deal.energy_label}</span>}
      </div>

      <div className="flex items-center gap-2 pt-1 border-t border-white/5">
        {nextFase && nextFase !== 'verloren' && (
          <button
            onClick={handleMove}
            disabled={moving}
            className="flex items-center gap-1.5 text-[11px] text-indigo-400 hover:text-indigo-300 transition-colors disabled:opacity-50"
          >
            <MoveRight size={11} />
            {moving ? '...' : FASE_LABELS[nextFase]}
          </button>
        )}
        <button
          onClick={() => router.push(`/dashboard/vastgoed/rapport/${deal.id}`)}
          className="flex items-center gap-1 text-[11px] font-semibold text-amber-400 hover:text-amber-300 transition-colors"
        >
          <FileBarChart size={11} />
          View Rapport
        </button>
        <div className="ml-auto flex items-center gap-2">
          {deal.funda_url && (
            <a href={deal.funda_url} target="_blank" rel="noopener noreferrer"
              className="w-7 h-7 rounded-lg border border-white/10 flex items-center justify-center text-white/50 hover:text-white/60 transition-colors">
              <ExternalLink size={11} />
            </a>
          )}
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="w-7 h-7 rounded-lg border border-white/10 flex items-center justify-center text-white/50 hover:text-red-400 hover:border-red-500/30 transition-colors disabled:opacity-50"
          >
            <Trash2 size={11} />
          </button>
        </div>
      </div>
    </div>
  )
}
