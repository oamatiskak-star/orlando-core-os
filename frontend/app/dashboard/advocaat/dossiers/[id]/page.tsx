'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  Scale, ArrowLeft, RefreshCw, Brain, AlertTriangle, FileText, Clock,
  Euro, Building2, Gavel, Hash, User, Mail, Calendar, Tag, Sparkles,
  CheckCircle, Loader2, Edit3, ExternalLink, ShieldAlert,
  AlertCircle, FileWarning, ChevronDown, ChevronUp,
} from 'lucide-react'
import { MemorySidebar } from '../../mail-defense/_components/MemorySidebar'
import type {
  Dossier, CuratorDossier, LegalDocument, LegalRisk, TimelineEvent,
  Priority, RiskSeverity,
} from '@/lib/advocaat/types'
import { consumeAnalyseStream } from '@/lib/advocaat/stream'
import { NotesPanel } from '../_components/NotesPanel'
import { DilDocumentsPanel } from '../_components/DilDocumentsPanel'
import { ExpertPanel } from '../_components/ExpertPanel'

const PRIORITY_COLOR: Record<Priority, string> = {
  kritiek: 'text-red-400 bg-red-500/10 border-red-500/30',
  hoog:    'text-orange-400 bg-orange-500/10 border-orange-500/25',
  medium:  'text-yellow-400 bg-yellow-500/8 border-white/[0.06]',
  laag:    'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
}

const STATUS_COLOR: Record<string, string> = {
  actief:   'text-blue-400 bg-blue-500/10 border-blue-500/20',
  on_hold:  'text-yellow-400 bg-yellow-500/8 border-white/[0.06]',
  gesloten: 'text-white/40 bg-white/[0.04] border-white/[0.08]',
  gewonnen: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  verloren: 'text-red-400 bg-red-500/10 border-red-500/20',
  geschikt: 'text-violet-400 bg-violet-500/10 border-violet-500/20',
}

const SEVERITY_COLOR: Record<RiskSeverity, string> = {
  kritiek: 'text-red-400 bg-red-500/10 border-red-500/30',
  hoog:    'text-orange-400 bg-orange-500/10 border-orange-500/25',
  medium:  'text-yellow-400 bg-yellow-500/8 border-white/[0.06]',
  laag:    'text-white/40 bg-white/[0.04] border-white/[0.08]',
}

const DOSSIER_TYPE_LABELS: Record<string, string> = {
  curator: 'Curator', faillissement: 'Faillissement',
  bestuurdersaansprakelijkheid: 'Bestuurdersaansprakelijkheid',
  pauliana: 'Pauliana', incasso: 'Incasso',
  contractgeschil: 'Contractgeschil', vastgoedgeschil: 'Vastgoedgeschil',
  arbeidsrecht: 'Arbeidsrecht', aansprakelijkheid: 'Aansprakelijkheid',
  dagvaarding: 'Dagvaarding', overig: 'Overig',
}

const DOC_LABEL_COLOR: Record<string, string> = {
  FEIT:           'text-blue-400 bg-blue-500/10 border-blue-500/20',
  INTERPRETATIE:  'text-violet-400 bg-violet-500/10 border-violet-500/20',
  RISICO:         'text-red-400 bg-red-500/10 border-red-500/20',
  VERMOEDEN:      'text-yellow-400 bg-yellow-500/8 border-white/[0.06]',
  ONBEKEND:       'text-white/40 bg-white/[0.04] border-white/[0.08]',
}

interface DetailResponse {
  dossier:    Dossier
  risicos:    LegalRisk[]
  documenten: LegalDocument[]
  tijdlijn:   TimelineEvent[]
  curator:    CuratorDossier | null
}

function fmt(d: string | null) {
  if (!d) return null
  return new Date(d).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })
}

function fmtDT(d: string | null) {
  if (!d) return null
  return new Date(d).toLocaleString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function daysUntil(d: string | null) {
  if (!d) return null
  return Math.ceil((new Date(d).getTime() - Date.now()) / 86400000)
}

function fmtEur(n: number | null) {
  if (n === null || n === undefined) return null
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)
}

export default function DossierDetailPage() {
  const params = useParams<{ id: string }>()
  const id = params.id

  const [data,       setData]       = useState<DetailResponse | null>(null)
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState<string | null>(null)
  const [analyzing,  setAnalyzing]  = useState(false)
  const [analyseTxt, setAnalyseTxt] = useState<string | null>(null)
  const [editing,    setEditing]    = useState(false)
  const [showAllRisicos,    setShowAllRisicos]    = useState(false)
  const [showAllDocumenten, setShowAllDocumenten] = useState(false)
  const [showAllTijdlijn,   setShowAllTijdlijn]   = useState(false)

  // Edit form state — gevuld vanuit data.dossier
  const [editForm, setEditForm] = useState<Partial<Dossier>>({})
  const [savingEdit, setSavingEdit] = useState(false)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/advocaat/dossiers/${id}`)
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error ?? `HTTP ${res.status}`)
      }
      const json = await res.json() as DetailResponse
      setData(json)
      setEditForm({
        title:             json.dossier.title,
        description:       json.dossier.description,
        status:            json.dossier.status,
        priority:          json.dossier.priority,
        wederpartij:       json.dossier.wederpartij,
        wederpartij_email: json.dossier.wederpartij_email,
        advocaat_naam:     json.dossier.advocaat_naam,
        rechtbank:         json.dossier.rechtbank,
        zaaknummer:        json.dossier.zaaknummer,
        inzet_bedrag:      json.dossier.inzet_bedrag,
        next_deadline:     json.dossier.next_deadline,
        next_action:       json.dossier.next_action,
        tags:              json.dossier.tags,
      })
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { if (id) load() }, [id])

  async function runAnalyse(analyse_type: string = 'volledig') {
    if (!data) return
    setAnalyzing(true)
    setAnalyseTxt('')
    try {
      const res = await fetch('/api/advocaat/analyze', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ dossier_id: id, analyse_type }),
      })
      let accumulated = ''
      await consumeAnalyseStream(res, (event) => {
        if (event.kind === 'chunk') {
          accumulated += event.text
          setAnalyseTxt(accumulated)
        } else if (event.kind === 'done') {
          setAnalyseTxt(event.analyse)
        }
      })
    } catch (e) {
      setAnalyseTxt(`Fout: ${(e as Error).message}`)
    } finally {
      setAnalyzing(false)
    }
  }

  async function saveEdit() {
    if (!data) return
    setSavingEdit(true)
    try {
      const body: Record<string, unknown> = {}
      const fields: (keyof Dossier)[] = [
        'title','description','status','priority','wederpartij','wederpartij_email',
        'advocaat_naam','rechtbank','zaaknummer','inzet_bedrag','next_deadline',
        'next_action','tags',
      ]
      for (const f of fields) {
        if (editForm[f] !== data.dossier[f]) body[f] = editForm[f]
      }
      if (Object.keys(body).length === 0) {
        setEditing(false)
        return
      }
      const res = await fetch(`/api/advocaat/dossiers/${id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error ?? 'Opslaan mislukt')
      }
      await load()
      setEditing(false)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSavingEdit(false)
    }
  }

  // ── Render states ────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] text-white p-6 flex items-center justify-center">
        <div className="flex items-center gap-3 text-white/40 text-sm">
          <Loader2 className="w-4 h-4 animate-spin" /> Dossier laden...
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] text-white p-6">
        <Link href="/dashboard/advocaat/dossiers"
          className="inline-flex items-center gap-2 text-white/40 hover:text-white text-sm mb-4">
          <ArrowLeft className="w-4 h-4" /> Terug naar dossiers
        </Link>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
          <AlertTriangle className="w-10 h-10 text-red-400/40" />
          <p className="text-sm text-red-400">{error ?? 'Dossier niet gevonden'}</p>
          <button onClick={load} className="px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-xs text-white/60 hover:text-white">
            Opnieuw proberen
          </button>
        </div>
      </div>
    )
  }

  const { dossier, risicos, documenten, tijdlijn, curator } = data
  const dl = daysUntil(dossier.next_deadline)

  const visibleRisicos    = showAllRisicos    ? risicos    : risicos.slice(0, 5)
  const visibleDocumenten = showAllDocumenten ? documenten : documenten.slice(0, 8)
  const visibleTijdlijn   = showAllTijdlijn   ? tijdlijn   : tijdlijn.slice(0, 6)

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white p-6 space-y-5">

      {/* ── Top bar ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <Link href="/dashboard/advocaat/dossiers"
          className="inline-flex items-center gap-2 text-white/40 hover:text-white text-sm">
          <ArrowLeft className="w-4 h-4" /> Terug
        </Link>
        <div className="flex items-center gap-2">
          <MemorySidebar defaultDossierId={dossier.id} />
          <button onClick={() => setEditing(v => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] transition-all text-xs text-white/60 hover:text-white">
            <Edit3 className="w-3.5 h-3.5" /> {editing ? 'Annuleren' : 'Bewerken'}
          </button>
          <button onClick={load}
            className="p-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] transition-all">
            <RefreshCw className={`w-4 h-4 text-white/40 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="bg-white/[0.03] border border-white/[0.07] rounded-xl p-5 space-y-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className="p-2.5 rounded-xl bg-violet-500/10 border border-violet-500/20 shrink-0">
              <Scale className="w-5 h-5 text-violet-400" />
            </div>
            <div className="flex-1 min-w-0">
              {editing ? (
                <input value={editForm.title ?? ''}
                  onChange={e => setEditForm(p => ({ ...p, title: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg bg-white/[0.05] border border-white/[0.08] text-base text-white focus:outline-none focus:border-violet-500/40" />
              ) : (
                <h1 className="text-lg font-semibold text-white break-words">{dossier.title}</h1>
              )}
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${PRIORITY_COLOR[dossier.priority]}`}>
                  {dossier.priority.toUpperCase()}
                </span>
                <span className={`text-[9px] px-1.5 py-0.5 rounded border ${STATUS_COLOR[dossier.status]}`}>
                  {dossier.status}
                </span>
                <span className="text-[10px] text-white/40">
                  {DOSSIER_TYPE_LABELS[dossier.dossier_type] ?? dossier.dossier_type}
                </span>
                {dossier.zaaknummer && (
                  <span className="flex items-center gap-1 text-[10px] text-white/40">
                    <Hash className="w-3 h-3" /> {dossier.zaaknummer}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Risk score ring */}
          <div className="flex flex-col items-center shrink-0">
            <div className="relative w-20 h-20">
              <svg className="w-20 h-20 -rotate-90">
                <circle cx="40" cy="40" r="34" stroke="rgba(255,255,255,0.06)" strokeWidth="6" fill="none" />
                <circle cx="40" cy="40" r="34"
                  stroke={dossier.risk_score >= 75 ? '#ef4444' : dossier.risk_score >= 50 ? '#f97316' : dossier.risk_score >= 25 ? '#eab308' : '#10b981'}
                  strokeWidth="6" fill="none"
                  strokeDasharray={`${(dossier.risk_score / 100) * 213.6} 213.6`}
                  strokeLinecap="round" />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center flex-col">
                <span className="text-lg font-bold text-white">{dossier.risk_score}</span>
                <span className="text-[8px] text-white/30 -mt-0.5">RISK</span>
              </div>
            </div>
          </div>
        </div>

        {/* Description */}
        {(editing || dossier.description) && (
          <div>
            <span className="text-[10px] text-white/40 uppercase tracking-wider">Beschrijving</span>
            {editing ? (
              <textarea value={editForm.description ?? ''}
                onChange={e => setEditForm(p => ({ ...p, description: e.target.value }))}
                rows={3}
                className="w-full mt-1 px-3 py-2 rounded-lg bg-white/[0.05] border border-white/[0.08] text-sm text-white placeholder-white/20 focus:outline-none focus:border-violet-500/40 resize-none" />
            ) : (
              <p className="text-sm text-white/60 mt-1 whitespace-pre-wrap leading-relaxed">{dossier.description}</p>
            )}
          </div>
        )}

        {/* Tags */}
        {dossier.tags && dossier.tags.length > 0 && !editing && (
          <div className="flex flex-wrap gap-1">
            {dossier.tags.map(tag => (
              <span key={tag} className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white/[0.04] border border-white/[0.07] text-[10px] text-white/40">
                <Tag className="w-2.5 h-2.5" /> {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* ── Key info grid ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <InfoCard icon={<Building2 className="w-3.5 h-3.5" />} label="Wederpartij"
          value={dossier.wederpartij} editable={editing}
          onChange={v => setEditForm(p => ({ ...p, wederpartij: v }))} />
        <InfoCard icon={<Mail className="w-3.5 h-3.5" />} label="Email wederpartij"
          value={dossier.wederpartij_email} editable={editing}
          onChange={v => setEditForm(p => ({ ...p, wederpartij_email: v }))} />
        <InfoCard icon={<User className="w-3.5 h-3.5" />} label="Eigen advocaat"
          value={dossier.advocaat_naam} editable={editing}
          onChange={v => setEditForm(p => ({ ...p, advocaat_naam: v }))} />
        <InfoCard icon={<Gavel className="w-3.5 h-3.5" />} label="Rechtbank"
          value={dossier.rechtbank} editable={editing}
          onChange={v => setEditForm(p => ({ ...p, rechtbank: v }))} />
        <InfoCard icon={<Hash className="w-3.5 h-3.5" />} label="Zaaknummer"
          value={dossier.zaaknummer} editable={editing}
          onChange={v => setEditForm(p => ({ ...p, zaaknummer: v }))} />
        <InfoCard icon={<Euro className="w-3.5 h-3.5" />} label="Inzet bedrag"
          value={dossier.inzet_bedrag ? fmtEur(dossier.inzet_bedrag) : null}
          editable={editing} inputType="number"
          rawValue={editForm.inzet_bedrag?.toString() ?? ''}
          onChange={v => setEditForm(p => ({ ...p, inzet_bedrag: v ? parseFloat(v) : null }))} />
        <InfoCard icon={<Calendar className="w-3.5 h-3.5" />} label="Deadline"
          value={dossier.next_deadline ? `${fmt(dossier.next_deadline)}${dl !== null ? ` (${dl}d)` : ''}` : null}
          editable={editing} inputType="date"
          rawValue={editForm.next_deadline ?? ''}
          onChange={v => setEditForm(p => ({ ...p, next_deadline: v || null }))}
          highlight={dl !== null && dl <= 7 ? 'red' : dl !== null && dl <= 30 ? 'orange' : null} />
        <InfoCard icon={<Sparkles className="w-3.5 h-3.5" />} label="Directe actie"
          value={dossier.next_action} editable={editing}
          onChange={v => setEditForm(p => ({ ...p, next_action: v }))} highlight="violet" />
      </div>

      {/* Edit save bar */}
      {editing && (
        <div className="flex items-center justify-end gap-2">
          <button onClick={() => setEditing(false)}
            className="px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-xs text-white/60 hover:text-white">
            Annuleren
          </button>
          <button onClick={saveEdit} disabled={savingEdit}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-xs font-medium transition-all">
            {savingEdit ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
            Opslaan
          </button>
        </div>
      )}

      {/* ── AI samenvatting + analyse trigger ──────────────────────────────── */}
      <div className="bg-white/[0.03] border border-white/[0.07] rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Brain className="w-4 h-4 text-violet-400" />
            <span className="text-sm font-semibold text-white">AI Strategische Analyse</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => runAnalyse('snelanalyse')} disabled={analyzing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] disabled:opacity-50 text-xs text-white/70 transition-all">
              <Sparkles className="w-3.5 h-3.5" /> Snel
            </button>
            <button onClick={() => runAnalyse('volledig')} disabled={analyzing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-xs font-medium text-white transition-all">
              {analyzing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Brain className="w-3.5 h-3.5" />}
              {analyzing ? 'Analyseren...' : 'Run volledige analyse'}
            </button>
          </div>
        </div>

        {dossier.ai_summary && (
          <div>
            <span className="text-[10px] text-white/40 uppercase tracking-wider">Bestaande samenvatting</span>
            <p className="text-sm text-white/70 mt-1 whitespace-pre-wrap leading-relaxed">{dossier.ai_summary}</p>
          </div>
        )}

        {dossier.ai_risk_analysis && (
          <div>
            <span className="text-[10px] text-orange-400/70 uppercase tracking-wider">Risico analyse</span>
            <p className="text-sm text-white/70 mt-1 whitespace-pre-wrap leading-relaxed">{dossier.ai_risk_analysis}</p>
          </div>
        )}

        {analyseTxt && (
          <div className="bg-violet-500/5 border border-violet-500/20 rounded-lg p-4">
            <span className="text-[10px] text-violet-400 uppercase tracking-wider">Nieuwe analyse</span>
            <p className="text-sm text-white/80 mt-2 whitespace-pre-wrap leading-relaxed">{analyseTxt}</p>
          </div>
        )}

        {!dossier.ai_summary && !dossier.ai_risk_analysis && !analyseTxt && !analyzing && (
          <p className="text-xs text-white/30 text-center py-4">
            Nog geen AI analyse uitgevoerd. Klik op "Run volledige analyse" om strategie, risico's en sterke punten te genereren.
          </p>
        )}
      </div>

      {/* ── Centraal ingelezen documenten (DIL) ─────────────────────────── */}
      <DilDocumentsPanel dossierId={id as string} />

      {/* ── Briefing / Chat aan AI Advocaat ──────────────────────────────── */}
      <NotesPanel dossierId={id as string} />

      {/* ── Expert panel — multi-role parallel analyse ──────────────────── */}
      <ExpertPanel dossierId={id as string} />

      {/* ── Curator block (alleen als faillissement-dossier) ───────────────── */}
      {curator && (
        <div className="bg-red-500/[0.04] border border-red-500/15 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-red-400" />
              <span className="text-sm font-semibold text-white">Curator Dossier — {curator.bedrijf_naam}</span>
            </div>
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${SEVERITY_COLOR[curator.risk_level]}`}>
              RISICO {curator.risk_level.toUpperCase()}
            </span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat label="Curator" value={curator.curator_naam} />
            <Stat label="Kantoor" value={curator.curator_kantoor} />
            <Stat label="KvK" value={curator.kvk_nummer} />
            <Stat label="Insolventienr." value={curator.insolventienummer} />
            <Stat label="Failliet sinds" value={fmt(curator.faillissementsdatum)} />
            <Stat label="Boedel vordering" value={fmtEur(curator.boedel_vordering)} />
            <Stat label="Erkend" value={fmtEur(curator.erkende_vordering)} />
            <Stat label="Betwist" value={fmtEur(curator.betwiste_vordering)} />
          </div>
          {(curator.aansprakelijkheid_risk || curator.pauliana_risk) && (
            <div className="flex items-center gap-2 flex-wrap">
              {curator.aansprakelijkheid_risk && (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-red-500/10 border border-red-500/25 text-[10px] text-red-300 font-medium">
                  <AlertCircle className="w-3 h-3" /> Bestuurdersaansprakelijkheid risico
                </span>
              )}
              {curator.pauliana_risk && (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-red-500/10 border border-red-500/25 text-[10px] text-red-300 font-medium">
                  <AlertCircle className="w-3 h-3" /> Pauliana risico
                </span>
              )}
            </div>
          )}
          {curator.open_vragen && curator.open_vragen.length > 0 && (
            <div>
              <span className="text-[10px] text-white/40 uppercase tracking-wider">Open curatorvragen</span>
              <ul className="mt-1.5 space-y-1">
                {curator.open_vragen.map((v, i) => (
                  <li key={i} className="text-xs text-white/70 flex gap-2">
                    <span className="text-red-400 shrink-0">•</span> {v}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* ── 2-kolom grid: risico's + tijdlijn ──────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Risicos */}
        <div className="bg-white/[0.03] border border-white/[0.07] rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <FileWarning className="w-4 h-4 text-orange-400" />
              <span className="text-sm font-semibold text-white">Risico's</span>
              <span className="text-[10px] text-white/30">({risicos.length} open)</span>
            </div>
          </div>
          {risicos.length === 0 ? (
            <p className="text-xs text-white/30 text-center py-6">Geen open risico's gedetecteerd.</p>
          ) : (
            <div className="space-y-2">
              {visibleRisicos.map(r => (
                <div key={r.id} className="bg-white/[0.02] border border-white/[0.06] rounded-lg p-3 space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xs font-medium text-white flex-1">{r.title}</span>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border shrink-0 ${SEVERITY_COLOR[r.severity]}`}>
                      {r.severity.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-[11px] text-white/50 leading-relaxed">{r.description}</p>
                  <div className="flex items-center gap-3 flex-wrap pt-1">
                    <span className="text-[10px] text-white/30">
                      Kans: <span className="text-white/60">{r.probability}%</span>
                    </span>
                    <span className="text-[10px] text-white/30">
                      Type: <span className="text-white/60">{r.risk_type.replace(/_/g, ' ')}</span>
                    </span>
                    {r.deadline && (
                      <span className="text-[10px] text-orange-400">
                        Deadline: {fmt(r.deadline)}
                      </span>
                    )}
                  </div>
                  {r.recommended_action && (
                    <p className="text-[11px] text-violet-300/80 pt-1">→ {r.recommended_action}</p>
                  )}
                </div>
              ))}
              {risicos.length > 5 && (
                <button onClick={() => setShowAllRisicos(v => !v)}
                  className="w-full flex items-center justify-center gap-1 py-1.5 text-[10px] text-white/40 hover:text-white/70 transition-all">
                  {showAllRisicos ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  {showAllRisicos ? 'Toon minder' : `+${risicos.length - 5} meer`}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Tijdlijn */}
        <div className="bg-white/[0.03] border border-white/[0.07] rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-400" />
              <span className="text-sm font-semibold text-white">Tijdlijn</span>
              <span className="text-[10px] text-white/30">({tijdlijn.length} events)</span>
            </div>
            <Link href={`/dashboard/advocaat/tijdlijn?dossier=${id}`}
              className="text-[10px] text-blue-400/70 hover:text-blue-400 flex items-center gap-1">
              Volledig <ExternalLink className="w-3 h-3" />
            </Link>
          </div>
          {tijdlijn.length === 0 ? (
            <p className="text-xs text-white/30 text-center py-6">Nog geen tijdlijn-events.</p>
          ) : (
            <div className="space-y-2">
              {visibleTijdlijn.map(t => (
                <div key={t.id} className="flex gap-3 py-2 border-b border-white/[0.04] last:border-0">
                  <div className="shrink-0 flex flex-col items-center pt-0.5">
                    <div className={`w-2 h-2 rounded-full ${
                      t.legal_relevance === 'kritiek' ? 'bg-red-400' :
                      t.legal_relevance === 'hoog'    ? 'bg-orange-400' :
                      t.legal_relevance === 'medium'  ? 'bg-yellow-400' :
                                                        'bg-white/30'
                    }`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] text-white/40 font-mono">{fmt(t.event_date)}</span>
                      <span className={`text-[9px] px-1 py-0.5 rounded border ${DOC_LABEL_COLOR[t.source] ?? DOC_LABEL_COLOR.ONBEKEND}`}>
                        {t.source}
                      </span>
                      <span className="text-[10px] text-white/30">{t.event_type}</span>
                    </div>
                    <div className="text-xs text-white mt-0.5">{t.title}</div>
                    {t.description && t.description !== t.title && (
                      <p className="text-[11px] text-white/50 mt-0.5 leading-relaxed">{t.description}</p>
                    )}
                  </div>
                </div>
              ))}
              {tijdlijn.length > 6 && (
                <button onClick={() => setShowAllTijdlijn(v => !v)}
                  className="w-full flex items-center justify-center gap-1 py-1.5 text-[10px] text-white/40 hover:text-white/70 transition-all">
                  {showAllTijdlijn ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  {showAllTijdlijn ? 'Toon minder' : `+${tijdlijn.length - 6} meer`}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Documenten ─────────────────────────────────────────────────────── */}
      <div className="bg-white/[0.03] border border-white/[0.07] rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-violet-400" />
            <span className="text-sm font-semibold text-white">Documenten</span>
            <span className="text-[10px] text-white/30">
              ({documenten.length} totaal · {documenten.filter(d => d.is_evidence).length} bewijs)
            </span>
          </div>
          <Link href={`/dashboard/advocaat/bewijs?dossier=${id}`}
            className="text-[10px] text-violet-400/70 hover:text-violet-400 flex items-center gap-1">
            Bewijs-archief <ExternalLink className="w-3 h-3" />
          </Link>
        </div>
        {documenten.length === 0 ? (
          <div className="text-center py-8">
            <FileText className="w-8 h-8 mx-auto text-white/10 mb-2" />
            <p className="text-xs text-white/30">Nog geen documenten gekoppeld.</p>
            <Link href={`/dashboard/advocaat/imports?dossier=${id}`}
              className="inline-flex mt-2 text-[10px] text-violet-400/70 hover:text-violet-400">
              Importeer documenten →
            </Link>
          </div>
        ) : (
          <div className="space-y-1.5">
            {visibleDocumenten.map(d => (
              <div key={d.id} className="flex items-start gap-3 p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.05] hover:border-white/[0.12] transition-all">
                <FileText className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${d.is_evidence ? 'text-violet-400' : 'text-white/30'}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-white truncate">{d.title}</span>
                    <span className={`text-[9px] px-1 py-0.5 rounded border shrink-0 ${DOC_LABEL_COLOR[d.content_label] ?? DOC_LABEL_COLOR.ONBEKEND}`}>
                      {d.content_label}
                    </span>
                    {d.is_evidence && (
                      <span className="text-[9px] font-bold px-1 py-0.5 rounded bg-violet-500/15 border border-violet-500/30 text-violet-300 shrink-0">
                        BEWIJS{d.evidence_strength ? ` · ${d.evidence_strength}` : ''}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                    <span className="text-[10px] text-white/30">{d.document_type}</span>
                    {d.document_date && (
                      <span className="text-[10px] text-white/30">{fmt(d.document_date)}</span>
                    )}
                    {d.ai_risk_flags && d.ai_risk_flags.length > 0 && (
                      <span className="text-[10px] text-orange-400/70 truncate">
                        ⚠ {d.ai_risk_flags.slice(0, 3).join(' · ')}
                      </span>
                    )}
                  </div>
                  {d.ai_summary && (
                    <p className="text-[11px] text-white/50 mt-1 leading-relaxed line-clamp-2">{d.ai_summary}</p>
                  )}
                </div>
              </div>
            ))}
            {documenten.length > 8 && (
              <button onClick={() => setShowAllDocumenten(v => !v)}
                className="w-full flex items-center justify-center gap-1 py-1.5 text-[10px] text-white/40 hover:text-white/70 transition-all">
                {showAllDocumenten ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                {showAllDocumenten ? 'Toon minder' : `+${documenten.length - 8} meer`}
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Footer meta ────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-center gap-4 text-[10px] text-white/20 pt-2">
        <span>Aangemaakt {fmtDT(dossier.created_at)}</span>
        <span>·</span>
        <span>Laatst bijgewerkt {fmtDT(dossier.updated_at)}</span>
      </div>

    </div>
  )
}

// ─── Sub components ─────────────────────────────────────────────────────────

interface InfoCardProps {
  icon: React.ReactNode
  label: string
  value: string | null | undefined
  editable?: boolean
  inputType?: string
  rawValue?: string
  onChange?: (v: string) => void
  highlight?: 'red' | 'orange' | 'violet' | null
}

function InfoCard({ icon, label, value, editable, inputType = 'text', rawValue, onChange, highlight }: InfoCardProps) {
  const borderColor =
    highlight === 'red'    ? 'border-red-500/30' :
    highlight === 'orange' ? 'border-orange-500/25' :
    highlight === 'violet' ? 'border-violet-500/20' :
                             'border-white/[0.07]'
  const textColor =
    highlight === 'red'    ? 'text-red-300' :
    highlight === 'orange' ? 'text-orange-300' :
    highlight === 'violet' ? 'text-violet-300' :
                             'text-white'

  return (
    <div className={`bg-white/[0.03] border rounded-xl p-3 ${borderColor}`}>
      <div className="flex items-center gap-1.5 text-[10px] text-white/40 uppercase tracking-wider">
        {icon} {label}
      </div>
      {editable && onChange ? (
        <input type={inputType}
          value={rawValue ?? value ?? ''}
          onChange={e => onChange(e.target.value)}
          className="w-full mt-1 px-2 py-1 rounded bg-white/[0.05] border border-white/[0.08] text-sm text-white focus:outline-none focus:border-violet-500/40" />
      ) : (
        <div className={`text-sm mt-1 ${value ? textColor : 'text-white/20'} truncate`}>
          {value || '—'}
        </div>
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <div className="text-[10px] text-white/40 uppercase tracking-wider">{label}</div>
      <div className={`text-sm mt-0.5 ${value ? 'text-white' : 'text-white/20'}`}>
        {value || '—'}
      </div>
    </div>
  )
}
