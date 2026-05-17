'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { Lock, FileText, Search, Shield, AlertTriangle, RefreshCw, Hash, ChevronLeft, ChevronRight, CheckSquare, Square, X, FolderOpen, Tag, Eye, ExternalLink, Download, Copy, Check } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { LegalDocument, Dossier } from '@/lib/advocaat/types'

type DocWithMeta = LegalDocument & { source_path?: string; file_size_bytes?: number }

const supabase = createClient()

const LABEL_COLOR: Record<string, string> = {
  FEIT:         'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  INTERPRETATIE:'text-blue-400 bg-blue-500/10 border-blue-500/20',
  RISICO:       'text-orange-400 bg-orange-500/10 border-orange-500/20',
  VERMOEDEN:    'text-yellow-400 bg-yellow-500/8 border-white/[0.06]',
  ONBEKEND:     'text-white/40 bg-white/[0.04] border-white/[0.08]',
}

const STRENGTH_COLOR: Record<string, string> = {
  sterk:          'text-emerald-400',
  gemiddeld:      'text-yellow-400',
  zwak:           'text-orange-400',
  circumstantieel:'text-white/40',
}

const PAGE_SIZE = 100

// Open bestand: uploaded files via Supabase signed URL, lokale files via clipboard
async function openFile(doc: DocWithMeta, mode: 'open' | 'download' = 'open') {
  if (doc.source === 'upload' && doc.source_path) {
    const { data, error } = await supabase.storage
      .from('advocaat-uploads')
      .createSignedUrl(doc.source_path, 3600) // 1 uur geldig
    if (error || !data?.signedUrl) { alert('Kan URL niet genereren: ' + (error?.message ?? 'onbekend')); return }
    if (mode === 'download') {
      const a = document.createElement('a')
      a.href = data.signedUrl
      a.download = doc.source_filename ?? doc.title
      a.click()
    } else {
      window.open(data.signedUrl, '_blank', 'noopener')
    }
  }
}

async function copyPath(path: string) {
  await navigator.clipboard.writeText(path)
}

function fmt(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })
}

function fmtBytes(n: number | null) {
  if (!n) return '—'
  if (n < 1024) return `${n} B`
  if (n < 1048576) return `${(n/1024).toFixed(1)} KB`
  return `${(n/1048576).toFixed(1)} MB`
}

export default function BewijsPage() {
  const [dossiers,     setDossiers]     = useState<Dossier[]>([])
  const [documents,    setDocuments]    = useState<LegalDocument[]>([])
  const [total,        setTotal]        = useState(0)
  const [selected,     setSelected]     = useState<LegalDocument | null>(null)
  const [checked,      setChecked]      = useState<Set<string>>(new Set())
  const [loading,      setLoading]      = useState(false)
  const [saving,       setSaving]       = useState(false)
  const [copied,       setCopied]       = useState(false)

  // Filters
  const [search,        setSearch]        = useState('')
  const [searchInput,   setSearchInput]   = useState('')
  const [dossierSel,    setDossierSel]    = useState('')
  const [filterLabel,   setFilterLabel]   = useState('')
  const [filterType,    setFilterType]    = useState('')
  const [filterEvidence,setFilterEvidence]= useState(false)
  const [page,          setPage]          = useState(0)

  // Bulk action state
  const [bulkLabel,    setBulkLabel]    = useState('')
  const [bulkDossier,  setBulkDossier]  = useState('')
  const [bulkEvidence, setBulkEvidence] = useState('')
  const [showBulk,     setShowBulk]     = useState(false)

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    fetch('/api/advocaat/dossiers?limit=50')
      .then(r => r.json())
      .then(d => setDossiers(d.dossiers ?? []))
      .catch(() => {})
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(page * PAGE_SIZE) })
    if (dossierSel)     params.set('dossier_id', dossierSel)
    if (filterLabel)    params.set('label', filterLabel)
    if (filterType)     params.set('doc_type', filterType)
    if (filterEvidence) params.set('evidence_only', 'true')
    if (search)         params.set('search', search)

    const res = await fetch(`/api/advocaat/bewijs?${params}`).then(r => r.json()).catch(() => ({}))
    setDocuments(res.documents ?? [])
    setTotal(res.total ?? 0)
    setLoading(false)
  }, [dossierSel, filterLabel, filterType, filterEvidence, search, page])

  useEffect(() => { load() }, [load])

  // Debounce search input
  function handleSearchInput(val: string) {
    setSearchInput(val)
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => {
      setSearch(val)
      setPage(0)
    }, 400)
  }

  function toggleCheck(id: string) {
    setChecked(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleAll() {
    if (checked.size === documents.length) {
      setChecked(new Set())
    } else {
      setChecked(new Set(documents.map(d => d.id)))
    }
  }

  function clearSelection() {
    setChecked(new Set())
    setShowBulk(false)
  }

  async function applyBulk() {
    if (checked.size === 0) return
    setSaving(true)
    const updates: Record<string, unknown> = { ids: Array.from(checked) }
    if (bulkLabel)    updates.content_label = bulkLabel
    if (bulkEvidence) updates.is_evidence   = bulkEvidence === 'ja'
    if (bulkDossier !== '') updates.dossier_id = bulkDossier || null

    await fetch('/api/advocaat/bewijs', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(updates),
    })
    setSaving(false)
    clearSelection()
    setBulkLabel(''); setBulkDossier(''); setBulkEvidence('')
    load()
  }

  async function patchSingle(id: string, updates: Record<string, unknown>) {
    setSaving(true)
    const res = await fetch('/api/advocaat/bewijs', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id, ...updates }),
    }).then(r => r.json())
    if (res.document) setSelected(res.document)
    setSaving(false)
    load()
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)
  const allOnPageChecked = documents.length > 0 && documents.every(d => checked.has(d.id))
  const someChecked = checked.size > 0

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white p-6 space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-violet-500/10 border border-violet-500/20">
            <Lock className="w-5 h-5 text-violet-400" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-white">Bewijs Engine</h1>
            <p className="text-xs text-white/40 mt-0.5">{total.toLocaleString('nl-NL')} documenten · Chain-of-custody · Immutable audit</p>
          </div>
        </div>
        <button onClick={load} className="p-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] transition-all">
          <RefreshCw className={`w-4 h-4 text-white/40 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Search + filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
          <input
            value={searchInput}
            onChange={e => handleSearchInput(e.target.value)}
            placeholder="Zoek in titel, bestandsnaam, tekst..."
            className="pl-8 pr-3 py-2 rounded-lg bg-white/[0.05] border border-white/[0.08] text-sm text-white placeholder-white/25 focus:outline-none focus:border-violet-500/40 w-72"
          />
          {searchInput && (
            <button onClick={() => { setSearchInput(''); setSearch(''); setPage(0) }}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-white/30 hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <select value={filterLabel} onChange={e => { setFilterLabel(e.target.value); setPage(0) }}
          className="px-3 py-2 rounded-lg bg-white/[0.05] border border-white/[0.08] text-sm text-white focus:outline-none focus:border-violet-500/40">
          <option value="">Alle labels</option>
          {['FEIT','INTERPRETATIE','RISICO','VERMOEDEN','ONBEKEND'].map(l => <option key={l}>{l}</option>)}
        </select>

        <select value={filterType} onChange={e => { setFilterType(e.target.value); setPage(0) }}
          className="px-3 py-2 rounded-lg bg-white/[0.05] border border-white/[0.08] text-sm text-white focus:outline-none focus:border-violet-500/40">
          <option value="">Alle typen</option>
          {['dagvaarding','vonnis','contract','ingebrekestelling','brief','factuur','bewijs','overig'].map(t => (
            <option key={t}>{t}</option>
          ))}
        </select>

        <select value={dossierSel} onChange={e => { setDossierSel(e.target.value); setPage(0) }}
          className="px-3 py-2 rounded-lg bg-white/[0.05] border border-white/[0.08] text-sm text-white focus:outline-none focus:border-violet-500/40">
          <option value="">Alle dossiers</option>
          <option value="__none__">Zonder dossier</option>
          {dossiers.map(d => <option key={d.id} value={d.id}>{d.title}</option>)}
        </select>

        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input type="checkbox" checked={filterEvidence} onChange={e => { setFilterEvidence(e.target.checked); setPage(0) }} className="rounded" />
          <span className="text-xs text-white/60">Alleen bewijs</span>
        </label>
      </div>

      {/* Bulk action bar */}
      {someChecked && (
        <div className="flex items-center gap-3 p-3 rounded-xl bg-violet-500/10 border border-violet-500/20 flex-wrap">
          <span className="text-sm font-medium text-violet-300">{checked.size} geselecteerd</span>

          <select value={bulkLabel} onChange={e => setBulkLabel(e.target.value)}
            className="px-2 py-1.5 rounded-lg bg-white/[0.06] border border-white/[0.1] text-xs text-white focus:outline-none">
            <option value="">Label wijzigen...</option>
            {['FEIT','INTERPRETATIE','RISICO','VERMOEDEN','ONBEKEND'].map(l => <option key={l}>{l}</option>)}
          </select>

          <select value={bulkEvidence} onChange={e => setBulkEvidence(e.target.value)}
            className="px-2 py-1.5 rounded-lg bg-white/[0.06] border border-white/[0.1] text-xs text-white focus:outline-none">
            <option value="">Bewijs status...</option>
            <option value="ja">Markeer als bewijs</option>
            <option value="nee">Geen bewijs</option>
          </select>

          <select value={bulkDossier} onChange={e => setBulkDossier(e.target.value)}
            className="px-2 py-1.5 rounded-lg bg-white/[0.06] border border-white/[0.1] text-xs text-white focus:outline-none">
            <option value="">Koppel aan dossier...</option>
            <option value="__clear__">Ontkoppel van dossier</option>
            {dossiers.map(d => <option key={d.id} value={d.id}>{d.title}</option>)}
          </select>

          <button onClick={applyBulk} disabled={saving || (!bulkLabel && !bulkEvidence && !bulkDossier)}
            className="px-3 py-1.5 rounded-lg bg-violet-600 text-white text-xs font-medium hover:bg-violet-500 disabled:opacity-40 transition-all">
            {saving ? 'Opslaan...' : 'Toepassen'}
          </button>

          <button onClick={clearSelection} className="px-3 py-1.5 rounded-lg bg-white/[0.06] border border-white/[0.1] text-white/60 text-xs hover:text-white transition-all">
            Selectie wissen
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4">

        {/* Document list */}
        <div className="bg-white/[0.03] border border-white/[0.07] rounded-xl overflow-hidden flex flex-col">
          {/* List header */}
          <div className="px-4 py-2.5 border-b border-white/[0.06] flex items-center gap-3">
            <button onClick={toggleAll} className="shrink-0 text-white/40 hover:text-white transition-colors">
              {allOnPageChecked
                ? <CheckSquare className="w-4 h-4 text-violet-400" />
                : <Square className="w-4 h-4" />
              }
            </button>
            <span className="text-xs text-white/40">
              {loading ? 'Laden...' : `${documents.length} van ${total.toLocaleString('nl-NL')} documenten`}
            </span>
            {/* Pagination */}
            {totalPages > 1 && (
              <div className="ml-auto flex items-center gap-1">
                <button onClick={() => setPage(p => Math.max(0, p-1))} disabled={page === 0}
                  className="p-1 rounded text-white/30 hover:text-white disabled:opacity-20 transition-colors">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-[10px] text-white/40 px-1">{page+1} / {totalPages}</span>
                <button onClick={() => setPage(p => Math.min(totalPages-1, p+1))} disabled={page >= totalPages-1}
                  className="p-1 rounded text-white/30 hover:text-white disabled:opacity-20 transition-colors">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {loading ? (
            <div className="p-8 text-center text-white/30 text-sm">Laden...</div>
          ) : documents.length === 0 ? (
            <div className="p-8 text-center text-white/20 text-sm">
              <Lock className="w-8 h-8 mx-auto mb-2 opacity-20" />
              Geen documenten gevonden.
            </div>
          ) : (
            <div className="divide-y divide-white/[0.04] overflow-y-auto" style={{ maxHeight: 'calc(100vh - 280px)' }}>
              {documents.map(doc => (
                <div key={doc.id}
                  className={`flex items-start gap-2 px-3 py-2.5 hover:bg-white/[0.025] transition-all cursor-pointer group
                    ${selected?.id === doc.id ? 'bg-violet-500/5 border-l-2 border-violet-500' : ''}
                    ${checked.has(doc.id) ? 'bg-violet-500/5' : ''}`}>

                  {/* Checkbox */}
                  <button
                    onClick={e => { e.stopPropagation(); toggleCheck(doc.id) }}
                    className="shrink-0 mt-0.5 text-white/20 hover:text-violet-400 transition-colors">
                    {checked.has(doc.id)
                      ? <CheckSquare className="w-4 h-4 text-violet-400" />
                      : <Square className="w-4 h-4 opacity-0 group-hover:opacity-100" />
                    }
                  </button>

                  {/* Content */}
                  <div className="flex-1 min-w-0" onClick={() => setSelected(doc)}>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-sm font-medium text-white truncate max-w-[280px]">{doc.title}</span>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border shrink-0 ${LABEL_COLOR[doc.content_label]}`}>
                        {doc.content_label}
                      </span>
                      {doc.is_evidence && <Shield className="w-3 h-3 text-violet-400 shrink-0" />}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-white/30 capitalize">{doc.document_type}</span>
                      <span className="text-[10px] text-white/20">{fmt(doc.document_date)}</span>
                      {doc.evidence_strength && (
                        <span className={`text-[10px] ${STRENGTH_COLOR[doc.evidence_strength]}`}>{doc.evidence_strength}</span>
                      )}
                      {doc.source_filename && (
                        <span className="text-[10px] text-white/15 truncate max-w-[180px]">{doc.source_filename}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Detail panel */}
        <div>
          {!selected ? (
            <div className="h-48 flex items-center justify-center bg-white/[0.02] border border-white/[0.06] rounded-xl text-white/20 text-sm">
              <div className="text-center">
                <Eye className="w-8 h-8 mx-auto mb-2 opacity-20" />
                Klik op een document
              </div>
            </div>
          ) : (
            <div className="bg-white/[0.03] border border-white/[0.07] rounded-xl p-4 space-y-4 sticky top-4" style={{ maxHeight: 'calc(100vh - 120px)', overflowY: 'auto' }}>

              <div>
                <h3 className="text-sm font-semibold text-white leading-snug">{selected.title}</h3>
                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${LABEL_COLOR[selected.content_label]}`}>
                    {selected.content_label}
                  </span>
                  <span className="text-[10px] text-white/30 capitalize">{selected.document_type}</span>
                  <span className="text-[10px] text-white/30">{selected.source}</span>
                </div>

                {/* Open / Download / Kopieer pad */}
                {(selected as DocWithMeta).source_path && (
                  <div className="flex items-center gap-2 mt-3">
                    {selected.source === 'upload' ? (
                      <>
                        <button
                          onClick={() => openFile(selected as DocWithMeta, 'open')}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600 text-white text-xs font-medium hover:bg-violet-500 transition-all"
                        >
                          <ExternalLink className="w-3.5 h-3.5" /> Openen
                        </button>
                        <button
                          onClick={() => openFile(selected as DocWithMeta, 'download')}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.06] border border-white/[0.1] text-white/70 text-xs hover:text-white hover:bg-white/[0.1] transition-all"
                        >
                          <Download className="w-3.5 h-3.5" /> Download
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={async () => {
                          await copyPath((selected as DocWithMeta).source_path ?? '')
                          setCopied(true)
                          setTimeout(() => setCopied(false), 2000)
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.06] border border-white/[0.1] text-white/60 text-xs hover:text-white hover:bg-white/[0.1] transition-all"
                      >
                        {copied
                          ? <><Check className="w-3.5 h-3.5 text-emerald-400" /> Gekopieerd</>
                          : <><Copy className="w-3.5 h-3.5" /> Kopieer pad</>
                        }
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Edit label */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[9px] text-white/30 uppercase tracking-wider block mb-1">Label</label>
                  <select
                    value={selected.content_label}
                    onChange={e => patchSingle(selected.id, { content_label: e.target.value })}
                    className="w-full px-2 py-1.5 rounded-lg bg-white/[0.05] border border-white/[0.08] text-xs text-white focus:outline-none focus:border-violet-500/40">
                    {['FEIT','INTERPRETATIE','RISICO','VERMOEDEN','ONBEKEND'].map(l => <option key={l}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[9px] text-white/30 uppercase tracking-wider block mb-1">Bewijs</label>
                  <select
                    value={selected.is_evidence ? 'ja' : 'nee'}
                    onChange={e => patchSingle(selected.id, { is_evidence: e.target.value === 'ja' })}
                    className="w-full px-2 py-1.5 rounded-lg bg-white/[0.05] border border-white/[0.08] text-xs text-white focus:outline-none focus:border-violet-500/40">
                    <option value="ja">Ja</option>
                    <option value="nee">Nee</option>
                  </select>
                </div>
              </div>

              {/* Koppel aan dossier */}
              <div>
                <label className="text-[9px] text-white/30 uppercase tracking-wider block mb-1 flex items-center gap-1">
                  <FolderOpen className="w-3 h-3" /> Dossier
                </label>
                <select
                  value={selected.dossier_id ?? ''}
                  onChange={e => patchSingle(selected.id, { dossier_id: e.target.value || null })}
                  className="w-full px-2 py-1.5 rounded-lg bg-white/[0.05] border border-white/[0.08] text-xs text-white focus:outline-none focus:border-violet-500/40">
                  <option value="">Geen dossier</option>
                  {dossiers.map(d => <option key={d.id} value={d.id}>{d.title}</option>)}
                </select>
              </div>

              {/* Metadata grid */}
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Datum', value: fmt(selected.document_date) },
                  { label: 'Bestandsgrootte', value: fmtBytes((selected as DocWithMeta).file_size_bytes ?? null) },
                  { label: 'Auteur', value: selected.author ?? '—' },
                  { label: 'OCR', value: selected.ocr_performed ? 'Ja' : 'Nee' },
                ].map(f => (
                  <div key={f.label} className="p-2 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                    <div className="text-[9px] text-white/30 uppercase">{f.label}</div>
                    <div className="text-xs text-white mt-0.5">{f.value}</div>
                  </div>
                ))}
              </div>

              {/* Bewijssterkte */}
              {selected.is_evidence && (
                <div className="p-3 rounded-xl bg-violet-500/8 border border-violet-500/20">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Shield className="w-3.5 h-3.5 text-violet-400" />
                      <span className="text-xs font-medium text-white">Bewijsstuk</span>
                    </div>
                    <select
                      value={selected.evidence_strength ?? ''}
                      onChange={e => patchSingle(selected.id, { evidence_strength: e.target.value || null })}
                      className="px-2 py-1 rounded bg-white/[0.06] border border-white/[0.1] text-[10px] text-white focus:outline-none">
                      <option value="">Sterkte...</option>
                      {['sterk','gemiddeld','zwak','circumstantieel'].map(s => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                  {selected.evidence_strength && (
                    <div className={`text-xs mt-1.5 ${STRENGTH_COLOR[selected.evidence_strength]}`}>
                      Bewijswaarde: {selected.evidence_strength}
                    </div>
                  )}
                </div>
              )}

              {/* SHA256 */}
              {selected.immutable_hash && (
                <div className="p-2 rounded-lg bg-white/[0.02] border border-white/[0.06]">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Hash className="w-3 h-3 text-white/30" />
                    <span className="text-[9px] text-white/30 uppercase">SHA256 — Chain of Custody</span>
                  </div>
                  <code className="text-[9px] text-white/40 break-all leading-relaxed">{selected.immutable_hash}</code>
                </div>
              )}

              {/* Bronpad — lokale bestanden tonen het volledige pad */}
              {(selected as DocWithMeta).source_path && selected.source !== 'upload' && (
                <div className="p-2 rounded-lg bg-white/[0.02] border border-white/[0.06]">
                  <div className="text-[9px] text-white/30 uppercase mb-1">Lokaal pad</div>
                  <code className="text-[9px] text-white/30 break-all leading-relaxed">
                    {(selected as DocWithMeta).source_path}
                  </code>
                </div>
              )}

              {/* Risico flags */}
              {selected.ai_risk_flags?.length > 0 && (
                <div className="p-3 rounded-xl bg-orange-500/5 border border-orange-500/15">
                  <div className="flex items-center gap-1.5 mb-2">
                    <AlertTriangle className="w-3.5 h-3.5 text-orange-400" />
                    <span className="text-xs text-orange-400 font-medium">Risico-flags</span>
                  </div>
                  {selected.ai_risk_flags.map((f, i) => (
                    <div key={i} className="text-[10px] text-white/50">· {f}</div>
                  ))}
                </div>
              )}

              {/* Tags */}
              {selected.tags?.length > 0 && (
                <div>
                  <div className="flex items-center gap-1 mb-1.5">
                    <Tag className="w-3 h-3 text-white/30" />
                    <span className="text-[9px] text-white/30 uppercase">Tags</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {selected.tags.map(t => (
                      <span key={t} className="text-[9px] px-1.5 py-0.5 rounded bg-white/[0.04] border border-white/[0.07] text-white/40">{t}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Raw tekst preview */}
              {selected.raw_text && (
                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                  <div className="text-[9px] text-white/30 uppercase mb-1.5">Tekstpreview</div>
                  <p className="text-[10px] text-white/50 leading-relaxed whitespace-pre-wrap line-clamp-10">
                    {selected.raw_text}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
