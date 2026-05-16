'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, AlertTriangle, Shield, Clock, Scale, FileText,
  ChevronDown, ChevronUp, Edit3, CheckCircle, XCircle, Send,
  Building2, Euro, Hash, BookOpen, Target, Calendar,
} from 'lucide-react'

type Dossier = {
  id: string
  message_id: string
  party_name: string
  party_domain: string | null
  legal_type: string
  company: string | null
  risk_level: string
  legal_basis: string | null
  claim_amount: number | null
  status: string
  ai_analysis: string | null
  ai_strategy: string | null
  ai_confidence: number
  reference: string | null
  created_at: string
  mail_messages: {
    subject: string | null
    received_at: string | null
    from_email: string | null
    from_name: string | null
    body_text: string | null
    company: string | null
  } | null
}

type Deadline = {
  id: string
  title: string
  deadline_at: string
  type: string
  status: string
}

type Draft = {
  id: string
  body: string
  subject: string | null
  status: string
  ai_confidence: number | null
  ai_reasoning: string | null
  to_email: string | null
}

const RISK_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  critical: { label: 'KRITIEK',  color: 'text-red-400',     bg: 'bg-red-500/10',      border: 'border-red-500/30' },
  high:     { label: 'HOOG',     color: 'text-orange-400',  bg: 'bg-orange-500/10',   border: 'border-orange-500/25' },
  medium:   { label: 'MEDIUM',   color: 'text-yellow-400',  bg: 'bg-yellow-500/8',    border: 'border-white/[0.08]' },
  low:      { label: 'LAAG',     color: 'text-emerald-400', bg: 'bg-[#0d0d1a]',       border: 'border-white/[0.08]' },
}

const LEGAL_TYPE_LABEL: Record<string, string> = {
  dagvaarding: 'Dagvaarding', sommatiebrief: 'Sommatiebrief',
  ingebrekestelling: 'Ingebrekestelling', faillissement: 'Faillissement',
  curator: 'Curator', incasso: 'Incasso', bezwaar: 'Bezwaar',
  vonnis: 'Vonnis', hoger_beroep: 'Hoger Beroep', overig: 'Overig',
}

const DEADLINE_TYPE_LABEL: Record<string, string> = {
  reactietermijn: 'Reactietermijn', beroepstermijn: 'Beroepstermijn',
  betalingstermijn: 'Betalingstermijn', zitting: 'Zitting', overig: 'Overig',
}

function daysUntil(date: string): number {
  return Math.ceil((new Date(date).getTime() - Date.now()) / 86400000)
}

function formatDate(str: string): string {
  return new Date(str).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })
}

function formatShort(str: string): string {
  return new Date(str).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function LegalDossierDetailClient({
  dossier,
  deadlines,
  draft,
}: {
  dossier: Dossier
  deadlines: Deadline[]
  draft: Draft | null
}) {
  const router = useRouter()
  const risk = RISK_CONFIG[dossier.risk_level] ?? RISK_CONFIG.medium

  const [showOriginal, setShowOriginal] = useState(false)
  const [showStrategy, setShowStrategy] = useState(true)
  const [draftBody, setDraftBody] = useState(draft?.body ?? '')
  const [editingDraft, setEditingDraft] = useState(false)
  const [draftSending, setDraftSending] = useState(false)
  const [draftStatus, setDraftStatus] = useState<'idle' | 'sent' | 'rejected'>(
    draft?.status === 'sandbox' ? 'idle' : 'idle'
  )
  const [dossierStatus, setDossierStatus] = useState(dossier.status)
  const [updatingStatus, setUpdatingStatus] = useState(false)

  async function approveDraft() {
    if (!draft) return
    setDraftSending(true)
    try {
      const body = editingDraft ? draftBody : undefined
      const method = body ? 'modify' : 'approve'
      if (body) {
        await fetch(`/api/mail/drafts/${draft.id}/modify`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ body }),
        })
        await fetch(`/api/mail/drafts/${draft.id}/approve`, { method: 'POST' })
      } else {
        await fetch(`/api/mail/drafts/${draft.id}/approve`, { method: 'POST' })
      }
      setDraftStatus('sent')
      setEditingDraft(false)
    } finally {
      setDraftSending(false)
    }
  }

  async function rejectDraft() {
    if (!draft) return
    setDraftSending(true)
    try {
      await fetch(`/api/mail/drafts/${draft.id}/reject`, { method: 'POST' })
      setDraftStatus('rejected')
    } finally {
      setDraftSending(false)
    }
  }

  async function updateDossierStatus(newStatus: string) {
    setUpdatingStatus(true)
    try {
      await fetch(`/api/mail/legal/${dossier.id}/status`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      setDossierStatus(newStatus)
    } finally {
      setUpdatingStatus(false)
    }
  }

  const urgentDeadlines = deadlines.filter(d => daysUntil(d.deadline_at) <= 7 && d.status === 'open')

  return (
    <div className="max-w-lg mx-auto pb-12" style={{ paddingTop: 'calc(1rem + env(safe-area-inset-top))' }}>
      {/* Header */}
      <div className="px-4 mb-4">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => router.back()} className="p-2 -ml-2 text-white/50 hover:text-white/80 transition-colors">
            <ArrowLeft size={20} />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <Scale size={16} className="text-indigo-400 flex-shrink-0" />
              <h1 className="text-base font-bold text-white truncate">{dossier.party_name}</h1>
            </div>
            <p className="text-[10px] text-white/30">
              {LEGAL_TYPE_LABEL[dossier.legal_type] ?? dossier.legal_type} · {formatShort(dossier.created_at)}
            </p>
          </div>
          <span className={`flex-shrink-0 text-[10px] font-bold px-2 py-1 rounded-lg border ${risk.color} ${risk.bg} ${risk.border}`}>
            {risk.label}
          </span>
        </div>

        {/* Urgent deadline banner */}
        {urgentDeadlines.length > 0 && (
          <div className="mb-3 p-3 bg-red-500/10 border border-red-500/25 rounded-xl">
            <div className="flex items-center gap-2 mb-1">
              <Clock size={13} className="text-red-400" />
              <p className="text-[11px] font-bold text-red-400">TERMIJN NADERT</p>
            </div>
            {urgentDeadlines.map(d => {
              const days = daysUntil(d.deadline_at)
              return (
                <p key={d.id} className="text-[11px] text-orange-300 ml-5">
                  {d.title} — {days <= 0 ? 'VERLOPEN' : days === 1 ? 'morgen' : `${days} dagen`} ({formatShort(d.deadline_at)})
                </p>
              )
            })}
          </div>
        )}
      </div>

      {/* Meta cards */}
      <div className="px-4 grid grid-cols-2 gap-2 mb-3">
        {dossier.claim_amount != null && (
          <div className="col-span-2 p-3 bg-red-500/8 border border-red-500/20 rounded-xl flex items-center gap-2">
            <Euro size={14} className="text-red-400" />
            <div>
              <p className="text-[9px] text-white/30">Claim bedrag</p>
              <p className="text-[15px] font-bold text-red-400">
                € {dossier.claim_amount.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        )}

        {dossier.company && (
          <div className="p-3 bg-white/[0.04] border border-white/[0.06] rounded-xl">
            <div className="flex items-center gap-1.5 mb-0.5">
              <Building2 size={11} className="text-white/30" />
              <p className="text-[9px] text-white/30">Bedrijf</p>
            </div>
            <p className="text-[12px] font-semibold text-white">{dossier.company}</p>
          </div>
        )}

        {dossier.reference && (
          <div className="p-3 bg-white/[0.04] border border-white/[0.06] rounded-xl">
            <div className="flex items-center gap-1.5 mb-0.5">
              <Hash size={11} className="text-white/30" />
              <p className="text-[9px] text-white/30">Referentie</p>
            </div>
            <p className="text-[12px] font-medium text-white truncate">{dossier.reference}</p>
          </div>
        )}

        {dossier.legal_basis && (
          <div className="col-span-2 p-3 bg-white/[0.04] border border-white/[0.06] rounded-xl">
            <div className="flex items-center gap-1.5 mb-1">
              <BookOpen size={11} className="text-indigo-400" />
              <p className="text-[9px] text-white/30">Juridische grondslag</p>
            </div>
            <p className="text-[11px] text-white/70">{dossier.legal_basis}</p>
          </div>
        )}

        {/* Confidence */}
        <div className="col-span-2 p-3 bg-white/[0.04] border border-white/[0.06] rounded-xl">
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-[9px] text-white/30">AI Betrouwbaarheid</p>
            <p className="text-[11px] font-bold text-white">{Math.round(dossier.ai_confidence * 100)}%</p>
          </div>
          <div className="h-1 bg-white/[0.08] rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                dossier.ai_confidence >= 0.8 ? 'bg-emerald-400' :
                dossier.ai_confidence >= 0.5 ? 'bg-yellow-400' : 'bg-red-400'
              }`}
              style={{ width: `${dossier.ai_confidence * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Deadlines */}
      {deadlines.length > 0 && (
        <div className="px-4 mb-3">
          <p className="text-[10px] font-semibold text-white/40 uppercase tracking-wider mb-2">Termijnen</p>
          <div className="space-y-2">
            {deadlines.map(d => {
              const days = daysUntil(d.deadline_at)
              const urgentColor = days <= 2 ? 'text-red-400' : days <= 7 ? 'text-orange-400' : 'text-white/50'
              const done = d.status !== 'open'
              return (
                <div key={d.id} className={`flex items-center gap-3 p-3 rounded-xl border ${
                  done ? 'bg-white/[0.02] border-white/[0.04] opacity-50' : 'bg-[#0d0d1a] border-white/[0.08]'
                }`}>
                  <Clock size={13} className={done ? 'text-white/25' : urgentColor} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] text-white/80">{d.title}</p>
                    <p className="text-[9px] text-white/30">
                      {DEADLINE_TYPE_LABEL[d.type] ?? d.type}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    {done ? (
                      <p className="text-[10px] text-white/25">Afgerond</p>
                    ) : (
                      <>
                        <p className={`text-[11px] font-bold ${urgentColor}`}>
                          {days === 0 ? 'VANDAAG' : days < 0 ? `${Math.abs(days)}d verlopen` : `${days}d`}
                        </p>
                        <p className="text-[9px] text-white/30">{formatShort(d.deadline_at)}</p>
                      </>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* AI Strategie */}
      <div className="px-4 mb-3">
        <button
          onClick={() => setShowStrategy(s => !s)}
          className="w-full flex items-center justify-between mb-2"
        >
          <div className="flex items-center gap-1.5">
            <Target size={13} className="text-indigo-400" />
            <p className="text-[10px] font-semibold text-white/40 uppercase tracking-wider">Aanbevolen Strategie</p>
          </div>
          {showStrategy ? <ChevronUp size={14} className="text-white/30" /> : <ChevronDown size={14} className="text-white/30" />}
        </button>
        {showStrategy && dossier.ai_strategy && (
          <div className="p-3 bg-indigo-500/8 border border-indigo-500/20 rounded-xl">
            <p className="text-[11px] text-white/70 whitespace-pre-wrap leading-relaxed">{dossier.ai_strategy}</p>
          </div>
        )}
      </div>

      {/* AI Analyse */}
      {dossier.ai_analysis && (
        <div className="px-4 mb-3">
          <div className="flex items-center gap-1.5 mb-2">
            <Shield size={13} className="text-emerald-400" />
            <p className="text-[10px] font-semibold text-white/40 uppercase tracking-wider">Juridische Analyse</p>
          </div>
          <div className="p-3 bg-white/[0.03] border border-white/[0.06] rounded-xl">
            <p className="text-[11px] text-white/65 whitespace-pre-wrap leading-relaxed">{dossier.ai_analysis}</p>
          </div>
        </div>
      )}

      {/* Concept Antwoord */}
      {draft && (
        <div className="px-4 mb-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <Send size={13} className="text-amber-400" />
              <p className="text-[10px] font-semibold text-white/40 uppercase tracking-wider">Concept Antwoord</p>
            </div>
            {draftStatus === 'idle' && (
              <button
                onClick={() => setEditingDraft(e => !e)}
                className="flex items-center gap-1 text-[10px] text-white/40 hover:text-white/70 transition-colors"
              >
                <Edit3 size={11} />
                {editingDraft ? 'Annuleer' : 'Bewerken'}
              </button>
            )}
          </div>

          {draftStatus === 'sent' ? (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/25 rounded-xl text-center">
              <CheckCircle size={20} className="text-emerald-400 mx-auto mb-1" />
              <p className="text-[12px] text-emerald-400 font-medium">Concept goedgekeurd</p>
              <p className="text-[10px] text-white/30 mt-0.5">Naar Mailtrap sandbox gestuurd</p>
            </div>
          ) : draftStatus === 'rejected' ? (
            <div className="p-3 bg-white/[0.03] border border-white/[0.06] rounded-xl text-center">
              <XCircle size={20} className="text-white/30 mx-auto mb-1" />
              <p className="text-[11px] text-white/40">Concept afgewezen</p>
            </div>
          ) : (
            <>
              {draft.to_email && (
                <p className="text-[10px] text-white/30 mb-1.5">Aan: {draft.to_email}</p>
              )}

              <div className={`p-3 border rounded-xl mb-2 ${editingDraft ? 'border-indigo-500/40 bg-indigo-500/5' : 'border-white/[0.08] bg-white/[0.03]'}`}>
                {editingDraft ? (
                  <textarea
                    value={draftBody}
                    onChange={e => setDraftBody(e.target.value)}
                    rows={10}
                    className="w-full bg-transparent text-[11px] text-white/80 leading-relaxed outline-none resize-none"
                  />
                ) : (
                  <p className="text-[11px] text-white/70 whitespace-pre-wrap leading-relaxed">{draftBody}</p>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={rejectDraft}
                  disabled={draftSending}
                  className="flex-1 py-2 bg-white/[0.05] border border-white/[0.08] rounded-xl text-[11px] text-white/50 hover:text-white/70 transition-colors disabled:opacity-40"
                >
                  Afwijzen
                </button>
                <button
                  onClick={approveDraft}
                  disabled={draftSending}
                  className="flex-1 py-2 bg-amber-500/20 border border-amber-500/30 rounded-xl text-[11px] text-amber-300 font-medium hover:bg-amber-500/30 transition-colors disabled:opacity-40 flex items-center justify-center gap-1"
                >
                  {draftSending ? (
                    <span className="animate-pulse">Verwerken...</span>
                  ) : (
                    <>
                      <Send size={11} />
                      {editingDraft ? 'Opslaan & Goedkeuren' : 'Goedkeuren'}
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Originele mail */}
      {dossier.mail_messages?.body_text && (
        <div className="px-4 mb-3">
          <button
            onClick={() => setShowOriginal(s => !s)}
            className="w-full flex items-center justify-between mb-2"
          >
            <div className="flex items-center gap-1.5">
              <FileText size={13} className="text-white/30" />
              <p className="text-[10px] font-semibold text-white/40 uppercase tracking-wider">Originele Mail</p>
            </div>
            {showOriginal ? <ChevronUp size={14} className="text-white/30" /> : <ChevronDown size={14} className="text-white/30" />}
          </button>
          {showOriginal && (
            <div className="p-3 bg-white/[0.02] border border-white/[0.05] rounded-xl">
              <div className="mb-2 pb-2 border-b border-white/[0.06]">
                <p className="text-[10px] text-white/30">
                  Van: {dossier.mail_messages.from_name ?? dossier.mail_messages.from_email}
                </p>
                {dossier.mail_messages.received_at && (
                  <p className="text-[10px] text-white/20">{formatDate(dossier.mail_messages.received_at)}</p>
                )}
              </div>
              <p className="text-[10px] text-white/50 whitespace-pre-wrap leading-relaxed line-clamp-20">
                {dossier.mail_messages.body_text}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Status actions */}
      <div className="px-4">
        <p className="text-[10px] font-semibold text-white/40 uppercase tracking-wider mb-2">Dossier Status</p>
        <div className="grid grid-cols-3 gap-2">
          {(['open', 'in_behandeling', 'gesloten'] as const).map(s => (
            <button
              key={s}
              onClick={() => updateDossierStatus(s)}
              disabled={updatingStatus || dossierStatus === s}
              className={`py-2 rounded-xl text-[10px] font-medium transition-colors border ${
                dossierStatus === s
                  ? 'bg-indigo-600/30 border-indigo-500/50 text-indigo-300'
                  : 'bg-white/[0.04] border-white/[0.06] text-white/40 hover:text-white/60'
              } disabled:opacity-60`}
            >
              {s === 'open' ? 'Open' : s === 'in_behandeling' ? 'In behandeling' : 'Gesloten'}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
