'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  GitBranch, GitMerge, RefreshCw, Terminal, Monitor, Cpu,
  CheckCircle, AlertCircle, Clock, FileCode, Layers,
} from 'lucide-react'
import clsx from 'clsx'

type CommitInfo = { message: string; author: string; date: string }
type Session    = { machine: string; startedAt: string; pid: number } | null

type Worktree = {
  name:     string
  path:     string
  branch:   string
  head:     string
  bare:     boolean
  locked:   boolean
  dirty:    number
  commit:   CommitInfo
  session:  Session
  isMain:   boolean
}

type ApiResponse = {
  worktrees:    Worktree[]
  repoRoot:     string
  sessionCount: number
  totalDirty:   number
}

const MACHINE_COLOR: Record<string, string> = {
  'CLI-L': 'text-sky-400 bg-sky-500/10 border-sky-500/20',
  'CLI-R': 'text-violet-400 bg-violet-500/10 border-violet-500/20',
}

function MachineBadge({ machine }: { machine: string }) {
  const cls = MACHINE_COLOR[machine] ?? 'text-white/50 bg-white/5 border-white/10'
  const Icon = machine === 'CLI-R' ? Cpu : Monitor
  return (
    <span className={clsx('flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border w-fit', cls)}>
      <Icon size={9} />
      {machine}
    </span>
  )
}

function SessionBadge({ session }: { session: Session }) {
  if (!session) return (
    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-white/5 text-white/30 w-fit">
      <Clock size={9} /> vrij
    </span>
  )
  return (
    <div className="flex flex-col gap-0.5">
      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-green-500/10 text-green-400 border border-green-500/20 w-fit">
        <Terminal size={9} /> claude actief
      </span>
      <MachineBadge machine={session.machine} />
    </div>
  )
}

function DirtyBadge({ count }: { count: number }) {
  if (count === 0) return (
    <span className="text-[10px] text-white/20 flex items-center gap-1">
      <CheckCircle size={9} /> clean
    </span>
  )
  return (
    <span className="flex items-center gap-1 text-[10px] text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full w-fit">
      <AlertCircle size={9} /> {count} gewijzigd
    </span>
  )
}

function StatCard({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className="bg-white/[0.04] border border-white/5 rounded-lg px-3 py-2.5">
      <div className="text-[10px] text-white/40 mb-0.5">{label}</div>
      <div className={clsx('text-xl font-bold', color)}>{value}</div>
    </div>
  )
}

export default function WorktreeClient() {
  const [data,    setData]    = useState<ApiResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)
  const [filter,  setFilter]  = useState<'all' | 'active' | 'dirty'>('all')

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/worktrees', { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setData(await res.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fout bij ophalen worktrees')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
    const id = setInterval(refresh, 30_000)
    return () => clearInterval(id)
  }, [refresh])

  if (loading && !data) return (
    <div className="flex items-center gap-2 text-white/40 text-sm py-8 justify-center">
      <RefreshCw size={14} className="animate-spin" /> Worktrees ophalen...
    </div>
  )

  if (error) return (
    <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-sm text-red-400">
      {error} — Is de frontend lokaal actief op de repo server?
    </div>
  )

  if (!data) return null

  const { worktrees, sessionCount, totalDirty, repoRoot } = data

  const filtered = worktrees.filter(w => {
    if (filter === 'active') return w.session !== null
    if (filter === 'dirty')  return w.dirty > 0
    return true
  })

  const activeCount = worktrees.filter(w => w.session).length

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Totaal worktrees"       value={worktrees.length}  color="text-white" />
        <StatCard label="Actieve sessies"         value={sessionCount}      color="text-green-400" />
        <StatCard label="Dirty (uncommitted)"     value={totalDirty > 0 ? `${totalDirty}` : '0'}  color={totalDirty > 0 ? 'text-amber-400' : 'text-white/30'} />
        <StatCard label="CLI-R workers"           value={worktrees.filter(w => w.session?.machine === 'CLI-R').length} color="text-violet-400" />
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2 flex-wrap">
        {(['all', 'active', 'dirty'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={clsx(
              'px-3 py-1 rounded-md text-xs transition-colors',
              filter === f
                ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
                : 'text-white/40 hover:text-white/60 hover:bg-white/5'
            )}
          >
            {f === 'all' ? `Alle (${worktrees.length})` : f === 'active' ? `Actief (${activeCount})` : `Dirty (${worktrees.filter(w => w.dirty > 0).length})`}
          </button>
        ))}
        <button
          onClick={refresh}
          disabled={loading}
          className="ml-auto flex items-center gap-1.5 text-xs text-white/40 hover:text-white/60 transition-colors px-2 py-1 rounded-md hover:bg-white/5"
        >
          <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
          Ververs
        </button>
      </div>

      {/* Worktree tabel */}
      <div className="bg-white/[0.03] border border-white/5 rounded-xl overflow-hidden">
        <div className="grid grid-cols-[1fr_1.4fr_80px_120px_120px_100px] gap-0 border-b border-white/5 px-4 py-2">
          {['Worktree', 'Branch', 'HEAD', 'Sessie', 'Status', 'Laatste commit'].map(h => (
            <span key={h} className="text-[10px] uppercase tracking-wider text-white/30 font-semibold">{h}</span>
          ))}
        </div>

        <div className="divide-y divide-white/[0.04]">
          {filtered.map(wt => (
            <div
              key={wt.name}
              className={clsx(
                'grid grid-cols-[1fr_1.4fr_80px_120px_120px_100px] gap-0 px-4 py-3 hover:bg-white/[0.02] transition-colors',
                wt.isMain && 'bg-indigo-500/[0.04]'
              )}
            >
              {/* Naam */}
              <div className="flex items-center gap-2 min-w-0">
                {wt.isMain
                  ? <Layers size={12} className="text-indigo-400 flex-shrink-0" />
                  : <GitBranch size={12} className="text-white/30 flex-shrink-0" />
                }
                <div className="min-w-0">
                  <div className="text-xs font-medium text-white truncate">{wt.name}</div>
                  {wt.locked && (
                    <span className="text-[9px] text-amber-400">locked</span>
                  )}
                </div>
              </div>

              {/* Branch */}
              <div className="flex items-center">
                <span className="text-[11px] text-white/50 font-mono truncate">{wt.branch}</span>
              </div>

              {/* HEAD */}
              <div className="flex items-center">
                <span className="text-[11px] font-mono text-white/30">{wt.head}</span>
              </div>

              {/* Sessie */}
              <div className="flex items-start pt-0.5">
                <SessionBadge session={wt.session} />
              </div>

              {/* Status */}
              <div className="flex items-center">
                <DirtyBadge count={wt.dirty} />
              </div>

              {/* Commit */}
              <div className="flex flex-col justify-center min-w-0">
                <span className="text-[10px] text-white/40 truncate">{wt.commit.message || '—'}</span>
                <span className="text-[9px] text-white/20">{wt.commit.date}</span>
              </div>
            </div>
          ))}

          {filtered.length === 0 && (
            <div className="px-4 py-6 text-center text-sm text-white/30">
              Geen worktrees gevonden voor filter '{filter}'.
            </div>
          )}
        </div>
      </div>

      {/* Machine verdeling */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {['CLI-L', 'CLI-R'].map(machine => {
          const mWorktrees = worktrees.filter(w => w.session?.machine === machine)
          return (
            <div key={machine} className="bg-white/[0.04] border border-white/5 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <MachineBadge machine={machine} />
                <span className="text-xs text-white/40 ml-1">
                  {machine === 'CLI-L' ? '— Frontend / Orchestration' : '— Background / Workers'}
                </span>
              </div>
              {mWorktrees.length === 0 ? (
                <p className="text-xs text-white/20">Geen actieve sessies</p>
              ) : (
                <div className="space-y-1.5">
                  {mWorktrees.map(w => (
                    <div key={w.name} className="flex items-center gap-2">
                      <Terminal size={10} className="text-green-400" />
                      <span className="text-xs font-medium text-white">{w.name}</span>
                      <span className="text-[10px] text-white/30 font-mono">{w.branch}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Commando kaart */}
      <div className="bg-white/[0.03] border border-white/5 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <FileCode size={13} className="text-white/40" />
          <span className="text-xs font-semibold text-white/60">Snelcommando's</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {[
            { cmd: 'scripts/wt.sh setup',                   label: 'Alle worktrees initialiseren' },
            { cmd: 'scripts/wt.sh status',                  label: 'Status overzicht (terminal)' },
            { cmd: 'scripts/wt.sh new <naam> <branch>',     label: 'Nieuwe worktree aanmaken' },
            { cmd: 'scripts/wt.sh session mark <n> CLI-L',  label: 'Sessie registreren (CLI-L)' },
            { cmd: 'scripts/wt.sh session mark <n> CLI-R',  label: 'Sessie registreren (CLI-R)' },
            { cmd: 'scripts/wt.sh merge <naam>',            label: 'Mergen naar main' },
            { cmd: 'scripts/wt.sh clean',                   label: 'Orphaned worktrees opruimen' },
            { cmd: 'scripts/wt.sh session unmark <naam>',   label: 'Sessie vrijgeven' },
          ].map(({ cmd, label }) => (
            <div key={cmd} className="bg-white/[0.04] rounded-lg px-3 py-2">
              <code className="text-[10px] font-mono text-indigo-300">{cmd}</code>
              <p className="text-[10px] text-white/30 mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      </div>

      <p className="text-[10px] text-white/20 text-right">
        Repo: {repoRoot} · Ververst elke 30s
      </p>
    </div>
  )
}
