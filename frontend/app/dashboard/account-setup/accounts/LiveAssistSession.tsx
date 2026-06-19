'use client'

import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import { Eye, Loader2, Send, Square, Bot, User } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { startLiveAssist, endLiveAssist, postAssistQuestion } from '../actions'

const POLL_MS = 2500
const ACTIVE = ['queued', 'running', 'awaiting_action', 'awaiting_approval']

type RunRow = {
  id: string; status: string; started_at: string | null
  claimed_by: string | null; heartbeat_at: string | null
}
type FeedItem = { ts: string; role: 'agent' | 'me'; who: string; text: string }

function freshHeartbeat(hb: string | null): boolean {
  if (!hb) return false
  return Date.now() - new Date(hb).getTime() < 90_000
}

export function LiveAssistSession() {
  const supabase = createClient()
  const [run, setRun] = useState<RunRow | null>(null)
  const [feed, setFeed] = useState<FeedItem[]>([])
  const [agents, setAgents] = useState<string[]>([])
  const [busy, startTransition] = useTransition()
  const [question, setQuestion] = useState('')
  const [program, setProgram] = useState('')
  const feedEndRef = useRef<HTMLDivElement | null>(null)

  const refresh = useCallback(async () => {
    const { data: runs } = await supabase
      .from('account_setup_runs')
      .select('id, status, started_at, claimed_by, heartbeat_at')
      .eq('run_kind', 'live_assist')
      .order('started_at', { ascending: false })
      .limit(1)
    const latest = (runs?.[0] as RunRow) ?? null
    setRun(latest)
    if (!latest) { setFeed([]); setAgents([]); return }

    const [{ data: steps }, { data: actions }] = await Promise.all([
      supabase
        .from('account_setup_run_steps')
        .select('id, step_kind, output, started_at')
        .eq('run_id', latest.id)
        .order('started_at', { ascending: true }),
      supabase
        .from('account_setup_human_actions')
        .select('id, title, description, created_at')
        .eq('run_id', latest.id)
        .order('created_at', { ascending: true }),
    ])

    const seen = new Set<string>()
    const agentItems: FeedItem[] = (steps ?? [])
      .map((s: { output: Record<string, unknown> | null; started_at: string | null; step_kind: string }): FeedItem | null => {
        const out = s.output ?? {}
        const msg = typeof out['message'] === 'string' ? (out['message'] as string) : null
        const who = typeof out['agent'] === 'string' ? (out['agent'] as string) : 'agent'
        if (who) seen.add(who)
        if (!msg) return null
        return { ts: s.started_at ?? '', role: 'agent', who, text: msg }
      })
      .filter((x): x is FeedItem => x !== null)

    const myItems: FeedItem[] = (actions ?? []).map(
      (a: { description: string | null; title: string; created_at: string }) => ({
        ts: a.created_at, role: 'me' as const, who: 'jij', text: a.description ?? a.title,
      }),
    )

    const merged = [...agentItems, ...myItems].sort((x, y) => (x.ts < y.ts ? -1 : 1))
    setFeed(merged)
    if (latest.claimed_by) seen.add(latest.claimed_by)
    setAgents(Array.from(seen))
  }, [supabase])

  useEffect(() => {
    const first = setTimeout(refresh, 0)
    const t = setInterval(refresh, POLL_MS)
    return () => { clearTimeout(first); clearInterval(t) }
  }, [refresh])

  useEffect(() => { feedEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [feed.length])

  const active = run && ACTIVE.includes(run.status)

  function handleStart() {
    startTransition(async () => { await startLiveAssist(); await refresh() })
  }
  function handleEnd() {
    if (!run) return
    const fd = new FormData(); fd.set('run_id', run.id)
    startTransition(async () => { await endLiveAssist(fd); await refresh() })
  }
  function handleAsk() {
    if (!run || !question.trim()) return
    const fd = new FormData()
    fd.set('run_id', run.id); fd.set('question', question.trim()); fd.set('program', program.trim())
    startTransition(async () => { await postAssistQuestion(fd); setQuestion(''); await refresh() })
  }

  return (
    <div className="bg-white/[0.04] rounded-xl border border-white/[0.06] p-4">
      <div className="flex items-center gap-2">
        <Eye size={13} className="text-indigo-300" />
        <span className="text-[12px] font-semibold text-white/85">Live mee-kijken — Setup Agent + MCP Agent</span>
        {active ? (
          <span className="ml-auto inline-flex items-center gap-1.5 text-[10px] text-emerald-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" /> sessie actief
          </span>
        ) : (
          <span className="ml-auto text-[10px] text-white/35">geen sessie</span>
        )}
      </div>

      {!active ? (
        <div className="mt-3">
          <p className="text-[11px] text-white/55">
            Start een sessie en de agents haken aan via de queue. Jij vult de aanmeldformulieren in;
            zij kijken mee en beantwoorden je vragen live.
          </p>
          <button
            onClick={handleStart}
            disabled={busy}
            className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-400/30 rounded text-indigo-200 text-[11px] disabled:opacity-50"
          >
            {busy ? <Loader2 size={12} className="animate-spin" /> : <Eye size={12} />}
            Live mee-kijk-sessie starten
          </button>
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          {/* Attached agents */}
          <div className="flex items-center gap-2 text-[10px]">
            <span className="text-white/35 uppercase tracking-wide">Aangehaakt:</span>
            {agents.length === 0 ? (
              <span className="inline-flex items-center gap-1 text-amber-300/80">
                <Loader2 size={10} className="animate-spin" /> wachten op agents…
              </span>
            ) : (
              agents.map(a => (
                <span key={a} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-400/20 text-emerald-200">
                  <Bot size={10} /> {a}
                </span>
              ))
            )}
            {run && (
              <span className={`ml-auto ${freshHeartbeat(run.heartbeat_at) ? 'text-emerald-300/70' : 'text-white/30'}`}>
                {freshHeartbeat(run.heartbeat_at) ? '● heartbeat live' : '○ geen heartbeat'}
              </span>
            )}
          </div>

          {/* Feed */}
          <div className="max-h-72 overflow-y-auto rounded-lg border border-white/[0.06] bg-black/20 p-2.5 space-y-2">
            {feed.length === 0 ? (
              <p className="text-[10.5px] text-white/35 py-4 text-center">
                Nog geen berichten. Stel hieronder je eerste aanmeldvraag.
              </p>
            ) : (
              feed.map((f, i) => (
                <div key={i} className={`flex gap-2 ${f.role === 'me' ? 'justify-end' : ''}`}>
                  {f.role === 'agent' && <Bot size={12} className="mt-0.5 shrink-0 text-indigo-300" />}
                  <div className={`max-w-[80%] rounded-lg px-2.5 py-1.5 text-[11px] leading-relaxed ${
                    f.role === 'me'
                      ? 'bg-indigo-500/15 border border-indigo-400/20 text-white/85'
                      : 'bg-white/[0.05] border border-white/[0.06] text-white/80'
                  }`}>
                    <span className="block text-[9px] uppercase tracking-wide text-white/35 mb-0.5">{f.who}</span>
                    {f.text}
                  </div>
                  {f.role === 'me' && <User size={12} className="mt-0.5 shrink-0 text-indigo-300" />}
                </div>
              ))
            )}
            <div ref={feedEndRef} />
          </div>

          {/* Vraag stellen */}
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              value={program}
              onChange={e => setProgram(e.target.value)}
              placeholder="Programma (optioneel)"
              className="sm:w-44 bg-white/[0.04] border border-white/10 rounded px-2 py-1.5 text-[11px] text-white/85 placeholder:text-white/30 focus:outline-none focus:border-white/30"
            />
            <input
              value={question}
              onChange={e => setQuestion(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleAsk() }}
              placeholder="Welke vraag moet je nu beantwoorden? Plak hem hier…"
              className="flex-1 bg-white/[0.04] border border-white/10 rounded px-2 py-1.5 text-[11px] text-white/85 placeholder:text-white/30 focus:outline-none focus:border-white/30"
            />
            <button
              onClick={handleAsk}
              disabled={busy || !question.trim()}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-400/30 rounded text-emerald-200 text-[11px] disabled:opacity-40"
            >
              {busy ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />} Vraag
            </button>
          </div>

          <button
            onClick={handleEnd}
            disabled={busy}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] text-white/45 hover:text-white/75 border border-white/10 rounded disabled:opacity-50"
          >
            <Square size={10} /> Sessie beëindigen
          </button>
        </div>
      )}
    </div>
  )
}
