'use client'

import { useState, useTransition } from 'react'
import { Check, X, RotateCcw, Sparkles, Radar } from 'lucide-react'
import { setIdeaStatus, regenerate } from './actions'

export type Idea = {
  id: string
  target_channel: string
  niche: string | null
  format: string
  signal_relevance: string | null
  title_draft: string
  hook: string | null
  rationale: string | null
  source_competitor: string | null
  priority: number
  status: string
  due_date: string | null
}

const FORMAT_LABEL: Record<string, string> = {
  challenge: '🎯 Challenge', experiment: '🧪 Experiment', myth_bust: '🔍 Myth-bust',
  trend_cover: '📈 Trend', format_test: '🔄 Format-test',
}

function fmtBadge(f: string) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-white/5 text-white/70 border border-white/10">
      {FORMAT_LABEL[f] ?? f}
    </span>
  )
}

function statusBadge(s: string) {
  const map: Record<string, string> = {
    idea: 'bg-sky-500/15 text-sky-300 border-sky-500/20',
    approved: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/20',
    rejected: 'bg-white/5 text-white/35 border-white/10',
    promoted: 'bg-violet-500/15 text-violet-300 border-violet-500/20',
  }
  const label: Record<string, string> = { idea: 'idee', approved: 'goedgekeurd', rejected: 'afgewezen', promoted: 'gepromoot' }
  return <span className={`inline-flex px-2 py-0.5 rounded-md text-[11px] border ${map[s] ?? map.idea}`}>{label[s] ?? s}</span>
}

export default function RadarClient({ ideas }: { ideas: Idea[] }) {
  const [pending, start] = useTransition()
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  const act = (id: string, status: 'approved' | 'rejected' | 'idea', key: string) => {
    setBusy(key)
    start(async () => {
      const r = await setIdeaStatus(id, status)
      setBusy(null)
      setMsg(r.ok ? null : r.error)
    })
  }

  const regen = () => {
    setBusy('regen')
    start(async () => {
      const r = await regenerate()
      setBusy(null)
      setMsg(r.ok ? `➕ ${r.created} nieuw idee(ën) opgehaald` : r.error)
    })
  }

  const channels = Array.from(new Set(ideas.map((i) => i.target_channel)))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-white/50">
          <Radar size={13} /> Ideeën uit de concurrent- & viral-radar, gerouteerd naar je kanalen.
        </div>
        <button
          disabled={pending}
          onClick={regen}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-medium border bg-violet-500/15 text-violet-300 border-violet-500/20 ${busy === 'regen' ? 'opacity-50' : ''}`}>
          <Sparkles size={13} /> Genereer nu
        </button>
      </div>

      {msg && <div className="text-xs text-amber-300/90 px-1">{msg}</div>}

      {channels.length === 0 && (
        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-8 text-center text-white/40 text-sm">
          Nog geen ideeën. Zodra de scanner nieuwe signalen oppikt, vult de radar deze kalender automatisch (content-venster 18:30–22:00).
        </div>
      )}

      {channels.map((ch) => {
        const rows = ideas.filter((i) => i.target_channel === ch)
        return (
          <div key={ch} className="rounded-xl border border-white/5 overflow-hidden">
            <div className="px-4 py-2.5 bg-white/[0.03] flex items-center justify-between">
              <span className="text-sm font-semibold text-white/90">{ch}</span>
              <span className="text-[11px] text-white/40">{rows.length} idee(ën)</span>
            </div>
            <table className="w-full text-sm">
              <tbody className="divide-y divide-white/5">
                {rows.map((i) => (
                  <tr key={i.id} className={`hover:bg-white/[0.015] ${i.status === 'rejected' ? 'opacity-45' : ''}`}>
                    <td className="px-4 py-3 w-10 text-center">
                      <span className="text-[13px] font-semibold text-white/70">{i.priority}</span>
                    </td>
                    <td className="px-2 py-3">
                      <div className="text-white/90 font-medium">{i.title_draft}</div>
                      <div className="mt-1 flex items-center gap-2 flex-wrap">
                        {fmtBadge(i.format)}
                        {statusBadge(i.status)}
                        <span className="text-[11px] text-white/35">
                          {i.signal_relevance === 'format_only' ? '📡 viral-radar' : '🎯 concurrent'} · {i.source_competitor}
                        </span>
                      </div>
                      {i.rationale && <div className="mt-1 text-[11px] text-white/35">{i.rationale}</div>}
                    </td>
                    <td className="px-4 py-3 w-28">
                      <div className="flex items-center justify-end gap-1.5">
                        {i.status !== 'approved' && (
                          <button disabled={pending} onClick={() => act(i.id, 'approved', `a:${i.id}`)}
                            title="Goedkeuren"
                            className={`p-1.5 rounded-md bg-emerald-500/15 text-emerald-300 border border-emerald-500/20 ${busy === `a:${i.id}` ? 'opacity-50' : ''}`}>
                            <Check size={14} />
                          </button>
                        )}
                        {i.status !== 'rejected'
                          ? (
                            <button disabled={pending} onClick={() => act(i.id, 'rejected', `r:${i.id}`)}
                              title="Afwijzen"
                              className={`p-1.5 rounded-md bg-white/5 text-white/50 border border-white/10 ${busy === `r:${i.id}` ? 'opacity-50' : ''}`}>
                              <X size={14} />
                            </button>
                          )
                          : (
                            <button disabled={pending} onClick={() => act(i.id, 'idea', `u:${i.id}`)}
                              title="Terugzetten"
                              className={`p-1.5 rounded-md bg-white/5 text-white/50 border border-white/10 ${busy === `u:${i.id}` ? 'opacity-50' : ''}`}>
                              <RotateCcw size={14} />
                            </button>
                          )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      })}
    </div>
  )
}
