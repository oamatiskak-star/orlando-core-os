'use client'

import { useState, useEffect, useCallback } from 'react'
import { TrendingUp, Plus, Target, Building2, Code, PlaySquare, Banknote, Scale, ChevronDown, Sparkles } from 'lucide-react'

type Opportunity = {
  id: string
  source: string
  category: string
  title: string
  description: string | null
  potential_value: number | null
  probability_pct: number
  time_horizon: string
  status: string
  ai_score: number
  linked_company_id: string | null
  created_at: string
}

const STATUS_FLOW = ['radar', 'onderzoek', 'actief', 'gewonnen'] as const
type Status = typeof STATUS_FLOW[number]

const STATUS_LABELS: Record<Status, string> = {
  radar:     'Radar',
  onderzoek: 'Onderzoek',
  actief:    'Actief',
  gewonnen:  'Gewonnen',
}

const STATUS_COLORS: Record<Status, string> = {
  radar:     'border-white/10 bg-white/[0.03]',
  onderzoek: 'border-indigo-500/20 bg-indigo-500/[0.04]',
  actief:    'border-amber-500/20 bg-amber-500/[0.04]',
  gewonnen:  'border-emerald-500/20 bg-emerald-500/[0.04]',
}

const STATUS_BADGE: Record<Status, string> = {
  radar:     'text-white/45 bg-white/5',
  onderzoek: 'text-indigo-400 bg-indigo-500/10',
  actief:    'text-amber-400 bg-amber-500/10',
  gewonnen:  'text-emerald-400 bg-emerald-500/10',
}

const CAT_ICON: Record<string, React.ElementType> = {
  vastgoed:   Building2,
  saas:       Code,
  youtube:    PlaySquare,
  financieel: Banknote,
  legal:      Scale,
}

const CATEGORIES = ['vastgoed', 'saas', 'youtube', 'financieel', 'legal']
const HORIZONS = ['week', 'maand', 'kwartaal', 'jaar']

function fmt(n: number | null) {
  if (!n) return '—'
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)
}

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 80 ? 'text-emerald-400' : score >= 60 ? 'text-amber-400' : 'text-white/45'
  return <span className={`text-xs font-bold tabular-nums ${color}`}>{score}</span>
}

function OpportunityCard({ opp, onStatusChange }: { opp: Opportunity; onStatusChange: (id: string, status: string) => void }) {
  const [open, setOpen] = useState(false)
  const Icon = CAT_ICON[opp.category] ?? Target
  const currentIdx = STATUS_FLOW.indexOf(opp.status as Status)

  return (
    <div className="bg-white/[0.05] border border-white/5 rounded-xl overflow-hidden">
      <div className="flex items-center gap-3 p-3 cursor-pointer hover:bg-white/[0.02] transition-colors" onClick={() => setOpen(!open)}>
        <div className="w-7 h-7 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center flex-shrink-0">
          <Icon size={12} className="text-indigo-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-xs font-medium text-white truncate">{opp.title}</p>
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${STATUS_BADGE[opp.status as Status] ?? 'text-white/45 bg-white/5'}`}>
              {STATUS_LABELS[opp.status as Status] ?? opp.status}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-0.5">
            <span className="text-[10px] text-white/38 capitalize">{opp.category}</span>
            <span className="text-[10px] text-white/38">{fmt(opp.potential_value)}</span>
            <span className="text-[10px] text-white/38">{opp.probability_pct}%</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ScoreBadge score={opp.ai_score} />
          <ChevronDown size={12} className={`text-white/30 transition-transform ${open ? 'rotate-180' : ''}`} />
        </div>
      </div>

      {open && (
        <div className="border-t border-white/5 p-3 space-y-3">
          {opp.description && (
            <p className="text-xs text-white/55 leading-relaxed">{opp.description}</p>
          )}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Waarde', value: fmt(opp.potential_value) },
              { label: 'Kans', value: `${opp.probability_pct}%` },
              { label: 'Horizon', value: opp.time_horizon },
            ].map(k => (
              <div key={k.label} className="bg-white/[0.03] rounded-lg p-2 text-center">
                <p className="text-[9px] text-white/38">{k.label}</p>
                <p className="text-xs font-medium text-white/70 mt-0.5">{k.value}</p>
              </div>
            ))}
          </div>
          {opp.status !== 'gewonnen' && (
            <div className="flex gap-1.5 flex-wrap">
              {STATUS_FLOW.slice(currentIdx + 1).map(next => (
                <button
                  key={next}
                  onClick={() => onStatusChange(opp.id, next)}
                  className="px-2 py-1 rounded-lg text-[10px] font-medium bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 hover:bg-indigo-500/20 transition-colors"
                >
                  → {STATUS_LABELS[next]}
                </button>
              ))}
              <button
                onClick={() => onStatusChange(opp.id, 'afgewezen')}
                className="px-2 py-1 rounded-lg text-[10px] font-medium bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-colors ml-auto"
              >
                Afwijzen
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function KansenPage() {
  const [opps, setOpps] = useState<Opportunity[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterCat, setFilterCat] = useState<string>('all')
  const [showNew, setShowNew] = useState(false)

  // New form state
  const [form, setForm] = useState({
    title: '', category: 'vastgoed', description: '',
    potential_value: '', probability_pct: '50', time_horizon: 'kwartaal',
  })
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filterStatus !== 'all') params.set('status', filterStatus)
      const res = await fetch(`/api/osil/opportunities?${params}`, { cache: 'no-store' })
      if (res.ok) {
        const d = await res.json()
        setOpps(d.opportunities ?? [])
      }
    } finally {
      setLoading(false)
    }
  }, [filterStatus])

  useEffect(() => { load() }, [load])

  async function handleStatusChange(id: string, status: string) {
    await fetch('/api/osil/opportunities', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    })
    load()
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      await fetch('/api/osil/opportunities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          potential_value: form.potential_value ? Number(form.potential_value) : null,
          probability_pct: Number(form.probability_pct),
          ai_score: Math.round(Number(form.probability_pct) * 0.8),
        }),
      })
      setShowNew(false)
      setForm({ title: '', category: 'vastgoed', description: '', potential_value: '', probability_pct: '50', time_horizon: 'kwartaal' })
      load()
    } finally {
      setSaving(false)
    }
  }

  const displayed = opps.filter(o =>
    (filterCat === 'all' || o.category === filterCat)
  )

  const grouped = STATUS_FLOW.reduce<Record<string, Opportunity[]>>((acc, s) => {
    acc[s] = displayed.filter(o => o.status === s)
    return acc
  }, {} as Record<string, Opportunity[]>)

  const totalPipeline = opps.reduce((s, o) => s + (o.potential_value ?? 0) * (o.probability_pct / 100), 0)

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-white">Kansen Radar</h1>
          <p className="text-xs text-white/50 mt-0.5">Opportunity Intelligence — gewogen pipeline</p>
        </div>
        <button
          onClick={() => setShowNew(!showNew)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-500/15 border border-indigo-500/25 text-indigo-300 text-xs font-medium hover:bg-indigo-500/25 transition-colors"
        >
          <Plus size={12} />
          Nieuwe Kans
        </button>
      </div>

      {/* Pipeline KPI */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white/[0.05] border border-white/5 rounded-xl p-3 text-center">
          <p className="text-[10px] text-white/38">Gewogen Pipeline</p>
          <p className="text-base font-bold text-indigo-400 mt-0.5">
            {new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(totalPipeline)}
          </p>
        </div>
        <div className="bg-white/[0.05] border border-white/5 rounded-xl p-3 text-center">
          <p className="text-[10px] text-white/38">Actief</p>
          <p className="text-base font-bold text-amber-400 mt-0.5">{opps.filter(o => o.status === 'actief').length}</p>
        </div>
        <div className="bg-white/[0.05] border border-white/5 rounded-xl p-3 text-center">
          <p className="text-[10px] text-white/38">Gewonnen</p>
          <p className="text-base font-bold text-emerald-400 mt-0.5">{opps.filter(o => o.status === 'gewonnen').length}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {['all', ...CATEGORIES].map(c => (
          <button
            key={c}
            onClick={() => setFilterCat(c)}
            className={`px-2.5 py-1 rounded-lg text-[10px] font-medium transition-colors capitalize ${
              filterCat === c
                ? 'bg-indigo-500/20 border border-indigo-500/30 text-indigo-300'
                : 'bg-white/5 border border-white/10 text-white/45 hover:text-white/70'
            }`}
          >
            {c === 'all' ? 'Alle' : c}
          </button>
        ))}
        <div className="ml-auto flex gap-2">
          <button
            onClick={() => setFilterStatus('all')}
            className={`px-2.5 py-1 rounded-lg text-[10px] font-medium transition-colors ${filterStatus === 'all' ? 'bg-white/10 text-white/70' : 'text-white/35 hover:text-white/55'}`}
          >
            Alle statussen
          </button>
          {STATUS_FLOW.map(s => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-medium transition-colors ${filterStatus === s ? 'bg-white/10 text-white/70' : 'text-white/35 hover:text-white/55'}`}
            >
              {STATUS_LABELS[s]}
            </button>
          ))}
        </div>
      </div>

      {/* New form */}
      {showNew && (
        <form onSubmit={handleCreate} className="bg-white/[0.05] border border-indigo-500/20 rounded-xl p-4 space-y-3">
          <p className="text-xs font-semibold text-white/70">Nieuwe Kans Toevoegen</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <input
                required
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="Titel van de kans..."
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-indigo-500/40"
              />
            </div>
            <select
              value={form.category}
              onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white/70 focus:outline-none"
            >
              {CATEGORIES.map(c => <option key={c} value={c} className="bg-zinc-900">{c}</option>)}
            </select>
            <select
              value={form.time_horizon}
              onChange={e => setForm(f => ({ ...f, time_horizon: e.target.value }))}
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white/70 focus:outline-none"
            >
              {HORIZONS.map(h => <option key={h} value={h} className="bg-zinc-900">{h}</option>)}
            </select>
            <input
              value={form.potential_value}
              onChange={e => setForm(f => ({ ...f, potential_value: e.target.value }))}
              placeholder="Potentiële waarde (€)"
              type="number"
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder:text-white/30 focus:outline-none"
            />
            <div className="flex items-center gap-2">
              <input
                value={form.probability_pct}
                onChange={e => setForm(f => ({ ...f, probability_pct: e.target.value }))}
                type="range" min="0" max="100" step="5"
                className="flex-1 accent-indigo-500"
              />
              <span className="text-xs text-white/55 w-8 text-right">{form.probability_pct}%</span>
            </div>
            <div className="col-span-2">
              <textarea
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Beschrijving (optioneel)..."
                rows={2}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder:text-white/30 focus:outline-none resize-none"
              />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setShowNew(false)} className="px-3 py-1.5 rounded-lg text-xs text-white/45 hover:text-white/70 transition-colors">
              Annuleer
            </button>
            <button type="submit" disabled={saving} className="px-4 py-1.5 rounded-lg bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 text-xs font-medium hover:bg-indigo-500/30 transition-colors disabled:opacity-50">
              {saving ? 'Opslaan...' : 'Toevoegen'}
            </button>
          </div>
        </form>
      )}

      {/* Kanban columns */}
      {loading ? (
        <div className="py-16 text-center text-xs text-white/40">Laden...</div>
      ) : (
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          {STATUS_FLOW.map(status => (
            <div key={status} className={`rounded-xl border p-3 space-y-2 ${STATUS_COLORS[status]}`}>
              <div className="flex items-center justify-between mb-1">
                <p className="text-[10px] font-semibold text-white/50 uppercase tracking-wider">{STATUS_LABELS[status]}</p>
                <span className="text-[10px] text-white/35">{grouped[status].length}</span>
              </div>
              {grouped[status].length === 0 ? (
                <div className="py-6 text-center">
                  <Sparkles size={16} className="text-white/10 mx-auto mb-1" />
                  <p className="text-[10px] text-white/25">Leeg</p>
                </div>
              ) : (
                grouped[status].map(o => (
                  <OpportunityCard key={o.id} opp={o} onStatusChange={handleStatusChange} />
                ))
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
