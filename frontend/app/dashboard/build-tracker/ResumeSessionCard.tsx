'use client'

import Link from 'next/link'
import { useEffect, useState, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRealtimeChannel } from '@/lib/realtime'
import {
  PlayCircle,
  Clock,
  AlertTriangle,
  Copy,
  Check,
  Pause,
  Play,
  Square,
  Trash2,
  X,
  ExternalLink,
  RefreshCw,
} from 'lucide-react'
import { setSessionStatus, stopSession, archiveSession } from '../osm/actions'

type Session = {
  id: string
  machine_id: string
  entity: string
  worktree_path: string | null
  git_branch: string | null
  last_commit_sha: string | null
  last_prompt: string | null
  last_response_summary: string | null
  status: 'active' | 'crashed' | 'context_full' | 'done' | 'paused'
  updated_at: string
  tmux_session: string | null
  tmux_window: string | null
  archived_at: string | null
}

const STATUS_STYLE: Record<Session['status'], { label: string; color: string }> = {
  active:       { label: 'Actief',      color: 'text-emerald-400 bg-emerald-500/10' },
  paused:       { label: 'Gepauzeerd',  color: 'text-amber-400 bg-amber-500/10' },
  context_full: { label: 'Context vol', color: 'text-orange-400 bg-orange-500/10' },
  crashed:      { label: 'Crashed',     color: 'text-red-400 bg-red-500/10' },
  done:         { label: 'Klaar',       color: 'text-white/40 bg-white/5' },
}

const SELECT_COLS =
  'id, machine_id, entity, worktree_path, git_branch, last_commit_sha, last_prompt, last_response_summary, status, updated_at, tmux_session, tmux_window, archived_at'

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return `${s}s`
  if (s < 3600) return `${Math.floor(s / 60)}m`
  if (s < 86400) return `${Math.floor(s / 3600)}u`
  return `${Math.floor(s / 86400)}d`
}

export default function ResumeSessionCard() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [copied, setCopied] = useState<string | null>(null)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [toast, setToast] = useState<{ id: string; kind: 'ok' | 'err'; text: string } | null>(null)
  const [, startTransition] = useTransition()

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('osm_sessions')
      .select(SELECT_COLS)
      .in('status', ['active', 'paused', 'context_full', 'crashed'])
      .is('archived_at', null)
      .order('updated_at', { ascending: false })
      .limit(6)
      .then(({ data }) => {
        if (data) setSessions(data as Session[])
      })
  }, [])

  useRealtimeChannel(
    'osm_sessions_card',
    [{ table: 'osm_sessions', event: '*' }],
    (payload) => {
      const row = payload.new as Session
      setSessions((prev) => {
        const without = prev.filter((s) => s.id !== row.id)
        // Gestopt (done) of gearchiveerd → uit de actieve lijst halen
        if (!row || row.status === 'done' || row.archived_at) return without.slice(0, 6)
        return [row, ...without].slice(0, 6)
      })
    }
  )

  const flash = (id: string, kind: 'ok' | 'err', text: string) => {
    setToast({ id, kind, text })
    setTimeout(() => setToast((t) => (t?.id === id ? null : t)), 2500)
  }

  // Pause/Play toggle (hergebruikt bestaande setSessionStatus)
  const togglePause = (id: string, to: 'paused' | 'active') => {
    setPendingId(id)
    startTransition(async () => {
      const res = await setSessionStatus(id, to)
      setPendingId(null)
      if (!res?.ok) flash(id, 'err', res?.error || 'Mislukt')
    })
  }

  const onStop = async (id: string) => {
    setPendingId(id)
    const res = await stopSession(id)
    setPendingId(null)
    if (res?.ok) {
      setSessions((prev) => prev.filter((s) => s.id !== id)) // optimistisch verwijderen uit actieve lijst
      flash(id, 'ok', 'Sessie gestopt')
    } else {
      flash(id, 'err', res?.error || 'Stoppen mislukt')
    }
  }

  const onArchive = async (id: string) => {
    setConfirmingId(null)
    setPendingId(id)
    const res = await archiveSession(id)
    setPendingId(null)
    if (res?.ok) {
      setSessions((prev) => prev.filter((s) => s.id !== id))
      flash(id, 'ok', 'Sessie gearchiveerd')
    } else {
      flash(id, 'err', res?.error || 'Archiveren mislukt')
    }
  }

  if (sessions.length === 0) return null

  return (
    <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <PlayCircle size={14} className="text-emerald-400" />
        <h2 className="text-[12px] font-semibold text-white/85">Ga verder</h2>
        <span className="text-[10px] text-white/40">
          {sessions.length} Claude sessie{sessions.length === 1 ? '' : 's'}
        </span>
        <Link
          href="/dashboard/osm/sessions"
          className="ml-auto text-[10px] text-white/45 hover:text-white/80 inline-flex items-center gap-1"
        >
          alle sessies <ExternalLink size={9} />
        </Link>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {sessions.map((s) => {
          const style = STATUS_STYLE[s.status]
          const isAlert = s.status === 'context_full' || s.status === 'crashed'
          const text = s.last_response_summary || s.last_prompt || ''
          const isPending = pendingId === s.id
          const isConfirming = confirmingId === s.id
          const t = toast?.id === s.id ? toast : null
          return (
            <div
              key={s.id}
              className={`border rounded-lg p-3 ${
                isAlert
                  ? 'border-orange-500/30 bg-orange-500/[0.04]'
                  : 'border-white/[0.06] bg-white/[0.02]'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded ${style.color}`}>
                  {style.label}
                </span>
                <span className="text-[10px] text-white/45 font-mono">{s.machine_id}</span>
                <span className="text-[10px] text-white/40 flex items-center gap-1 ml-auto">
                  <Clock size={9} /> {timeAgo(s.updated_at)} terug
                </span>
              </div>
              <Link
                href={`/dashboard/osm/sessions/${s.id}`}
                className="block group"
                title="Sessie detail"
              >
                <p className="text-[12px] text-white/90 font-medium group-hover:text-white">
                  {s.entity}
                </p>
              </Link>
              {s.git_branch && (
                <p className="text-[10px] text-white/45 font-mono mt-0.5 truncate">{s.git_branch}</p>
              )}
              {text && (
                <p className="text-[10.5px] text-white/55 mt-1.5 line-clamp-2 leading-snug">
                  {text}
                </p>
              )}
              {isAlert && (
                <div className="mt-2 flex items-start gap-1.5 text-[10px] text-orange-400/90">
                  <AlertTriangle size={10} className="mt-px shrink-0" />
                  <span>
                    {s.status === 'context_full'
                      ? 'Vorige sessie eindigde op context-limit'
                      : 'Vorige sessie crashed onverwacht'}
                  </span>
                </div>
              )}

              {isConfirming ? (
                <div className="mt-2 rounded-md border border-red-500/30 bg-red-500/[0.06] p-2">
                  <p className="text-[10.5px] text-white/80 leading-snug">
                    Weet je zeker dat je deze sessie uit de actieve lijst wilt verwijderen?
                  </p>
                  <div className="mt-1.5 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onArchive(s.id)}
                      disabled={isPending}
                      className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded bg-red-500/15 text-red-400 hover:bg-red-500/25 transition-colors disabled:opacity-40"
                    >
                      {isPending ? <RefreshCw size={11} className="animate-spin" /> : <Trash2 size={11} />}
                      Verwijderen
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmingId(null)}
                      disabled={isPending}
                      className="text-[10px] px-2 py-1 rounded bg-white/5 text-white/60 hover:text-white/90 transition-colors disabled:opacity-40"
                    >
                      Annuleren
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-2 flex items-center gap-2">
                  <code className="text-[10px] bg-black/30 px-1.5 py-0.5 rounded text-emerald-400 font-mono flex-1">
                    /ga-verder
                  </code>

                  {/* Kopiëren */}
                  <button
                    type="button"
                    onClick={async () => {
                      await navigator.clipboard.writeText('/ga-verder')
                      setCopied(s.id)
                      setTimeout(() => setCopied(null), 1500)
                    }}
                    className="text-white/40 hover:text-white/70 transition-colors"
                    title="Copy /ga-verder"
                  >
                    {copied === s.id ? (
                      <Check size={12} className="text-emerald-400" />
                    ) : (
                      <Copy size={12} />
                    )}
                  </button>

                  {/* Pause / Play */}
                  {s.status === 'paused' ? (
                    <button
                      type="button"
                      onClick={() => togglePause(s.id, 'active')}
                      disabled={isPending}
                      className="text-emerald-400/70 hover:text-emerald-400 transition-colors disabled:opacity-40"
                      title="Hervat (status → active)"
                    >
                      {isPending ? <RefreshCw size={12} className="animate-spin" /> : <Play size={12} />}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => togglePause(s.id, 'paused')}
                      disabled={isPending}
                      className="text-amber-400/70 hover:text-amber-400 transition-colors disabled:opacity-40"
                      title="Pauzeer (status → paused)"
                    >
                      {isPending ? <RefreshCw size={12} className="animate-spin" /> : <Pause size={12} />}
                    </button>
                  )}

                  {/* Stop sessie → status 'done' (closed) */}
                  <button
                    type="button"
                    onClick={() => onStop(s.id)}
                    disabled={isPending}
                    className="text-white/45 hover:text-white/85 transition-colors disabled:opacity-40"
                    title="Stop sessie (sluit af → Klaar)"
                  >
                    {isPending ? <RefreshCw size={12} className="animate-spin" /> : <Square size={12} />}
                  </button>

                  {/* Verwijder sessie → archiveren (soft-delete) */}
                  <button
                    type="button"
                    onClick={() => setConfirmingId(s.id)}
                    disabled={isPending}
                    className="text-red-400/60 hover:text-red-400 transition-colors disabled:opacity-40"
                    title="Verwijder sessie uit actieve lijst (archiveren)"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              )}

              {t && (
                <p className={`mt-1.5 text-[10px] ${t.kind === 'ok' ? 'text-emerald-400' : 'text-red-400'}`}>
                  {t.text}
                </p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
