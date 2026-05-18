'use client'

import { useState } from 'react'
import type { OrchestratorTask } from '@/lib/orchestrator/types'
import { MessageSquare } from 'lucide-react'

interface Props {
  tasks: OrchestratorTask[]
  onResolved: () => void
}

export default function WaitingHumanInput({ tasks, onResolved }: Props) {
  return (
    <div className="rounded-lg bg-white/[0.03] border border-white/[0.06] overflow-hidden">
      <div className="px-3 py-2 border-b border-white/[0.06] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare size={13} className="text-amber-400" />
          <span className="text-[11px] uppercase tracking-wider text-white/60">
            Wachten op input
          </span>
        </div>
        <span className="text-[11px] text-white/40">{tasks.length}</span>
      </div>
      {tasks.length === 0 ? (
        <div className="px-3 py-8 text-center text-[11px] text-white/30">
          geen openstaande escalations
        </div>
      ) : (
        <ul className="divide-y divide-white/[0.04]">
          {tasks.map((t) => <EscalationRow key={t.id} task={t} onResolved={onResolved} />)}
        </ul>
      )}
    </div>
  )
}

function EscalationRow({ task, onResolved }: { task: OrchestratorTask; onResolved: () => void }) {
  const [answer, setAnswer] = useState('')
  const [busy,   setBusy]   = useState(false)
  const [error,  setError]  = useState<string | null>(null)

  async function submit() {
    if (!answer.trim()) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/orchestrator/tasks/${task.id}/escalation`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ answer }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({ error: res.statusText }))
        throw new Error(j.error ?? 'kon antwoord niet opslaan')
      }
      setAnswer('')
      onResolved()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'fout')
    } finally {
      setBusy(false)
    }
  }

  return (
    <li className="px-3 py-2.5">
      <p className="text-sm text-white/85 truncate">{task.title}</p>
      {task.escalation_question && (
        <p className="text-[12px] text-amber-300/80 mt-0.5">{task.escalation_question}</p>
      )}
      <div className="flex items-center gap-2 mt-2">
        <input
          type="text"
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') submit() }}
          disabled={busy}
          placeholder="Antwoord…"
          className="flex-1 bg-[#0d0d1a] border border-white/[0.08] rounded-md px-2 py-1 text-xs text-white placeholder:text-white/30 outline-none focus:border-indigo-500/50 disabled:opacity-50"
        />
        <button
          onClick={submit}
          disabled={busy || !answer.trim()}
          className="text-[11px] px-2 py-1 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {busy ? '…' : 'Verstuur'}
        </button>
      </div>
      {error && <p className="text-[11px] text-rose-400 mt-1">{error}</p>}
    </li>
  )
}
