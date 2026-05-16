'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Send, X, ChevronDown, ChevronUp, RefreshCw, Pencil } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import ConfidenceBar from './ConfidenceBar'

type MailMessage = {
  id: string
  subject: string | null
  from_email: string | null
  from_name: string | null
  company: string | null
  category: string | null
  priority: string
  received_at: string | null
  provider: string | null
}

type Draft = {
  id: string
  message_id: string | null
  to_email: string | null
  subject: string | null
  body: string | null
  status: string
  ai_reasoning: string | null
  ai_confidence: number
  version: number
  created_at: string
  mail_messages: MailMessage | null
}

type DraftAction = 'idle' | 'loading' | 'done'

const PRIORITY_COLOR: Record<string, string> = {
  urgent: 'text-red-400',
  high:   'text-orange-400',
  normal: 'text-white/50',
  low:    'text-white/30',
}

const COMPANY_BADGE: Record<string, string> = {
  STRKBOUW:     'bg-blue-500/15 text-blue-400',
  STRKBEHEER:   'bg-purple-500/15 text-purple-400',
  BOUWPROFFS:   'bg-amber-500/15 text-amber-400',
  INTELLIGENCE: 'bg-teal-500/15 text-teal-400',
  YOUTUBE:      'bg-red-500/15 text-red-400',
  PRIVÉ:        'bg-white/[0.06] text-white/40',
}

function relativeTime(str: string): string {
  const diff = Date.now() - new Date(str).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'zojuist'
  if (m < 60) return `${m}m geleden`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}u geleden`
  return `${Math.floor(h / 24)}d geleden`
}

function DraftCard({ draft, onUpdate }: { draft: Draft; onUpdate: (id: string, status: string) => void }) {
  const [expanded, setExpanded] = useState(false)
  const [editing, setEditing] = useState(false)
  const [body, setBody] = useState(draft.body ?? '')
  const [action, setAction] = useState<DraftAction>('idle')
  const [showReasoning, setShowReasoning] = useState(false)

  const msg = draft.mail_messages

  async function doAction(type: 'approve' | 'reject' | 'modify') {
    setAction('loading')
    try {
      const res = await fetch(`/api/mail/drafts/${draft.id}/${type}`, {
        method: 'POST',
        headers: type === 'modify' ? { 'Content-Type': 'application/json' } : {},
        body: type === 'modify' ? JSON.stringify({ body }) : undefined,
      })
      if (res.ok) {
        if (type === 'approve') onUpdate(draft.id, 'approved')
        else if (type === 'reject') onUpdate(draft.id, 'rejected')
        else { onUpdate(draft.id, 'modified'); setEditing(false) }
        setAction('done')
      } else {
        setAction('idle')
      }
    } catch {
      setAction('idle')
    }
  }

  return (
    <div className="bg-[#0d0d1a] border border-white/[0.08] rounded-2xl overflow-hidden mb-3 mx-4">
      {/* Header */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full text-left p-4"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              {msg?.company && (
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${COMPANY_BADGE[msg.company] ?? COMPANY_BADGE.PRIVÉ}`}>
                  {msg.company}
                </span>
              )}
              {msg?.priority && (
                <span className={`text-[9px] font-medium ${PRIORITY_COLOR[msg.priority] ?? 'text-white/40'}`}>
                  {msg.priority.toUpperCase()}
                </span>
              )}
              <span className="text-[9px] text-white/25 ml-auto">{relativeTime(draft.created_at)}</span>
            </div>
            <p className="text-[13px] font-semibold text-white truncate">
              {draft.subject ?? '(geen onderwerp)'}
            </p>
            <p className="text-[11px] text-white/40 truncate mt-0.5">
              Aan: {draft.to_email} · v{draft.version}
            </p>
            {msg?.from_name || msg?.from_email ? (
              <p className="text-[10px] text-white/25 truncate mt-0.5">
                Van: {msg.from_name ?? msg.from_email}
              </p>
            ) : null}
          </div>
          <div className="flex-shrink-0 text-white/30 mt-1">
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </div>
        </div>

        <div className="mt-2">
          <ConfidenceBar value={draft.ai_confidence} label="AI zekerheid" />
        </div>
      </button>

      {/* Expanded body */}
      {expanded && (
        <div className="border-t border-white/[0.06]">
          <div className="p-4">
            {editing ? (
              <textarea
                value={body}
                onChange={e => setBody(e.target.value)}
                rows={10}
                autoFocus
                className="w-full bg-[#13131f] border border-white/[0.1] rounded-xl px-3 py-2.5 text-[12px] text-white/80 leading-relaxed resize-none outline-none focus:border-indigo-500/40"
              />
            ) : (
              <pre className="text-[12px] text-white/65 leading-relaxed whitespace-pre-wrap font-sans break-words">
                {body}
              </pre>
            )}
          </div>

          {draft.ai_reasoning && (
            <div className="px-4 pb-3">
              <button
                onClick={() => setShowReasoning(s => !s)}
                className="flex items-center gap-1 text-[11px] text-white/30 hover:text-white/50 transition-colors"
              >
                {showReasoning ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                Redenering AI
              </button>
              {showReasoning && (
                <p className="mt-1.5 text-[11px] text-white/35 leading-relaxed">{draft.ai_reasoning}</p>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex border-t border-white/[0.06]">
            {editing ? (
              <>
                <button
                  onClick={() => doAction('modify')}
                  disabled={action === 'loading'}
                  className="flex-1 py-3 flex items-center justify-center gap-1.5 text-[12px] font-semibold text-indigo-400 hover:bg-indigo-500/10 transition-colors disabled:opacity-40"
                >
                  <RefreshCw size={12} className={action === 'loading' ? 'animate-spin' : ''} />
                  Opslaan
                </button>
                <div className="w-px bg-white/[0.06]" />
                <button
                  onClick={() => { setEditing(false); setBody(draft.body ?? '') }}
                  className="flex-1 py-3 text-[12px] font-semibold text-white/40 hover:bg-white/[0.04] transition-colors"
                >
                  Annuleren
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => doAction('approve')}
                  disabled={action === 'loading'}
                  className="flex-1 py-3 flex items-center justify-center gap-1.5 text-[12px] font-semibold text-emerald-400 hover:bg-emerald-500/10 transition-colors disabled:opacity-40"
                >
                  <Send size={12} />
                  Verzenden
                </button>
                <div className="w-px bg-white/[0.06]" />
                <button
                  onClick={() => setEditing(true)}
                  disabled={action === 'loading'}
                  className="flex-1 py-3 flex items-center justify-center gap-1.5 text-[12px] font-semibold text-indigo-400 hover:bg-indigo-500/10 transition-colors disabled:opacity-40"
                >
                  <Pencil size={12} />
                  Bewerken
                </button>
                <div className="w-px bg-white/[0.06]" />
                <button
                  onClick={() => doAction('reject')}
                  disabled={action === 'loading'}
                  className="flex-1 py-3 flex items-center justify-center gap-1.5 text-[12px] font-semibold text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-40"
                >
                  <X size={12} />
                  Weigeren
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default function DraftsClient({
  initialDrafts,
  pendingCount,
}: {
  initialDrafts: Draft[]
  pendingCount: number
}) {
  const router = useRouter()
  const [drafts, setDrafts] = useState<Draft[]>(initialDrafts)

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel('mail_drafts_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mail_drafts' }, payload => {
        if (payload.eventType === 'INSERT') {
          setDrafts(prev => [payload.new as Draft, ...prev])
        } else if (payload.eventType === 'UPDATE') {
          const updated = payload.new as Draft
          if (['approved', 'rejected', 'sent'].includes(updated.status)) {
            setDrafts(prev => prev.filter(d => d.id !== updated.id))
          } else {
            setDrafts(prev => prev.map(d => d.id === updated.id ? { ...d, ...updated } : d))
          }
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  function handleUpdate(id: string, status: string) {
    if (['approved', 'rejected', 'sent'].includes(status)) {
      setDrafts(prev => prev.filter(d => d.id !== id))
    } else {
      setDrafts(prev => prev.map(d => d.id === id ? { ...d, status } : d))
    }
  }

  const pending = drafts.filter(d => d.status === 'pending' || d.status === 'modified')
  const sandbox = drafts.filter(d => d.status === 'sandbox')

  return (
    <div
      className="max-w-lg mx-auto pb-8"
      style={{ paddingTop: 'calc(1rem + env(safe-area-inset-top))' }}
    >
      {/* Header */}
      <div className="px-4 mb-5">
        <div className="flex items-center gap-3 mb-1">
          <button
            onClick={() => router.back()}
            className="p-2 -ml-2 text-white/50 hover:text-white/80 transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-white">Concepten</h1>
              {pending.length > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-indigo-500 text-white text-[10px] font-bold">
                  {pending.length}
                </span>
              )}
            </div>
            <p className="text-[11px] text-white/30">
              AI antwoorden wachten op goedkeuring
            </p>
          </div>
        </div>
      </div>

      {drafts.length === 0 ? (
        <div className="py-20 text-center text-white/25 text-sm">
          Geen concepten
        </div>
      ) : (
        <>
          {pending.length > 0 && (
            <div className="mb-1">
              <p className="text-[10px] text-white/30 uppercase tracking-wider px-4 mb-2">
                Wacht op goedkeuring ({pending.length})
              </p>
              {pending.map(d => (
                <DraftCard key={d.id} draft={d} onUpdate={handleUpdate} />
              ))}
            </div>
          )}

          {sandbox.length > 0 && (
            <div className="mb-1">
              <p className="text-[10px] text-white/30 uppercase tracking-wider px-4 mb-2 mt-4">
                Sandbox preview ({sandbox.length})
              </p>
              {sandbox.map(d => (
                <DraftCard key={d.id} draft={d} onUpdate={handleUpdate} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
