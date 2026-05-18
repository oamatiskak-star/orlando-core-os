'use client'

import { useState } from 'react'
import type { TaskError } from '@/lib/orchestrator/types'
import { AlertOctagon, RotateCcw } from 'lucide-react'

interface Props {
  errors: TaskError[]
  onRetried: () => void
}

export default function RecentFailures({ errors, onRetried }: Props) {
  return (
    <div className="rounded-lg bg-white/[0.03] border border-white/[0.06] overflow-hidden">
      <div className="px-3 py-2 border-b border-white/[0.06] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertOctagon size={13} className="text-rose-400" />
          <span className="text-[11px] uppercase tracking-wider text-white/60">
            Recente fouten
          </span>
        </div>
        <span className="text-[11px] text-white/40">{errors.length}</span>
      </div>
      {errors.length === 0 ? (
        <div className="px-3 py-8 text-center text-[11px] text-white/30">geen fouten</div>
      ) : (
        <ul className="divide-y divide-white/[0.04]">
          {errors.map((e) => <FailureRow key={e.id} err={e} onRetried={onRetried} />)}
        </ul>
      )}
    </div>
  )
}

function FailureRow({ err, onRetried }: { err: TaskError; onRetried: () => void }) {
  const [busy, setBusy] = useState(false)

  async function retry() {
    setBusy(true)
    try {
      await fetch(`/api/orchestrator/tasks/${err.task_id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ status: 'retry' }),
      })
      onRetried()
    } finally {
      setBusy(false)
    }
  }

  return (
    <li className="px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-white/85 truncate">
          {err.error_class ?? 'Error'} · {err.message}
        </p>
        <button
          onClick={retry}
          disabled={busy}
          title="Retry"
          className="text-white/50 hover:text-indigo-400 disabled:opacity-40"
        >
          <RotateCcw size={13} />
        </button>
      </div>
      <p className="text-[11px] text-white/35 mt-0.5">
        task {err.task_id.slice(0, 8)} · {new Date(err.created_at).toLocaleString('nl-NL')}
      </p>
    </li>
  )
}
