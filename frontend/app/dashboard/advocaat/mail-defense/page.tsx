'use client'

import { useEffect, useState } from 'react'
import { Eye, AlertTriangle, CheckCircle, Clock, RefreshCw, Mail, Brain, ChevronRight } from 'lucide-react'
import type { MailDefenseItem } from '@/lib/advocaat/types'

const CLASS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  curator_bericht:    { label: 'Curator',           color: 'text-red-400',     bg: 'bg-red-500/8 border-red-500/25' },
  dagvaarding:        { label: 'Dagvaarding',       color: 'text-red-400',     bg: 'bg-red-500/8 border-red-500/25' },
  ingebrekestelling:  { label: 'Ingebrekestelling', color: 'text-orange-400',  bg: 'bg-orange-500/8 border-orange-500/25' },
  sommatiebrief:      { label: 'Sommatie',          color: 'text-orange-400',  bg: 'bg-orange-500/8 border-orange-500/25' },
  vonnis:             { label: 'Vonnis',            color: 'text-red-400',     bg: 'bg-red-500/8 border-red-500/25' },
  incasso:            { label: 'Incasso',           color: 'text-yellow-400',  bg: 'bg-yellow-500/8 border-yellow/[0.06]' },
  deadline_alert:     { label: 'Deadline',          color: 'text-orange-400',  bg: 'bg-orange-500/5 border-orange-500/15' },
  juridisch_neutraal: { label: 'Juridisch',         color: 'text-blue-400',    bg: 'bg-blue-500/5 border-blue-500/15' },
  neutraal:           { label: 'Neutraal',          color: 'text-white/40',    bg: 'bg-white/[0.03] border-white/[0.07]' },
}

const URGENCY_COLOR: Record<string, string> = {
  kritiek: 'text-red-400 bg-red-500/10 border-red-500/30',
  hoog:    'text-orange-400 bg-orange-500/10 border-orange-500/25',
  medium:  'text-yellow-400 bg-yellow-500/8 border-white/[0.06]',
  laag:    'text-white/40 bg-white/[0.04] border-white/[0.08]',
}

function fmt(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })
}

function daysUntil(d: string | null) {
  if (!d) return null
  return Math.ceil((new Date(d).getTime() - Date.now()) / 86400000)
}

export default function MailDefensePage() {
  const [items,    setItems]    = useState<MailDefenseItem[]>([])
  const [selected, setSelected] = useState<MailDefenseItem | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [filterUrgency, setFilterUrgency] = useState('')
  const [filterAction,  setFilterAction]  = useState(false)

  async function load() {
    setLoading(true)
    const params = new URLSearchParams({ limit: '100' })
    if (filterUrgency) params.set('urgency', filterUrgency)
    if (filterAction)  params.set('action_required', 'true')
    const res = await fetch(`/api/advocaat/mail-defense?${params}`).then(r => r.json()).catch(() => ({}))
    setItems(res.items ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [filterUrgency, filterAction])

  const stats = {
    total:   items.length,
    kritiek: items.filter(i => i.urgency === 'kritiek').length,
    action:  items.filter(i => i.action_required && !i.processed).length,
    curator: items.filter(i => i.classification === 'curator_bericht').length,
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white p-6 space-y-5">

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-orange-500/10 border border-orange-500/20">
            <Eye className="w-5 h-5 text-orange-400" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-white">Mail Defense Agent</h1>
            <p className="text-xs text-white/40 mt-0.5">Juridische mail-analyse · Deadline detectie · Nooit automatisch verzenden</p>
          </div>
        </div>
        <div className="flex gap-2">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-500/8 border border-red-500/20">
            <div className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
            <span className="text-[10px] text-red-400 font-medium">NEVER AUTO-SEND</span>
          </div>
          <button onClick={load} className="p-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] transition-all">
            <RefreshCw className={`w-4 h-4 text-white/40 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Gescand',     value: stats.total,   color: 'white' },
          { label: 'Kritiek',     value: stats.kritiek, color: 'red' },
          { label: 'Actie vereist', value: stats.action, color: 'orange' },
          { label: 'Curator mail', value: stats.curator, color: 'red' },
        ].map(s => (
          <div key={s.label} className="bg-white/[0.03] border border-white/[0.07] rounded-xl p-3">
            <div className={`text-xl font-bold text-${s.color}-400`}>{s.value}</div>
            <div className="text-[10px] text-white/40 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2">
        <select value={filterUrgency} onChange={e => setFilterUrgency(e.target.value)}
          className="px-3 py-2 rounded-lg bg-white/[0.05] border border-white/[0.08] text-sm text-white focus:outline-none focus:border-orange-500/40">
          <option value="">Alle urgentie</option>
          {['kritiek','hoog','medium','laag'].map(u => <option key={u} value={u}>{u}</option>)}
        </select>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={filterAction} onChange={e => setFilterAction(e.target.checked)} />
          <span className="text-xs text-white/60">Alleen actie vereist</span>
        </label>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Mail list */}
        <div className="bg-white/[0.03] border border-white/[0.07] rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-white/[0.06]">
            <span className="text-sm font-medium text-white">{items.length} gescande mails</span>
          </div>
          {loading ? (
            <div className="p-6 text-center text-white/30 text-sm">Laden...</div>
          ) : items.length === 0 ? (
            <div className="p-8 text-center text-white/20 text-sm">
              <Eye className="w-8 h-8 mx-auto mb-2 opacity-20" />
              Geen gescande mails. Koppel mailbox via Instellingen.
            </div>
          ) : (
            <div className="divide-y divide-white/[0.04] max-h-[600px] overflow-y-auto">
              {items.map(item => {
                const cc = CLASS_CONFIG[item.classification] ?? CLASS_CONFIG.neutraal
                const dl = daysUntil(item.deadline_detected)
                return (
                  <button key={item.id} onClick={() => setSelected(item)}
                    className={`w-full text-left px-4 py-3 hover:bg-white/[0.03] transition-all ${selected?.id === item.id ? 'bg-orange-500/5 border-l-2 border-orange-500' : ''}`}>
                    <div className="flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5 text-white/30 shrink-0" />
                      <span className="text-sm text-white truncate flex-1">{item.subject ?? '(Geen onderwerp)'}</span>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border shrink-0 ${URGENCY_COLOR[item.urgency]}`}>
                        {item.urgency.toUpperCase()}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`text-[10px] ${cc.color}`}>{cc.label}</span>
                      {item.from_name && <span className="text-[10px] text-white/30">{item.from_name}</span>}
                      <span className="text-[10px] text-white/20 ml-auto">{fmt(item.received_at)}</span>
                    </div>
                    {item.action_required && !item.processed && (
                      <div className="text-[9px] text-orange-400 mt-0.5">⚡ Actie vereist</div>
                    )}
                    {dl !== null && dl <= 14 && (
                      <div className={`text-[9px] mt-0.5 ${dl <= 3 ? 'text-red-400' : 'text-orange-400'}`}>
                        ⚠ Deadline over {dl} dag{dl !== 1 ? 'en' : ''}
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Detail panel */}
        <div className="lg:col-span-2">
          {!selected ? (
            <div className="h-full flex items-center justify-center bg-white/[0.02] border border-white/[0.06] rounded-xl text-white/20 text-sm min-h-48">
              Selecteer een mail om te analyseren
            </div>
          ) : (
            <div className="space-y-4">
              <div className={`p-4 rounded-xl border ${(CLASS_CONFIG[selected.classification] ?? CLASS_CONFIG.neutraal).bg}`}>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold text-white">{selected.subject ?? '(Geen onderwerp)'}</h3>
                    <div className="flex items-center gap-3 mt-1 text-xs text-white/40">
                      <span>{selected.from_name ?? selected.from_address}</span>
                      <span>{fmt(selected.received_at)}</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className={`text-[10px] font-bold px-2 py-1 rounded border ${URGENCY_COLOR[selected.urgency]}`}>
                      {selected.urgency.toUpperCase()}
                    </span>
                    <span className="text-[9px] text-white/30">Risico: {selected.risk_score}/100</span>
                  </div>
                </div>

                {selected.classification !== 'neutraal' && (
                  <div className="mt-3 p-2 rounded-lg bg-black/20">
                    <span className={`text-xs font-bold ${(CLASS_CONFIG[selected.classification] ?? CLASS_CONFIG.neutraal).color}`}>
                      ⚠ Classificatie: {(CLASS_CONFIG[selected.classification] ?? CLASS_CONFIG.neutraal).label}
                    </span>
                  </div>
                )}
              </div>

              {/* Deadline */}
              {selected.deadline_detected && (
                <div className={`flex items-center gap-3 p-3 rounded-xl border ${daysUntil(selected.deadline_detected)! <= 7 ? 'bg-red-500/8 border-red-500/25' : 'bg-orange-500/5 border-orange-500/15'}`}>
                  <Clock className={`w-4 h-4 ${daysUntil(selected.deadline_detected)! <= 7 ? 'text-red-400' : 'text-orange-400'}`} />
                  <div>
                    <div className="text-xs font-medium text-white">Deadline gedetecteerd: {fmt(selected.deadline_detected)}</div>
                    {selected.deadline_text && <div className="text-[10px] text-white/50 mt-0.5">&quot;{selected.deadline_text}&quot;</div>}
                    <div className={`text-xs font-bold mt-1 ${daysUntil(selected.deadline_detected)! <= 7 ? 'text-red-400' : 'text-orange-400'}`}>
                      Nog {daysUntil(selected.deadline_detected)} dag{daysUntil(selected.deadline_detected) !== 1 ? 'en' : ''}
                    </div>
                  </div>
                </div>
              )}

              {/* Action required */}
              {selected.action_required && (
                <div className="p-3 rounded-xl bg-orange-500/8 border border-orange-500/20">
                  <div className="flex items-center gap-2 mb-1">
                    <AlertTriangle className="w-3.5 h-3.5 text-orange-400" />
                    <span className="text-xs font-medium text-orange-300">Actie Vereist</span>
                  </div>
                  <p className="text-xs text-white/60">{selected.action_description ?? 'Zie AI analyse voor aanbevolen actie'}</p>
                </div>
              )}

              {/* AI Summary */}
              {selected.ai_summary && (
                <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.07]">
                  <div className="flex items-center gap-2 mb-2">
                    <Brain className="w-3.5 h-3.5 text-violet-400" />
                    <span className="text-xs font-medium text-white">AI Analyse</span>
                  </div>
                  <p className="text-xs text-white/60 leading-relaxed">{selected.ai_summary}</p>
                </div>
              )}

              {/* NEVER SEND warning */}
              <div className="flex items-center gap-2 p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] text-[10px] text-white/30">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                Dit systeem genereert alleen concepten. Nooit automatisch verzonden. Ga naar Strategie Engine voor concept-antwoord.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
