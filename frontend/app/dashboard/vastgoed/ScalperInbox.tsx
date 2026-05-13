'use client'

import { useState, useEffect, useTransition } from 'react'
import { ExternalLink, ArrowRight, MapPin, TrendingUp, Euro, Zap, RefreshCw } from 'lucide-react'
import { promoteDeal } from './actions'
import clsx from 'clsx'

type ScalperDeal = {
  id: string
  address: string | null
  city: string | null
  asking_price: number | null
  sqm: number | null
  price_per_sqm: number | null
  potential_profit: number | null
  roi_percentage: number | null
  deal_score: number | null
  class: string | null
  source: string | null
  energy_label: string | null
  funda_url: string | null
  created_at: string
}

type Counts = { A: number; B: number; C: number; total: number }

const CLASS_STYLES: Record<string, { border: string; bg: string; text: string; badge: string }> = {
  A: { border: 'border-emerald-500/30', bg: 'bg-emerald-500/5', text: 'text-emerald-400', badge: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
  B: { border: 'border-amber-500/30',   bg: 'bg-amber-500/5',   text: 'text-amber-400',   badge: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
  C: { border: 'border-white/10',       bg: 'bg-white/[0.02]',  text: 'text-white/50',    badge: 'bg-white/5 text-white/65 border-white/10' },
}

function fmt(n: number | null) {
  if (n == null) return '—'
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)
}

export default function ScalperInbox({ initialCounts }: { initialCounts: Counts }) {
  const [filter, setFilter] = useState<'A' | 'B' | 'C' | 'all'>('A')
  const [deals, setDeals] = useState<ScalperDeal[]>([])
  const [counts, setCounts] = useState<Counts>(initialCounts)
  const [loading, setLoading] = useState(true)
  const [promoted, setPromoted] = useState<Set<string>>(new Set())
  const [isPending, startTransition] = useTransition()

  async function load(cls: 'A' | 'B' | 'C' | 'all') {
    setLoading(true)
    const url = cls === 'all'
      ? '/api/vastgoed/scalper?limit=50'
      : `/api/vastgoed/scalper?class=${cls}&limit=50`
    const res = await fetch(url)
    const data = await res.json()
    setDeals(data.deals ?? [])
    setCounts(data.counts ?? counts)
    setLoading(false)
  }

  useEffect(() => { load(filter) }, [filter]) // eslint-disable-line react-hooks/exhaustive-deps

  function handlePromote(id: string) {
    startTransition(async () => {
      await promoteDeal(id)
      setPromoted(prev => new Set([...prev, id]))
    })
  }

  const TABS = [
    { key: 'A' as const, label: 'A-deals', count: counts.A, color: 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10' },
    { key: 'B' as const, label: 'B-deals', count: counts.B, color: 'text-amber-400 border-amber-500/40 bg-amber-500/10' },
    { key: 'C' as const, label: 'C-deals', count: counts.C, color: 'text-white/50 border-white/10 bg-white/5' },
    { key: 'all' as const, label: 'Alle',   count: counts.total, color: 'text-white/50 border-white/10 bg-white/5' },
  ]

  return (
    <div className="bg-white/[0.06] border border-white/5 rounded-xl p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap size={14} className="text-amber-400" />
          <h2 className="text-sm font-semibold text-white">Scalper Inbox</h2>
          <span className="text-[11px] text-white/45">Live feed van vastgoedscalper</span>
        </div>
        <button
          onClick={() => load(filter)}
          disabled={loading}
          className="p-1.5 rounded-lg border border-white/10 text-white/50 hover:text-white hover:border-white/20 transition-all"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={clsx(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all',
              filter === tab.key ? tab.color : 'text-white/50 border-white/5 bg-transparent hover:border-white/10'
            )}
          >
            {tab.label}
            <span className="text-[10px] opacity-70">{tab.count}</span>
          </button>
        ))}
      </div>

      {/* Deals grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {[1,2,3,4,5,6].map(i => (
            <div key={i} className="bg-white/[0.02] border border-white/5 rounded-xl p-4 h-40 animate-pulse" />
          ))}
        </div>
      ) : deals.length === 0 ? (
        <p className="text-sm text-white/45 text-center py-10">Geen deals gevonden</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 max-h-[520px] overflow-y-auto pr-1">
          {deals.map(deal => {
            const cls = deal.class ?? 'C'
            const style = CLASS_STYLES[cls] ?? CLASS_STYLES.C
            const isPromoted = promoted.has(deal.id)

            return (
              <div
                key={deal.id}
                className={clsx('border rounded-xl p-4 space-y-3 transition-all', style.border, style.bg, isPromoted && 'opacity-40')}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-white truncate">
                      {deal.address ?? 'Onbekend adres'}
                    </p>
                    {deal.city && (
                      <div className="flex items-center gap-1 mt-0.5">
                        <MapPin size={9} className="text-white/45" />
                        <span className="text-[10px] text-white/58">{deal.city}</span>
                      </div>
                    )}
                  </div>
                  <span className={clsx('px-1.5 py-0.5 rounded-full text-[10px] font-bold border flex-shrink-0', style.badge)}>
                    {cls}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-1.5 text-center">
                  <div className="bg-white/[0.06] rounded-lg py-1.5">
                    <p className="text-[9px] text-white/45">Vraagprijs</p>
                    <p className="text-[10px] font-bold text-white">{fmt(deal.asking_price)}</p>
                  </div>
                  <div className="bg-white/[0.06] rounded-lg py-1.5">
                    <p className="text-[9px] text-white/45">ROI</p>
                    <p className={clsx('text-[10px] font-bold', (deal.roi_percentage ?? 0) > 0 ? 'text-emerald-400' : 'text-red-400')}>
                      {deal.roi_percentage != null ? `${Number(deal.roi_percentage).toFixed(1)}%` : '—'}
                    </p>
                  </div>
                  <div className="bg-white/[0.06] rounded-lg py-1.5">
                    <p className="text-[9px] text-white/45">Score</p>
                    <p className="text-[10px] font-bold text-indigo-400">{deal.deal_score ?? '—'}/10</p>
                  </div>
                </div>

                {deal.sqm && (
                  <p className="text-[10px] text-white/45">{deal.sqm}m² · {deal.energy_label ? `Label ${deal.energy_label}` : deal.source}</p>
                )}

                <div className="flex items-center gap-1.5 pt-1 border-t border-white/5">
                  <button
                    onClick={() => handlePromote(deal.id)}
                    disabled={isPromoted || isPending}
                    className={clsx(
                      'flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all',
                      isPromoted
                        ? 'bg-white/5 text-white/45 cursor-default'
                        : 'bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/30'
                    )}
                  >
                    <ArrowRight size={10} />
                    {isPromoted ? 'In pipeline' : '→ Pipeline'}
                  </button>
                  {deal.funda_url && (
                    <a
                      href={deal.funda_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-7 h-7 rounded-lg border border-white/10 flex items-center justify-center text-white/45 hover:text-white hover:border-white/20 transition-colors flex-shrink-0"
                    >
                      <ExternalLink size={10} />
                    </a>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
