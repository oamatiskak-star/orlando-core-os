'use client'

import { useState, useEffect, useCallback, useTransition, useRef } from 'react'
import { Search, X, MapPin, ExternalLink, ArrowRight, Zap, RefreshCw, SlidersHorizontal, TrendingUp, Euro, Building2, Target } from 'lucide-react'
import { promoteDeal } from './actions'
import clsx from 'clsx'

const PROVINCES = [
  'Noord-Holland',
  'Zuid-Holland',
  'Noord-Brabant',
  'Gelderland',
  'Utrecht',
  'Overijssel',
  'Flevoland',
  'Groningen',
  'Friesland',
  'Drenthe',
  'Zeeland',
  'Limburg',
]

type ScalperDeal = {
  id: string
  address: string | null
  city: string | null
  province: string | null
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

type ApiResponse = {
  deals: ScalperDeal[]
  counts: Counts
  provinceCounts: Record<string, number>
}

const CLASS_STYLES: Record<string, { border: string; bg: string; badge: string }> = {
  A: { border: 'border-emerald-500/30', bg: 'bg-emerald-500/5', badge: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
  B: { border: 'border-amber-500/30',   bg: 'bg-amber-500/5',   badge: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
  C: { border: 'border-white/10',       bg: 'bg-white/[0.02]',  badge: 'bg-white/5 text-white/65 border-white/10' },
}

function fmt(n: number | null) {
  if (n == null) return '—'
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)
}

function fmtShort(n: number | null) {
  if (n == null) return '—'
  if (n >= 1_000_000) return `€${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `€${Math.round(n / 1_000)}K`
  return fmt(n)
}

export default function VastgoedSearchSection({ initialCounts }: { initialCounts: Counts }) {
  const [classFilter, setClassFilter] = useState<'A' | 'B' | 'C' | 'all'>('A')
  const [province, setProvince]       = useState<string | null>(null)
  const [q, setQ]                     = useState('')
  const [debouncedQ, setDebouncedQ]   = useState('')

  const [deals, setDeals]               = useState<ScalperDeal[]>([])
  const [counts, setCounts]             = useState<Counts>(initialCounts)
  const [provinceCounts, setProvinceCounts] = useState<Record<string, number>>({})
  const [loading, setLoading]           = useState(true)
  const [promoted, setPromoted]         = useState<Set<string>>(new Set())
  const [isPending, startTransition]    = useTransition()

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Debounce search input
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => setDebouncedQ(q), 400)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [q])

  const load = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ limit: '60' })
    if (classFilter !== 'all') params.set('class', classFilter)
    if (province) params.set('province', province)
    if (debouncedQ) params.set('q', debouncedQ)

    const res = await fetch(`/api/vastgoed/scalper?${params}`)
    const data: ApiResponse = await res.json()
    setDeals(data.deals ?? [])
    setCounts(data.counts ?? counts)
    setProvinceCounts(data.provinceCounts ?? {})
    setLoading(false)
  }, [classFilter, province, debouncedQ]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load() }, [load])

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
    { key: 'all' as const, label: 'Alle', count: counts.total, color: 'text-white/50 border-white/10 bg-white/5' },
  ]

  const hasActiveFilter = province !== null || debouncedQ !== ''
  const totalDeals = Object.values(provinceCounts).reduce((a, b) => a + b, 0)

  return (
    <div className="space-y-4">

      {/* Search + Stats bar */}
      <div className="bg-white/[0.06] border border-white/5 rounded-xl p-5 space-y-4">

        {/* Top row: search + refresh */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/45 pointer-events-none" />
            <input
              type="text"
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Zoek op adres of stad..."
              className="w-full bg-white/[0.04] border border-white/8 rounded-lg pl-9 pr-9 py-2 text-sm text-white placeholder:text-white/45 focus:outline-none focus:border-white/20 transition-colors"
            />
            {q && (
              <button onClick={() => setQ('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/45 hover:text-white/60">
                <X size={12} />
              </button>
            )}
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="p-2 rounded-lg border border-white/10 text-white/50 hover:text-white hover:border-white/20 transition-all flex-shrink-0"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-4 gap-3">
          <div className="bg-white/[0.06] border border-white/5 rounded-lg p-3 text-center">
            <p className="text-xs font-bold text-white">{counts.total}</p>
            <p className="text-[10px] text-white/50 mt-0.5">Gevonden</p>
          </div>
          <div className="bg-emerald-500/5 border border-emerald-500/15 rounded-lg p-3 text-center">
            <p className="text-xs font-bold text-emerald-400">{counts.A}</p>
            <p className="text-[10px] text-white/50 mt-0.5">A-class</p>
          </div>
          <div className="bg-amber-500/5 border border-amber-500/15 rounded-lg p-3 text-center">
            <p className="text-xs font-bold text-amber-400">{counts.B}</p>
            <p className="text-[10px] text-white/50 mt-0.5">B-class</p>
          </div>
          <div className="bg-white/[0.02] border border-white/5 rounded-lg p-3 text-center">
            <p className="text-xs font-bold text-white/50">{counts.C}</p>
            <p className="text-[10px] text-white/50 mt-0.5">C-class</p>
          </div>
        </div>

        {/* Province filter */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <MapPin size={11} className="text-white/50" />
            <span className="text-[11px] text-white/50 font-medium uppercase tracking-wide">Provincie</span>
            {province && (
              <button
                onClick={() => setProvince(null)}
                className="flex items-center gap-1 ml-auto text-[10px] text-white/65 hover:text-white/70"
              >
                <X size={9} /> Wis filter
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {PROVINCES.map(p => {
              const count = provinceCounts[p] ?? 0
              const active = province === p
              return (
                <button
                  key={p}
                  onClick={() => setProvince(active ? null : p)}
                  className={clsx(
                    'flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-medium transition-all',
                    active
                      ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300'
                      : count > 0
                        ? 'border-white/8 text-white/50 hover:border-white/20 hover:text-white/70 bg-white/[0.02]'
                        : 'border-white/4 text-white/38 cursor-default'
                  )}
                  disabled={count === 0 && !active}
                >
                  {p}
                  {count > 0 && (
                    <span className={clsx('text-[10px]', active ? 'text-indigo-400' : 'text-white/45')}>
                      {count}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* Active filters summary */}
        {hasActiveFilter && (
          <div className="flex items-center gap-2 pt-1 border-t border-white/5">
            <SlidersHorizontal size={10} className="text-white/45" />
            <span className="text-[11px] text-white/50">Actieve filters:</span>
            {province && (
              <span className="px-2 py-0.5 bg-indigo-500/10 border border-indigo-500/20 rounded text-[10px] text-indigo-400 flex items-center gap-1">
                <MapPin size={8} /> {province}
              </span>
            )}
            {debouncedQ && (
              <span className="px-2 py-0.5 bg-white/5 border border-white/10 rounded text-[10px] text-white/50 flex items-center gap-1">
                <Search size={8} /> &ldquo;{debouncedQ}&rdquo;
              </span>
            )}
            <button
              onClick={() => { setQ(''); setProvince(null) }}
              className="ml-auto text-[10px] text-white/50 hover:text-white/60 flex items-center gap-1"
            >
              <X size={9} /> Alles wissen
            </button>
          </div>
        )}
      </div>

      {/* Scalper inbox */}
      <div className="bg-white/[0.06] border border-white/5 rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap size={14} className="text-amber-400" />
            <h2 className="text-sm font-semibold text-white">Scalper Inbox</h2>
            <span className="text-[11px] text-white/45">
              {province ? `${province} · ` : ''}{debouncedQ ? `"${debouncedQ}" · ` : ''}Live feed
            </span>
          </div>
        </div>

        {/* Class tabs */}
        <div className="flex items-center gap-2 flex-wrap">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setClassFilter(tab.key)}
              className={clsx(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all',
                classFilter === tab.key ? tab.color : 'text-white/50 border-white/5 bg-transparent hover:border-white/10'
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
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center">
              <Search size={16} className="text-white/38" />
            </div>
            <p className="text-sm text-white/45">Geen deals gevonden</p>
            {hasActiveFilter && (
              <button
                onClick={() => { setQ(''); setProvince(null) }}
                className="text-xs text-indigo-400 hover:text-indigo-300"
              >
                Filters wissen
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 max-h-[560px] overflow-y-auto pr-1">
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
                      {(deal.city || deal.province) && (
                        <div className="flex items-center gap-1 mt-0.5">
                          <MapPin size={9} className="text-white/45" />
                          <span className="text-[10px] text-white/58 truncate">
                            {deal.city}{deal.province ? ` · ${deal.province}` : ''}
                          </span>
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
                      <p className="text-[10px] font-bold text-white">{fmtShort(deal.asking_price)}</p>
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

                  {(deal.sqm || deal.price_per_sqm) && (
                    <p className="text-[10px] text-white/45">
                      {deal.sqm ? `${deal.sqm}m²` : ''}
                      {deal.price_per_sqm ? ` · ${fmtShort(deal.price_per_sqm)}/m²` : ''}
                      {deal.energy_label ? ` · Label ${deal.energy_label}` : ''}
                    </p>
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
    </div>
  )
}
