'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ChevronDown, ChevronUp, Calendar, FileText, AlertTriangle } from 'lucide-react'
import ConfidenceBar from './ConfidenceBar'
import PriorityBadge from './PriorityBadge'
import CategoryBadge from './CategoryBadge'

interface MailMessage {
  id: string
  subject: string | null
  from_email: string | null
  from_name: string | null
  to_emails: string[]
  company: string | null
  category: string | null
  priority: string
  ai_summary: string | null
  ai_action_suggestion: string | null
  ai_confidence: number
  body_text: string | null
  received_at: string | null
  threat_detected: boolean
  threat_reason: string | null
  moneybird_status: string
}

interface MailContact {
  id: string
  name: string | null
  contact_type: string | null
  priority: string
  total_interactions: number
  last_interaction_at: string | null
  open_actions: number
  sentiment: string | null
}

interface MailDraft {
  id: string
  to_email: string | null
  subject: string | null
  body: string | null
  ai_reasoning: string | null
  ai_confidence: number
  status: string
  version: number
}

interface MailAttachment {
  id: string
  filename: string | null
  mime_type: string | null
  size_bytes: number | null
  document_type: string | null
  moneybird_status?: string
}

interface AgendaSuggestion {
  id: string
  proposed_at: string | null
  duration_minutes: number | null
  title: string | null
  description: string | null
  status: string
}

interface MailDetailClientProps {
  message: MailMessage
  contact: MailContact | null
  draft: MailDraft | null
  attachments: MailAttachment[]
  agendaSuggestion: AgendaSuggestion | null
}

const DOC_TYPE_BADGE: Record<string, string> = {
  factuur:      'bg-yellow-500/20 text-yellow-400',
  offerte:      'bg-blue-500/20 text-blue-400',
  contract:     'bg-purple-500/20 text-purple-400',
  bouwtekening: 'bg-teal-500/20 text-teal-400',
  overig:       'bg-white/[0.06] text-white/40',
}

function formatDateTime(str: string | null): string {
  if (!str) return 'onbekend'
  return new Date(str).toLocaleString('nl-NL', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatBytes(bytes: number | null): string {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function MailDetailClient({
  message,
  contact,
  draft,
  attachments,
  agendaSuggestion,
}: MailDetailClientProps) {
  const router = useRouter()
  const [draftBody, setDraftBody] = useState(draft?.body ?? '')
  const [draftStatus, setDraftStatus] = useState(draft?.status ?? 'pending')
  const [draftAction, setDraftAction] = useState<'idle' | 'loading' | 'done'>('idle')
  const [showReasoning, setShowReasoning] = useState(false)
  const [agendaStatus, setAgendaStatus] = useState(agendaSuggestion?.status ?? 'pending')

  async function handleDraftAction(action: 'approve' | 'reject' | 'modify') {
    if (!draft) return
    setDraftAction('loading')

    try {
      const body = action === 'modify' ? JSON.stringify({ body: draftBody }) : undefined
      const headers: Record<string, string> = action === 'modify' ? { 'Content-Type': 'application/json' } : {}

      const res = await fetch(`/api/mail/drafts/${draft.id}/${action}`, {
        method: 'POST',
        headers,
        body,
      })

      if (res.ok) {
        setDraftStatus(action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'modified')
        setDraftAction('done')
      }
    } catch {
      setDraftAction('idle')
    }
  }

  async function handleAgenda(action: 'accept' | 'reject') {
    if (!agendaSuggestion) return
    const res = await fetch(`/api/mail/agenda/${agendaSuggestion.id}/${action}`, { method: 'POST' })
    if (res.ok) setAgendaStatus(action === 'accept' ? 'accepted' : 'rejected')
  }

  return (
    <div
      className="max-w-lg mx-auto pb-6"
      style={{ paddingTop: 'calc(1rem + env(safe-area-inset-top))' }}
    >
      <div className="flex items-center gap-3 px-4 mb-5">
        <button
          onClick={() => router.back()}
          className="p-2 -ml-2 text-white/50 hover:text-white/80 transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-[14px] font-semibold text-white truncate">
            {message.subject ?? '(geen onderwerp)'}
          </h1>
          <p className="text-[11px] text-white/40 truncate">
            {message.from_name ?? message.from_email}
          </p>
        </div>
      </div>

      <div className="px-4 mb-1 text-[11px] text-white/30 space-y-0.5">
        <div>
          <span className="text-white/50">Van:</span>{' '}
          {message.from_name ? `${message.from_name} <${message.from_email}>` : message.from_email}
        </div>
        <div>
          <span className="text-white/50">Aan:</span>{' '}
          {message.to_emails.join(', ')}
        </div>
        <div>
          <span className="text-white/50">Ontvangen:</span>{' '}
          {formatDateTime(message.received_at)}
        </div>
      </div>

      <div className="mx-4 mt-4 mb-5 p-4 bg-[#0d0d1a] rounded-2xl border border-white/[0.08] space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <PriorityBadge priority={message.priority} />
          <CategoryBadge category={message.category} />
          {message.company && (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/[0.06] text-white/50">
              {message.company}
            </span>
          )}
          {message.threat_detected && (
            <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-500/20 text-red-400">
              <AlertTriangle size={10} />
              Threat
            </span>
          )}
        </div>

        {message.ai_summary && (
          <p className="text-[12px] text-white/70 leading-relaxed">{message.ai_summary}</p>
        )}

        {message.ai_action_suggestion && (
          <div className="p-2.5 bg-indigo-500/10 border border-indigo-500/20 rounded-xl">
            <p className="text-[11px] text-indigo-300 font-medium">Actie:</p>
            <p className="text-[12px] text-indigo-200 mt-0.5">{message.ai_action_suggestion}</p>
          </div>
        )}

        <ConfidenceBar value={message.ai_confidence} label="AI zekerheid" />

        {message.threat_detected && message.threat_reason && (
          <div className="p-2.5 bg-red-500/10 border border-red-500/20 rounded-xl">
            <p className="text-[11px] text-red-400 font-medium">Dreigingsreden:</p>
            <p className="text-[12px] text-red-300 mt-0.5">{message.threat_reason}</p>
          </div>
        )}
      </div>

      {message.body_text && (
        <div className="mx-4 mb-5">
          <p className="text-[10px] text-white/30 uppercase tracking-wider mb-2">Inhoud</p>
          <div className="p-4 bg-[#0d0d1a] rounded-2xl border border-white/[0.08]">
            <pre className="text-[12px] text-white/70 leading-relaxed whitespace-pre-wrap font-sans break-words">
              {message.body_text.trim()}
            </pre>
          </div>
        </div>
      )}

      {attachments.length > 0 && (
        <div className="mx-4 mb-5">
          <p className="text-[10px] text-white/30 uppercase tracking-wider mb-2">
            Bijlagen ({attachments.length})
          </p>
          <div className="space-y-2">
            {attachments.map(att => (
              <div
                key={att.id}
                className="flex items-center gap-3 p-3 bg-[#0d0d1a] rounded-xl border border-white/[0.08]"
              >
                <FileText size={16} className="text-white/30 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] text-white/80 truncate">{att.filename ?? 'onbekend'}</p>
                  {att.size_bytes && (
                    <p className="text-[10px] text-white/30">{formatBytes(att.size_bytes)}</p>
                  )}
                </div>
                {att.document_type && (
                  <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded ${DOC_TYPE_BADGE[att.document_type] ?? DOC_TYPE_BADGE.overig}`}>
                    {att.document_type}
                  </span>
                )}
                {message.moneybird_status === 'uploaded' && att.document_type === 'factuur' && (
                  <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400">
                    Ingeboekt
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {draft && (
        <div className="mx-4 mb-5">
          <p className="text-[10px] text-white/30 uppercase tracking-wider mb-2">AI Concept Antwoord</p>
          <div className="bg-[#0d0d1a] rounded-2xl border border-white/[0.08] overflow-hidden">
            <div className="p-3 border-b border-white/[0.06]">
              <p className="text-[11px] text-white/40">
                Aan: {draft.to_email} · Versie {draft.version}
              </p>
              <p className="text-[12px] text-white/70 font-medium mt-0.5">{draft.subject}</p>
            </div>

            <div className="p-3">
              {draftStatus === 'pending' || draftStatus === 'modified' ? (
                <textarea
                  value={draftBody}
                  onChange={e => setDraftBody(e.target.value)}
                  rows={8}
                  className="w-full bg-transparent text-[12px] text-white/75 leading-relaxed resize-none outline-none placeholder:text-white/20"
                  placeholder="Concept antwoord..."
                />
              ) : (
                <pre className="text-[12px] text-white/50 leading-relaxed whitespace-pre-wrap font-sans">
                  {draftBody}
                </pre>
              )}
            </div>

            <div className="px-3 pb-3">
              <ConfidenceBar value={draft.ai_confidence} label="AI zekerheid" />
            </div>

            {draft.ai_reasoning && (
              <div className="px-3 pb-3">
                <button
                  onClick={() => setShowReasoning(s => !s)}
                  className="flex items-center gap-1 text-[11px] text-white/35 hover:text-white/55 transition-colors"
                >
                  {showReasoning ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  Redenering AI
                </button>
                {showReasoning && (
                  <p className="mt-2 text-[11px] text-white/40 leading-relaxed">{draft.ai_reasoning}</p>
                )}
              </div>
            )}

            {(draftStatus === 'pending' || draftStatus === 'modified') && (
              <div className="flex border-t border-white/[0.06]">
                <button
                  onClick={() => handleDraftAction('approve')}
                  disabled={draftAction === 'loading'}
                  className="flex-1 py-3 text-[12px] font-semibold text-emerald-400 hover:bg-emerald-500/10 transition-colors disabled:opacity-40"
                >
                  Verzenden
                </button>
                <div className="w-px bg-white/[0.06]" />
                <button
                  onClick={() => handleDraftAction('modify')}
                  disabled={draftAction === 'loading'}
                  className="flex-1 py-3 text-[12px] font-semibold text-indigo-400 hover:bg-indigo-500/10 transition-colors disabled:opacity-40"
                >
                  Aanpassen
                </button>
                <div className="w-px bg-white/[0.06]" />
                <button
                  onClick={() => handleDraftAction('reject')}
                  disabled={draftAction === 'loading'}
                  className="flex-1 py-3 text-[12px] font-semibold text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-40"
                >
                  Weigeren
                </button>
              </div>
            )}

            {draftStatus === 'approved' && (
              <div className="p-3 text-center text-[12px] text-emerald-400 font-medium">
                Verstuurd
              </div>
            )}

            {draftStatus === 'rejected' && (
              <div className="p-3 text-center text-[12px] text-white/30">
                Geweigerd
              </div>
            )}

            {draftStatus === 'sent' && (
              <div className="p-3 text-center text-[12px] text-emerald-400">
                Verzonden
              </div>
            )}
          </div>
        </div>
      )}

      {agendaSuggestion && agendaStatus === 'pending' && (
        <div className="mx-4 mb-5">
          <p className="text-[10px] text-white/30 uppercase tracking-wider mb-2">Agenda Suggestie</p>
          <div className="p-4 bg-[#0d0d1a] rounded-2xl border border-white/[0.08]">
            <div className="flex items-start gap-3 mb-3">
              <Calendar size={16} className="text-indigo-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-[13px] font-semibold text-white">{agendaSuggestion.title}</p>
                {agendaSuggestion.proposed_at && (
                  <p className="text-[11px] text-white/50 mt-0.5">
                    {formatDateTime(agendaSuggestion.proposed_at)}
                    {agendaSuggestion.duration_minutes && ` · ${agendaSuggestion.duration_minutes} min`}
                  </p>
                )}
                {agendaSuggestion.description && (
                  <p className="text-[11px] text-white/40 mt-1">{agendaSuggestion.description}</p>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleAgenda('accept')}
                className="flex-1 py-2 text-[12px] font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition-colors"
              >
                Accepteren
              </button>
              <button
                onClick={() => handleAgenda('reject')}
                className="flex-1 py-2 text-[12px] font-semibold bg-white/[0.06] hover:bg-white/[0.1] text-white/60 rounded-xl transition-colors"
              >
                Weigeren
              </button>
            </div>
          </div>
        </div>
      )}

      {agendaSuggestion && agendaStatus !== 'pending' && (
        <div className="mx-4 mb-5 p-3 bg-[#0d0d1a] rounded-2xl border border-white/[0.08] text-center">
          <p className="text-[12px] text-white/40">
            Agenda suggestie {agendaStatus === 'accepted' ? 'geaccepteerd' : 'geweigerd'}
          </p>
        </div>
      )}

      {contact && (
        <div className="mx-4 mb-5">
          <p className="text-[10px] text-white/30 uppercase tracking-wider mb-2">Contact geheugen</p>
          <div className="p-4 bg-[#0d0d1a] rounded-2xl border border-white/[0.08] space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-white/40">Naam</span>
              <span className="text-[12px] text-white/80">{contact.name ?? message.from_email}</span>
            </div>
            {contact.contact_type && (
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-white/40">Type</span>
                <span className="text-[12px] text-white/70 capitalize">{contact.contact_type}</span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-white/40">Prioriteit</span>
              <PriorityBadge priority={contact.priority} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-white/40">Interacties</span>
              <span className="text-[12px] text-white/70">{contact.total_interactions}</span>
            </div>
            {contact.open_actions > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-white/40">Open acties</span>
                <span className="text-[12px] text-red-400 font-semibold">{contact.open_actions}</span>
              </div>
            )}
            {contact.last_interaction_at && (
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-white/40">Laatste contact</span>
                <span className="text-[11px] text-white/50">
                  {new Date(contact.last_interaction_at).toLocaleDateString('nl-NL')}
                </span>
              </div>
            )}
            {contact.sentiment && (
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-white/40">Sentiment</span>
                <span className={`text-[11px] font-medium ${
                  contact.sentiment === 'positive' ? 'text-emerald-400' :
                  contact.sentiment === 'negative' ? 'text-red-400' : 'text-white/50'
                }`}>
                  {contact.sentiment}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
