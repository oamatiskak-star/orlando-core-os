'use client'

import { useEffect, useState } from 'react'
import { GitBranch, Play, X } from 'lucide-react'
import type { OrchestratorEvent } from '@/lib/orchestrator/types'

interface Suggestion extends OrchestratorEvent {}

const KIND_TONE: Record<string, string> = {
  flow_suggestion:         'text-emerald-400',
  flow_dead_end:           'text-amber-400',
  flow_unreachable:        'text-amber-400',
  flow_broken_link:        'text-rose-400',
  flow_deep_no_breadcrumb: 'text-sky-400',
  flow_duplicate_route:    'text-rose-400',
  flow_missing_in_nav:     'text-violet-400',
}

function describe(ev: Suggestion): string {
  const p = ev.payload ?? {}
  if (ev.type === 'flow_suggestion') {
    const s = p as Record<string, unknown>
    return `${s.route} → "${s.suggested_label}" in sectie "${s.section_hint}"`
  }
  const route = (p as { route?: string }).route ?? '?'
  const detail = (p as { detail?: string }).detail ?? ''
  return `${route} — ${detail}`
}

export default function FlowSuggestions() {
  const [items, setItems] = useState<Suggestion[]>([])
  const [busy,  setBusy]  = useState(false)
  const [err,   setErr]   = useState<string | null>(null)

  async function load() {
    try {
      const res = await fetch('/api/orchestrator/flow/suggestions', { cache: 'no-store' })
      if (!res.ok) {
        const j = await res.json().catch(() => ({ error: res.statusText }))
        throw new Error(j.error ?? 'kon suggestions niet laden')
      }
      const j = await res.json()
      setItems(j.events ?? [])
      setErr(null)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'fout')
    }
  }

  async function rescan() {
    setBusy(true)
    setErr(null)
    try {
      const res = await fetch('/api/orchestrator/flow/scan', { method: 'POST' })
      if (!res.ok) {
        const j = await res.json().catch(() => ({ error: res.statusText }))
        throw new Error(j.error ?? 'scan faalde')
      }
      await load()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'fout')
    } finally {
      setBusy(false)
    }
  }

  async function resolve(id: string) {
    await fetch(`/api/orchestrator/flow/suggestions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resolved: true }),
    })
    setItems((prev) => prev.filter((s) => s.id !== id))
  }

  useEffect(() => { load() }, [])

  return (
    <div className="rounded-lg bg-white/[0.03] border border-white/[0.06] overflow-hidden">
      <div className="px-3 py-2 border-b border-white/[0.06] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <GitBranch size={13} className="text-emerald-400" />
          <span className="text-[11px] uppercase tracking-wider text-white/60">
            Flow intelligence
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-white/40">{items.length}</span>
          <button
            onClick={rescan}
            disabled={busy}
            title="Run scan"
            className="text-[10px] px-2 py-0.5 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-40"
          >
            {busy ? '…' : (
              <span className="flex items-center gap-1"><Play size={10} />Scan</span>
            )}
          </button>
        </div>
      </div>
      {err && (
        <p className="px-3 py-2 text-[11px] text-rose-400 border-b border-white/[0.06]">
          {err}
        </p>
      )}
      {items.length === 0 ? (
        <div className="px-3 py-8 text-center text-[11px] text-white/30">
          {busy ? 'scannen…' : 'geen open flow-issues — druk Scan om opnieuw te analyseren'}
        </div>
      ) : (
        <ul className="divide-y divide-white/[0.04] max-h-80 overflow-y-auto">
          {items.map((ev) => (
            <li key={ev.id} className="px-3 py-2 flex items-start gap-2">
              <span className={`text-[10px] uppercase mt-0.5 ${KIND_TONE[ev.type] ?? 'text-white/40'}`}>
                {ev.type.replace(/^flow_/, '')}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white/85 truncate">{describe(ev)}</p>
                <p className="text-[10px] text-white/35 mt-0.5">
                  {new Date(ev.created_at).toLocaleString('nl-NL')}
                </p>
              </div>
              <button
                onClick={() => resolve(ev.id)}
                title="Markeer afgehandeld"
                className="text-white/40 hover:text-white/80"
              >
                <X size={13} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
