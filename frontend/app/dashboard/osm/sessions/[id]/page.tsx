import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ChevronLeft, FileCode2, GitBranch, ListChecks, Clock, MessageSquare } from 'lucide-react'
import SessionActions from './SessionActions'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type Session = {
  id: string
  machine_id: string
  entity: string
  tmux_session: string | null
  tmux_window: string | null
  worktree_path: string | null
  git_branch: string | null
  last_commit_sha: string | null
  last_prompt: string | null
  last_response_summary: string | null
  claude_session_id: string | null
  active_files: string[] | null
  open_todos: unknown
  buildtracker_section: string | null
  stop_reason: string | null
  status: 'active' | 'paused' | 'context_full' | 'crashed' | 'done'
  created_at: string
  updated_at: string
}

type Event = {
  id: number
  event_type: string
  payload: Record<string, unknown> | null
  created_at: string
}

const STATUS_STYLE: Record<string, { label: string; color: string }> = {
  active:       { label: 'Actief',      color: 'text-emerald-400 bg-emerald-500/10' },
  paused:       { label: 'Gepauzeerd',  color: 'text-amber-400 bg-amber-500/10' },
  context_full: { label: 'Context vol', color: 'text-orange-400 bg-orange-500/10' },
  crashed:      { label: 'Crashed',     color: 'text-red-400 bg-red-500/10' },
  done:         { label: 'Klaar',       color: 'text-white/40 bg-white/5' },
}

function fmt(iso: string): string {
  return new Date(iso).toLocaleString('nl-NL', { dateStyle: 'short', timeStyle: 'medium' })
}

function eventBadge(t: string): string {
  switch (t) {
    case 'prompt':    return 'bg-blue-500/15 text-blue-300'
    case 'tool_call': return 'bg-violet-500/15 text-violet-300'
    case 'stop':      return 'bg-amber-500/15 text-amber-300'
    default:          return 'bg-white/10 text-white/55'
  }
}

export default async function OsmSessionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: sessionData } = await supabase
    .from('osm_sessions')
    .select(
      'id, machine_id, entity, tmux_session, tmux_window, worktree_path, git_branch, last_commit_sha, last_prompt, last_response_summary, claude_session_id, active_files, open_todos, buildtracker_section, stop_reason, status, created_at, updated_at',
    )
    .eq('id', id)
    .maybeSingle()

  if (!sessionData) notFound()
  const s = sessionData as Session

  const { data: eventData } = await supabase
    .from('osm_events')
    .select('id, event_type, payload, created_at')
    .eq('machine_id', s.machine_id)
    .eq('entity', s.entity)
    .order('created_at', { ascending: false })
    .limit(80)

  const events: Event[] = (eventData ?? []) as Event[]
  const style = STATUS_STYLE[s.status] ?? STATUS_STYLE.active
  const todos: string[] = Array.isArray(s.open_todos)
    ? (s.open_todos as unknown[]).map((t) => String(t))
    : []

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard/osm/sessions"
          className="text-white/40 hover:text-white/70"
          aria-label="Terug naar sessies"
        >
          <ChevronLeft size={16} />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded ${style.color}`}>
              {style.label}
            </span>
            <span className="text-[10px] font-mono text-white/45">{s.machine_id}</span>
          </div>
          <h2 className="text-[13px] font-semibold text-white truncate">{s.entity}</h2>
        </div>
        <SessionActions id={s.id} status={s.status} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-3">
          <div className="flex items-center gap-1.5 text-[10px] text-white/45 mb-1.5">
            <GitBranch size={10} /> Worktree
          </div>
          <p className="text-[11px] text-white/90 font-mono break-all">{s.worktree_path || '—'}</p>
          <p className="text-[10px] text-white/55 font-mono mt-1">{s.git_branch || '—'}</p>
          {s.last_commit_sha && (
            <p className="text-[10px] text-white/40 font-mono mt-0.5">
              {s.last_commit_sha.slice(0, 12)}
            </p>
          )}
        </div>

        <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-3">
          <div className="flex items-center gap-1.5 text-[10px] text-white/45 mb-1.5">
            <Clock size={10} /> Tijden
          </div>
          <p className="text-[11px] text-white/80">
            Aangemaakt <span className="text-white/55">{fmt(s.created_at)}</span>
          </p>
          <p className="text-[11px] text-white/80 mt-0.5">
            Bijgewerkt <span className="text-white/55">{fmt(s.updated_at)}</span>
          </p>
        </div>

        <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-3">
          <div className="flex items-center gap-1.5 text-[10px] text-white/45 mb-1.5">
            <FileCode2 size={10} /> Tmux
          </div>
          <p className="text-[11px] text-white/80 font-mono">
            {s.tmux_session || '—'} / {s.tmux_window || '—'}
          </p>
          {s.claude_session_id && (
            <p className="text-[10px] text-white/40 font-mono mt-1 truncate">
              cs: {s.claude_session_id}
            </p>
          )}
          {s.stop_reason && (
            <p className="text-[10px] text-amber-400/80 mt-1">stop: {s.stop_reason}</p>
          )}
        </div>
      </div>

      {(s.last_response_summary || s.last_prompt) && (
        <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-4">
          <div className="flex items-center gap-1.5 text-[10px] text-white/45 mb-2">
            <MessageSquare size={10} /> Laatste context
          </div>
          {s.last_response_summary && (
            <div className="mb-3">
              <p className="text-[10px] text-emerald-400/80 mb-1">Handover summary</p>
              <p className="text-[12px] text-white/85 whitespace-pre-wrap leading-relaxed">
                {s.last_response_summary}
              </p>
            </div>
          )}
          {s.last_prompt && (
            <div>
              <p className="text-[10px] text-white/35 mb-1">Laatste user prompt</p>
              <p className="text-[11.5px] text-white/65 whitespace-pre-wrap line-clamp-6">
                {s.last_prompt}
              </p>
            </div>
          )}
        </div>
      )}

      {todos.length > 0 && (
        <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-4">
          <div className="flex items-center gap-1.5 text-[10px] text-white/45 mb-2">
            <ListChecks size={10} /> Open todos ({todos.length})
          </div>
          <ul className="space-y-1">
            {todos.map((t, i) => (
              <li key={i} className="text-[11.5px] text-white/85 flex gap-2">
                <span className="text-white/30">•</span>
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {s.active_files && s.active_files.length > 0 && (
        <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-4">
          <div className="text-[10px] text-white/45 mb-2">
            Files aangeraakt ({s.active_files.length})
          </div>
          <ul className="space-y-0.5">
            {s.active_files.map((f, i) => (
              <li key={i} className="text-[10.5px] text-white/70 font-mono break-all">
                {f}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-[11px] font-semibold text-white/80">Events log</h3>
          <span className="text-[10px] text-white/40">
            laatste {events.length} (filter: {s.machine_id} · {s.entity})
          </span>
        </div>
        {events.length === 0 ? (
          <p className="text-[11px] text-white/40 py-4 text-center">Geen events.</p>
        ) : (
          <div className="space-y-0.5 max-h-96 overflow-y-auto">
            {events.map((e) => {
              const summary =
                e.event_type === 'prompt'
                  ? String(e.payload?.prompt ?? '').slice(0, 200)
                  : e.event_type === 'tool_call'
                  ? `${String(e.payload?.tool ?? '?')}: ${String(e.payload?.target ?? '')}`.slice(0, 200)
                  : e.event_type === 'stop'
                  ? `${String(e.payload?.status ?? '?')} (${String(e.payload?.reason ?? '')})`
                  : JSON.stringify(e.payload ?? {}).slice(0, 200)
              return (
                <div key={e.id} className="flex items-center gap-2 py-1">
                  <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded shrink-0 ${eventBadge(e.event_type)}`}>
                    {e.event_type}
                  </span>
                  <span className="text-[10px] text-white/40 w-32 shrink-0">{fmt(e.created_at)}</span>
                  <span className="text-[10.5px] text-white/70 flex-1 truncate font-mono">{summary}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
