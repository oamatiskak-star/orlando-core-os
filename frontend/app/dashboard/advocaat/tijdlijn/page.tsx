'use client'

import { useEffect, useState } from 'react'
import { Clock, Plus, Filter, AlertTriangle, CheckCircle, RefreshCw, FileText } from 'lucide-react'
import type { TimelineEvent, Dossier } from '@/lib/advocaat/types'

const SOURCE_COLOR: Record<string, { badge: string; dot: string }> = {
  FEIT:         { badge: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25', dot: 'bg-emerald-400' },
  INTERPRETATIE:{ badge: 'bg-blue-500/15 text-blue-400 border-blue-500/25',         dot: 'bg-blue-400' },
  RISICO:       { badge: 'bg-orange-500/15 text-orange-400 border-orange-500/25',   dot: 'bg-orange-400' },
  VERMOEDEN:    { badge: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/25',   dot: 'bg-yellow-400' },
  ONBEKEND:     { badge: 'bg-white/5 text-white/40 border-white/10',                dot: 'bg-white/30' },
}

const RELEVANCE_COLOR: Record<string, string> = {
  kritiek: 'border-red-500/40',
  hoog:    'border-orange-500/30',
  medium:  'border-white/[0.08]',
  laag:    'border-white/[0.05]',
}

function fmt(d: string) {
  return new Date(d).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })
}

function fmtTime(d: string) {
  return new Date(d).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })
}

export default function TijdlijnPage() {
  const [dossiers,    setDossiers]    = useState<Dossier[]>([])
  const [events,      setEvents]      = useState<TimelineEvent[]>([])
  const [dossierSel,  setDossierSel]  = useState('')
  const [filterSrc,   setFilterSrc]   = useState('')
  const [loading,     setLoading]     = useState(false)
  const [showForm,    setShowForm]    = useState(false)
  const [form,        setForm]        = useState({
    event_date: '', event_type: 'overig', title: '', description: '',
    source: 'ONBEKEND', confidence_score: 50, legal_relevance: 'medium',
    participants: '', notes: '',
  })

  useEffect(() => {
    fetch('/api/advocaat/dossiers?limit=50')
      .then(r => r.json())
      .then(d => setDossiers(d.dossiers ?? []))
      .catch(() => {})
  }, [])

  async function loadEvents() {
    if (!dossierSel) return
    setLoading(true)
    const params = new URLSearchParams({ dossier_id: dossierSel })
    if (filterSrc) params.set('source', filterSrc)
    const res = await fetch(`/api/advocaat/tijdlijn?${params}`).then(r => r.json()).catch(() => ({}))
    setEvents(res.events ?? [])
    setLoading(false)
  }

  useEffect(() => { loadEvents() }, [dossierSel, filterSrc])

  async function submit() {
    const res = await fetch('/api/advocaat/tijdlijn', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        dossier_id: dossierSel,
        ...form,
        participants: form.participants ? form.participants.split(',').map(s => s.trim()) : [],
        confidence_score: Number(form.confidence_score),
      }),
    })
    if (res.ok) { setShowForm(false); loadEvents() }
  }

  const groupedByYear = events.reduce<Record<string, TimelineEvent[]>>((acc, e) => {
    const year = new Date(e.event_date).getFullYear().toString()
    if (!acc[year]) acc[year] = []
    acc[year].push(e)
    return acc
  }, {})

  const years = Object.keys(groupedByYear).sort((a, b) => Number(a) - Number(b))

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white p-6 space-y-6">

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20">
            <Clock className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-white">Forensische Tijdlijn Engine</h1>
            <p className="text-xs text-white/40 mt-0.5">Chronologische reconstructie · Cross-source correlatie · Event classification</p>
          </div>
        </div>
        <div className="flex gap-2">
          {dossierSel && (
            <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-500 transition-all">
              <Plus className="w-3.5 h-3.5" /> Event toevoegen
            </button>
          )}
          <button onClick={loadEvents} className="p-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] transition-all">
            <RefreshCw className={`w-4 h-4 text-white/40 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Legende */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-[10px] text-white/30 uppercase tracking-wider">Classificatie:</span>
        {Object.entries(SOURCE_COLOR).map(([k, v]) => (
          <button key={k} onClick={() => setFilterSrc(filterSrc === k ? '' : k)}
            className={`flex items-center gap-1.5 px-2 py-1 rounded border text-[10px] font-medium transition-all ${filterSrc === k ? v.badge : 'bg-white/[0.03] border-white/[0.07] text-white/40 hover:text-white'}`}>
            <div className={`w-1.5 h-1.5 rounded-full ${v.dot}`} /> {k}
          </button>
        ))}
        {filterSrc && <button onClick={() => setFilterSrc('')} className="text-[10px] text-white/30 hover:text-white px-2 py-1">× Wis filter</button>}
      </div>

      {/* Dossier selector */}
      <div className="flex items-center gap-3">
        <select value={dossierSel} onChange={e => setDossierSel(e.target.value)}
          className="flex-1 max-w-md px-3 py-2 rounded-lg bg-white/[0.05] border border-white/[0.08] text-sm text-white focus:outline-none focus:border-blue-500/40">
          <option value="">Selecteer dossier...</option>
          {dossiers.map(d => <option key={d.id} value={d.id}>{d.title}</option>)}
        </select>
        {dossierSel && <span className="text-xs text-white/40">{events.length} events</span>}
      </div>

      {/* Add event form */}
      {showForm && dossierSel && (
        <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-4 space-y-3">
          <div className="text-sm font-medium text-white">Nieuw Tijdlijn Event</div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-[10px] text-white/40 uppercase tracking-wider">Datum & tijd *</label>
              <input type="datetime-local" value={form.event_date} onChange={e => setForm(p => ({ ...p, event_date: e.target.value }))}
                className="w-full mt-1 px-3 py-2 rounded-lg bg-white/[0.05] border border-white/[0.08] text-sm text-white focus:outline-none focus:border-blue-500/40"
              />
            </div>
            <div>
              <label className="text-[10px] text-white/40 uppercase tracking-wider">Type event</label>
              <select value={form.event_type} onChange={e => setForm(p => ({ ...p, event_type: e.target.value }))}
                className="w-full mt-1 px-3 py-2 rounded-lg bg-white/[0.05] border border-white/[0.08] text-sm text-white focus:outline-none focus:border-blue-500/40">
                {['betaling','afspraak','brief','email','gesprek','overeenkomst','opzegging','somatie','dagvaarding','vonnis','faillissement','contact','deadline','beslissing','overig'].map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-white/40 uppercase tracking-wider">Classificatie</label>
              <select value={form.source} onChange={e => setForm(p => ({ ...p, source: e.target.value }))}
                className="w-full mt-1 px-3 py-2 rounded-lg bg-white/[0.05] border border-white/[0.08] text-sm text-white focus:outline-none focus:border-blue-500/40">
                {['FEIT','INTERPRETATIE','RISICO','VERMOEDEN','ONBEKEND'].map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-[10px] text-white/40 uppercase tracking-wider">Titel *</label>
            <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="Wat is er gebeurd?"
              className="w-full mt-1 px-3 py-2 rounded-lg bg-white/[0.05] border border-white/[0.08] text-sm text-white placeholder-white/20 focus:outline-none focus:border-blue-500/40"
            />
          </div>
          <div>
            <label className="text-[10px] text-white/40 uppercase tracking-wider">Beschrijving</label>
            <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={2}
              placeholder="Gedetailleerde beschrijving..."
              className="w-full mt-1 px-3 py-2 rounded-lg bg-white/[0.05] border border-white/[0.08] text-sm text-white placeholder-white/20 focus:outline-none focus:border-blue-500/40 resize-none"
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-[10px] text-white/40 uppercase tracking-wider">Betrokkenen (komma-gescheiden)</label>
              <input value={form.participants} onChange={e => setForm(p => ({ ...p, participants: e.target.value }))} placeholder="Orlando, Curator, ..."
                className="w-full mt-1 px-3 py-2 rounded-lg bg-white/[0.05] border border-white/[0.08] text-sm text-white placeholder-white/20 focus:outline-none focus:border-blue-500/40"
              />
            </div>
            <div>
              <label className="text-[10px] text-white/40 uppercase tracking-wider">Juridische relevantie</label>
              <select value={form.legal_relevance} onChange={e => setForm(p => ({ ...p, legal_relevance: e.target.value }))}
                className="w-full mt-1 px-3 py-2 rounded-lg bg-white/[0.05] border border-white/[0.08] text-sm text-white focus:outline-none focus:border-blue-500/40">
                {['kritiek','hoog','medium','laag'].map(l => <option key={l}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-white/40 uppercase tracking-wider">Betrouwbaarheid ({form.confidence_score}%)</label>
              <input type="range" min={0} max={100} value={form.confidence_score} onChange={e => setForm(p => ({ ...p, confidence_score: Number(e.target.value) }))}
                className="w-full mt-2"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={submit} className="px-4 py-2 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-500 transition-all">Opslaan</button>
            <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white/60 text-xs hover:text-white transition-all">Annuleren</button>
          </div>
        </div>
      )}

      {/* Timeline */}
      {!dossierSel ? (
        <div className="flex items-center justify-center h-48 text-white/20 text-sm">Selecteer een dossier om de tijdlijn te bekijken</div>
      ) : loading ? (
        <div className="flex items-center justify-center h-48 text-white/30 text-sm">Tijdlijn laden...</div>
      ) : events.length === 0 ? (
        <div className="flex items-center justify-center h-48 text-white/20 text-sm">
          <div className="text-center">
            <Clock className="w-10 h-10 mx-auto mb-2 opacity-20" />
            Geen tijdlijn events. Importeer documenten of voeg handmatig toe.
          </div>
        </div>
      ) : (
        <div className="relative">
          <div className="absolute left-[5.5rem] top-0 bottom-0 w-px bg-white/[0.06]" />
          <div className="space-y-0">
            {years.map(year => (
              <div key={year}>
                <div className="flex items-center gap-4 py-4">
                  <div className="w-20 text-right text-xs font-bold text-white/20 uppercase tracking-wider">{year}</div>
                  <div className="w-3 h-3 rounded-full bg-white/10 border-2 border-white/20 z-10 relative" />
                </div>
                {groupedByYear[year].map(e => {
                  const sc = SOURCE_COLOR[e.source] ?? SOURCE_COLOR.ONBEKEND
                  return (
                    <div key={e.id} className="flex items-start gap-4 group mb-2">
                      <div className="w-20 text-right shrink-0 pt-3">
                        <div className="text-[10px] text-white/30 leading-tight">{new Date(e.event_date).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}</div>
                        <div className="text-[9px] text-white/20">{fmtTime(e.event_date)}</div>
                      </div>
                      <div className={`mt-2.5 w-3 h-3 rounded-full shrink-0 z-10 relative border-2 border-[#0a0a0f] ${sc.dot}`} />
                      <div className={`flex-1 mb-2 p-3 rounded-xl border bg-white/[0.02] hover:bg-white/[0.04] transition-all ${RELEVANCE_COLOR[e.legal_relevance]}`}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-white">{e.title}</span>
                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${sc.badge}`}>{e.source}</span>
                              {e.cross_source_match && (
                                <span className="text-[9px] px-1.5 py-0.5 rounded bg-violet-500/15 text-violet-400 border border-violet-500/25">CROSS-SOURCE</span>
                              )}
                            </div>
                            {e.description && <p className="text-xs text-white/50 mt-1">{e.description}</p>}
                            <div className="flex items-center gap-3 mt-1.5">
                              <span className="text-[10px] text-white/30 capitalize">{e.event_type}</span>
                              {e.participants.length > 0 && (
                                <span className="text-[10px] text-white/30">{e.participants.join(', ')}</span>
                              )}
                              <span className="text-[10px] text-white/20">betrouwbaarheid: {e.confidence_score}%</span>
                            </div>
                          </div>
                          {e.is_gap && (
                            <div className="flex items-center gap-1 shrink-0">
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                              <span className="text-[10px] text-amber-400">GAP</span>
                            </div>
                          )}
                        </div>
                        {e.notes && <div className="text-[10px] text-white/30 mt-1.5 italic">{e.notes}</div>}
                      </div>
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
