'use client'

import { useEffect, useState } from 'react'
import { Lock, FileText, Search, Filter, Shield, AlertTriangle, RefreshCw, Hash } from 'lucide-react'
import type { LegalDocument, Dossier } from '@/lib/advocaat/types'

const LABEL_COLOR: Record<string, string> = {
  FEIT:         'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  INTERPRETATIE:'text-blue-400 bg-blue-500/10 border-blue-500/20',
  RISICO:       'text-orange-400 bg-orange-500/10 border-orange-500/20',
  VERMOEDEN:    'text-yellow-400 bg-yellow-500/8 border-white/[0.06]',
  ONBEKEND:     'text-white/40 bg-white/[0.04] border-white/[0.08]',
}

const STRENGTH_COLOR: Record<string, string> = {
  sterk:         'text-emerald-400',
  gemiddeld:     'text-yellow-400',
  zwak:          'text-orange-400',
  circumstantieel:'text-white/40',
}

function fmt(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function BewijsPage() {
  const [dossiers,  setDossiers]  = useState<Dossier[]>([])
  const [documents, setDocuments] = useState<LegalDocument[]>([])
  const [selected,  setSelected]  = useState<LegalDocument | null>(null)
  const [dossierSel, setDossierSel] = useState('')
  const [filterLabel, setFilterLabel] = useState('')
  const [filterEvidence, setFilterEvidence] = useState(false)
  const [search,    setSearch]    = useState('')
  const [loading,   setLoading]   = useState(false)

  useEffect(() => {
    fetch('/api/advocaat/dossiers?limit=50').then(r => r.json()).then(d => setDossiers(d.dossiers ?? [])).catch(() => {})
  }, [])

  async function load() {
    setLoading(true)
    const params = new URLSearchParams({ limit: '200' })
    if (dossierSel) params.set('dossier_id', dossierSel)
    if (filterLabel) params.set('label', filterLabel)
    if (filterEvidence) params.set('evidence_only', 'true')
    const res = await fetch(`/api/advocaat/bewijs?${params}`).then(r => r.json()).catch(() => ({}))
    setDocuments(res.documents ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [dossierSel, filterLabel, filterEvidence])

  const filtered = documents.filter(d =>
    !search || d.title.toLowerCase().includes(search.toLowerCase()) ||
    d.ai_summary?.toLowerCase().includes(search.toLowerCase())
  )

  const stats = {
    total: documents.length,
    evidence: documents.filter(d => d.is_evidence).length,
    sterk: documents.filter(d => d.evidence_strength === 'sterk').length,
    ocr: documents.filter(d => d.ocr_performed).length,
    hashed: documents.filter(d => d.immutable_hash).length,
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white p-6 space-y-5">

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-violet-500/10 border border-violet-500/20">
            <Lock className="w-5 h-5 text-violet-400" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-white">Bewijs Engine</h1>
            <p className="text-xs text-white/40 mt-0.5">Evidence management · Chain-of-custody · Immutable audit · Semantic search</p>
          </div>
        </div>
        <button onClick={load} className="p-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] transition-all">
          <RefreshCw className={`w-4 h-4 text-white/40 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-3">
        {[
          { label: 'Documenten', value: stats.total, color: 'white' },
          { label: 'Bewijs',     value: stats.evidence, color: 'violet' },
          { label: 'Sterk bewijs', value: stats.sterk, color: 'emerald' },
          { label: 'OCR verwerkt', value: stats.ocr, color: 'blue' },
          { label: 'Gehasht',    value: stats.hashed, color: 'violet' },
        ].map(s => (
          <div key={s.label} className="bg-white/[0.03] border border-white/[0.07] rounded-xl p-3">
            <div className={`text-xl font-bold text-${s.color}-400`}>{s.value}</div>
            <div className="text-[10px] text-white/40 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Zoeken in bewijs..."
            className="pl-8 pr-3 py-2 rounded-lg bg-white/[0.05] border border-white/[0.08] text-sm text-white placeholder-white/25 focus:outline-none focus:border-violet-500/40 w-64"
          />
        </div>
        <select value={dossierSel} onChange={e => setDossierSel(e.target.value)}
          className="px-3 py-2 rounded-lg bg-white/[0.05] border border-white/[0.08] text-sm text-white focus:outline-none focus:border-violet-500/40">
          <option value="">Alle dossiers</option>
          {dossiers.map(d => <option key={d.id} value={d.id}>{d.title}</option>)}
        </select>
        <select value={filterLabel} onChange={e => setFilterLabel(e.target.value)}
          className="px-3 py-2 rounded-lg bg-white/[0.05] border border-white/[0.08] text-sm text-white focus:outline-none focus:border-violet-500/40">
          <option value="">Alle labels</option>
          {['FEIT','INTERPRETATIE','RISICO','VERMOEDEN','ONBEKEND'].map(l => <option key={l}>{l}</option>)}
        </select>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={filterEvidence} onChange={e => setFilterEvidence(e.target.checked)} className="rounded" />
          <span className="text-xs text-white/60">Alleen bewijs</span>
        </label>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Document list */}
        <div className="lg:col-span-2 bg-white/[0.03] border border-white/[0.07] rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-white/[0.06]">
            <span className="text-sm font-medium text-white">{filtered.length} documenten</span>
          </div>
          {loading ? (
            <div className="p-8 text-center text-white/30 text-sm">Laden...</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-white/20 text-sm">
              <Lock className="w-8 h-8 mx-auto mb-2 opacity-20" />
              Geen documenten. Importeer bestanden via de Import sectie.
            </div>
          ) : (
            <div className="divide-y divide-white/[0.04] max-h-[600px] overflow-y-auto">
              {filtered.map(d => (
                <button key={d.id} onClick={() => setSelected(d)}
                  className={`w-full text-left px-4 py-3 hover:bg-white/[0.03] transition-all ${selected?.id === d.id ? 'bg-violet-500/5 border-l-2 border-violet-500' : ''}`}>
                  <div className="flex items-start gap-2">
                    <FileText className="w-3.5 h-3.5 text-white/30 mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-white truncate">{d.title}</span>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border shrink-0 ${LABEL_COLOR[d.content_label]}`}>
                          {d.content_label}
                        </span>
                        {d.is_evidence && <Shield className="w-3 h-3 text-violet-400 shrink-0" />}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-white/30 capitalize">{d.document_type}</span>
                        <span className="text-[10px] text-white/20">{fmt(d.document_date)}</span>
                        {d.evidence_strength && (
                          <span className={`text-[10px] ${STRENGTH_COLOR[d.evidence_strength]}`}>{d.evidence_strength}</span>
                        )}
                      </div>
                      {d.ai_summary && <p className="text-[10px] text-white/40 mt-0.5 line-clamp-1">{d.ai_summary}</p>}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Document detail */}
        <div>
          {!selected ? (
            <div className="h-full flex items-center justify-center bg-white/[0.02] border border-white/[0.06] rounded-xl text-white/20 text-sm min-h-48">
              Selecteer een document
            </div>
          ) : (
            <div className="bg-white/[0.03] border border-white/[0.07] rounded-xl p-4 space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-white">{selected.title}</h3>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${LABEL_COLOR[selected.content_label]}`}>
                    {selected.content_label}
                  </span>
                  <span className="text-[10px] text-white/30 capitalize">{selected.document_type}</span>
                  <span className="text-[10px] text-white/30">{selected.source}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Documentdatum', value: fmt(selected.document_date) },
                  { label: 'Auteur', value: selected.author ?? '—' },
                  { label: 'Ontvanger', value: selected.recipient ?? '—' },
                  { label: 'OCR verwerkt', value: selected.ocr_performed ? `Ja (${selected.ocr_confidence?.toFixed(0)}%)` : 'Nee' },
                ].map(f => (
                  <div key={f.label} className="p-2 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                    <div className="text-[9px] text-white/30 uppercase">{f.label}</div>
                    <div className="text-xs text-white mt-0.5">{f.value}</div>
                  </div>
                ))}
              </div>

              {selected.is_evidence && (
                <div className={`p-3 rounded-xl border ${selected.evidence_strength === 'sterk' ? 'bg-emerald-500/8 border-emerald-500/20' : 'bg-violet-500/8 border-violet-500/20'}`}>
                  <div className="flex items-center gap-2">
                    <Shield className="w-3.5 h-3.5 text-violet-400" />
                    <span className="text-xs font-medium text-white">Bewijsstuk</span>
                  </div>
                  {selected.evidence_strength && (
                    <div className={`text-xs mt-1 ${STRENGTH_COLOR[selected.evidence_strength]}`}>
                      Bewijswaarde: {selected.evidence_strength}
                    </div>
                  )}
                </div>
              )}

              {selected.immutable_hash && (
                <div className="p-2 rounded-lg bg-white/[0.02] border border-white/[0.06]">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Hash className="w-3 h-3 text-white/30" />
                    <span className="text-[9px] text-white/30 uppercase">SHA256 Hash</span>
                  </div>
                  <code className="text-[9px] text-white/40 break-all">{selected.immutable_hash}</code>
                </div>
              )}

              {selected.ai_risk_flags.length > 0 && (
                <div className="p-3 rounded-xl bg-orange-500/5 border border-orange-500/15">
                  <div className="flex items-center gap-1.5 mb-2">
                    <AlertTriangle className="w-3.5 h-3.5 text-orange-400" />
                    <span className="text-xs text-orange-400 font-medium">AI Risico-flags</span>
                  </div>
                  {selected.ai_risk_flags.map((f, i) => (
                    <div key={i} className="text-[10px] text-white/50">· {f}</div>
                  ))}
                </div>
              )}

              {selected.ai_summary && (
                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                  <div className="text-[9px] text-white/30 uppercase mb-1">AI Samenvatting</div>
                  <p className="text-xs text-white/60 leading-relaxed">{selected.ai_summary}</p>
                </div>
              )}

              {selected.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {selected.tags.map(t => (
                    <span key={t} className="text-[9px] px-1.5 py-0.5 rounded bg-white/[0.04] border border-white/[0.07] text-white/40">{t}</span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
