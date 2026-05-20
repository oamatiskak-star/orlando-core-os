'use client'

import { useEffect, useState, useCallback } from 'react'
import { Radar, Plus, Building2, TrendingUp, Home, Warehouse, Briefcase } from 'lucide-react'
import type { AcqDeal } from '@/lib/supabase/acquisition'

const PIPELINE_STAGES = [
  { key: 'radar', label: 'Radar', color: 'border-sky-500/40 text-sky-400' },
  { key: 'analyse', label: 'Analyse', color: 'border-amber-500/40 text-amber-400' },
  { key: 'due_diligence', label: 'Due Diligence', color: 'border-violet-500/40 text-violet-400' },
  { key: 'bod', label: 'Bod uitgebracht', color: 'border-orange-500/40 text-orange-400' },
  { key: 'gewonnen', label: 'Gewonnen', color: 'border-emerald-500/40 text-emerald-400' },
]

const OBJECT_ICONS: Record<string, React.ComponentType<{size?: number; className?: string}>> = {
  woning: Home,
  appartement: Home,
  loods: Warehouse,
  kantoor: Briefcase,
  bedrijfspand: Briefcase,
}

function fmt(n: number | null) {
  if (!n) return '—'
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)
}

function DealCard({ deal }: { deal: AcqDeal }) {
  const Icon = OBJECT_ICONS[deal.object_type ?? ''] ?? Building2
  return (
    <a href={`/dashboard/acquisition/deals/${deal.id}`}
      className="block bg-white/[0.03] border border-white/[0.06] rounded-xl p-3 hover:border-white/10 hover:bg-white/[0.05] transition-all group">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <Icon size={11} className="text-white/40 shrink-0 mt-0.5" />
          <p className="text-xs font-medium text-white/90 truncate group-hover:text-white transition-colors">{deal.title}</p>
        </div>
        {deal.ai_score !== null && (
          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0 ${
            deal.ai_score >= 70 ? 'bg-emerald-500/15 text-emerald-400' :
            deal.ai_score >= 40 ? 'bg-amber-500/15 text-amber-400' :
            'bg-red-500/15 text-red-400'
          }`}>{deal.ai_score}</span>
        )}
      </div>
      <p className="text-[11px] text-white/40 mb-2">{deal.city ?? '—'}{deal.province ? `, ${deal.province}` : ''}</p>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] text-white/60">{fmt(deal.asking_price)}</span>
        <div className="flex items-center gap-1.5">
          {deal.roi_pct && (
            <span className="flex items-center gap-0.5 text-[10px] text-emerald-400/80">
              <TrendingUp size={9} />
              {deal.roi_pct.toFixed(1)}%
            </span>
          )}
          {deal.energy_label && (
            <span className={`px-1 py-0.5 rounded text-[9px] font-bold ${
              ['A','A+','A++'].includes(deal.energy_label) ? 'bg-emerald-500/15 text-emerald-400' :
              ['B','C'].includes(deal.energy_label) ? 'bg-amber-500/15 text-amber-400' :
              'bg-red-500/15 text-red-400'
            }`}>{deal.energy_label}</span>
          )}
        </div>
      </div>
    </a>
  )
}

function NewDealModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ title: '', address: '', city: '', province: '', object_type: 'woning', asking_price: '', roi_pct: '', notes: '' })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    await fetch('/api/acquisition/deals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        asking_price: form.asking_price ? parseFloat(form.asking_price) : null,
        roi_pct: form.roi_pct ? parseFloat(form.roi_pct) : null,
      }),
    })
    setLoading(false)
    onCreated()
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#181830] border border-white/10 rounded-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
          <h2 className="text-sm font-semibold text-white">Nieuwe Deal toevoegen</h2>
          <button onClick={onClose} className="text-white/40 hover:text-white/70 text-lg leading-none">×</button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-3">
          <input required placeholder="Titel" value={form.title} onChange={e => setForm(p => ({...p, title: e.target.value}))}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-indigo-500/50" />
          <div className="grid grid-cols-2 gap-2">
            <input placeholder="Adres" value={form.address} onChange={e => setForm(p => ({...p, address: e.target.value}))}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-indigo-500/50" />
            <input placeholder="Stad" value={form.city} onChange={e => setForm(p => ({...p, city: e.target.value}))}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-indigo-500/50" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input placeholder="Provincie" value={form.province} onChange={e => setForm(p => ({...p, province: e.target.value}))}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-indigo-500/50" />
            <select value={form.object_type} onChange={e => setForm(p => ({...p, object_type: e.target.value}))}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/50">
              {['woning','appartement','kantoor','loods','winkel','horeca','industrie','grond'].map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input type="number" placeholder="Vraagprijs (€)" value={form.asking_price} onChange={e => setForm(p => ({...p, asking_price: e.target.value}))}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-indigo-500/50" />
            <input type="number" placeholder="ROI (%)" step="0.1" value={form.roi_pct} onChange={e => setForm(p => ({...p, roi_pct: e.target.value}))}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-indigo-500/50" />
          </div>
          <textarea placeholder="Notities" value={form.notes} onChange={e => setForm(p => ({...p, notes: e.target.value}))} rows={2}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-indigo-500/50 resize-none" />
          <button type="submit" disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-lg py-2 text-sm font-medium text-white transition-colors">
            {loading ? 'Opslaan…' : 'Deal toevoegen'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default function DealsPage() {
  const [deals, setDeals] = useState<AcqDeal[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [province, setProvince] = useState('')
  const [objectType, setObjectType] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (province) params.set('province', province)
    if (objectType) params.set('object_type', objectType)
    const res = await fetch(`/api/acquisition/deals?${params}`)
    const json = await res.json()
    setDeals(json.data ?? [])
    setLoading(false)
  }, [province, objectType])

  useEffect(() => { load() }, [load])

  const verloren = deals.filter(d => d.pipeline_stage === 'verloren')
  const active = deals.filter(d => d.pipeline_stage !== 'verloren')

  return (
    <div className="space-y-5">
      {showModal && <NewDealModal onClose={() => setShowModal(false)} onCreated={load} />}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
            <Radar size={16} className="text-indigo-400" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-white">DealRadar</h1>
            <p className="text-xs text-white/50">AI-gedreven dealflow pipeline — {deals.length} actieve deals</p>
          </div>
        </div>
        <button onClick={() => setShowModal(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-xs font-medium text-white transition-colors">
          <Plus size={13} />
          Nieuwe Deal
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <select value={province} onChange={e => setProvince(e.target.value)}
          className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white/70 focus:outline-none focus:border-indigo-500/50">
          <option value="">Alle provincies</option>
          {['Noord-Holland','Zuid-Holland','Noord-Brabant','Gelderland','Utrecht','Overijssel','Friesland','Groningen','Drenthe','Flevoland','Zeeland','Limburg'].map(p => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
        <select value={objectType} onChange={e => setObjectType(e.target.value)}
          className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white/70 focus:outline-none focus:border-indigo-500/50">
          <option value="">Alle types</option>
          {['woning','appartement','kantoor','loods','winkel','horeca','industrie','grond'].map(t => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="text-center py-12 text-xs text-white/30">Laden…</div>
      ) : (
        <>
          {/* Pipeline kanban */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
            {PIPELINE_STAGES.map(stage => {
              const stageDeals = active.filter(d => d.pipeline_stage === stage.key)
              const [borderClass, textClass] = stage.color.split(' ')
              return (
                <div key={stage.key} className={`bg-white/[0.02] border-t-2 border-x border-b border-white/5 rounded-xl ${borderClass}`}>
                  <div className="flex items-center justify-between px-3 py-2.5 border-b border-white/5">
                    <h2 className={`text-xs font-semibold ${textClass}`}>{stage.label}</h2>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-white/5 text-white/50">{stageDeals.length}</span>
                  </div>
                  <div className="p-2.5 space-y-2 min-h-[160px]">
                    {stageDeals.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-10 gap-2">
                        <Building2 size={13} className="text-white/20" />
                        <p className="text-[10px] text-white/20">Geen deals</p>
                      </div>
                    ) : stageDeals.map(deal => <DealCard key={deal.id} deal={deal} />)}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Verloren deals */}
          {verloren.length > 0 && (
            <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
              <h2 className="text-xs font-semibold text-white/40 mb-3">Verloren — {verloren.length}</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2">
                {verloren.map(deal => <DealCard key={deal.id} deal={deal} />)}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
