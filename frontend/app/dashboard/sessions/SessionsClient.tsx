'use client'

import { useState, useTransition } from 'react'
import { Bot, Play, Monitor, Globe } from 'lucide-react'
import { setAutopilot, resumeSession } from './actions'

export type SessionRow = {
  host: string
  session_id: string
  project: string
  cwd: string
  status: string
  last_event: string
  last_prompt: string
  last_event_at: string | null
  resume_at: string | null
  autopilot_on: boolean
  autopilot_source: string
  session_override: boolean | null
}

type HostState = { host: string; override: boolean | null; trusted: boolean }

function Pill({ on }: { on: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium ${
      on ? 'bg-violet-500/15 text-violet-300 border border-violet-500/20'
         : 'bg-white/5 text-white/40 border border-white/10'}`}>
      <Bot size={11} /> {on ? 'AAN' : 'uit'}
    </span>
  )
}

function statusColor(s: string) {
  if (s === 'actief') return 'text-emerald-400'
  if (s === 'wacht op input') return 'text-amber-400'
  if (s === 'rate-limit' || s === 'vastgelopen') return 'text-red-400'
  if (s === 'hervatten') return 'text-sky-400'
  return 'text-white/38'
}

function klok(iso: string | null) {
  if (!iso) return ''
  return new Date(iso).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })
}

function timeAgo(iso: string | null) {
  if (!iso) return '—'
  const sec = Math.round((Date.now() - new Date(iso).getTime()) / 1000)
  if (sec < 60) return `${sec}s`
  if (sec < 3600) return `${Math.round(sec / 60)}m`
  return `${Math.round(sec / 3600)}u`
}

export default function SessionsClient({
  rows, hosts, globalLive,
}: { rows: SessionRow[]; hosts: HostState[]; globalLive: boolean | null }) {
  const [pending, start] = useTransition()
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  const toggle = (scope: 'global' | 'host' | 'session', id: string, on: boolean, key: string) => {
    setBusy(key)
    start(async () => {
      const r = await setAutopilot(scope, id, on)
      setBusy(null)
      setMsg(r.ok ? null : r.error)
    })
  }

  const resume = (host: string, cwd: string, key: string) => {
    setBusy(key)
    start(async () => {
      const r = await resumeSession(host, cwd)
      setBusy(null)
      setMsg(r.ok ? '▶️ "ga verder" verstuurd' : r.error)
    })
  }

  return (
    <div className="space-y-4">
      {/* Globale + per-machine schakelaars */}
      <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4 space-y-3">
        <div className="flex items-center gap-2 text-xs text-white/50">
          <Globe size={13} /> Globaal
          <button
            disabled={pending}
            onClick={() => toggle('global', '*', !(globalLive ?? false), 'global')}
            className={`ml-2 px-2.5 py-1 rounded-md text-[11px] font-medium border ${
              globalLive ? 'bg-violet-500/15 text-violet-300 border-violet-500/20'
                         : 'bg-white/5 text-white/50 border-white/10'} ${busy === 'global' ? 'opacity-50' : ''}`}>
            Auto Hermes {globalLive ? 'AAN' : 'uit'}
          </button>
        </div>
        {hosts.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {hosts.map((h) => {
              const on = h.override ?? h.trusted
              return (
                <button key={h.host}
                  disabled={pending}
                  onClick={() => toggle('host', h.host, !on, `host:${h.host}`)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] border ${
                    on ? 'bg-violet-500/15 text-violet-300 border-violet-500/20'
                       : 'bg-white/5 text-white/50 border-white/10'} ${busy === `host:${h.host}` ? 'opacity-50' : ''}`}>
                  <Monitor size={11} /> {h.host} {on ? 'AAN' : 'uit'}
                  {h.override === null && <span className="text-white/30">(default)</span>}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {msg && <div className="text-xs text-amber-300/90 px-1">{msg}</div>}

      {/* Sessies */}
      <div className="rounded-xl border border-white/5 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wide text-white/40 bg-white/[0.02]">
              <th className="px-4 py-2.5 font-medium">Machine · Project</th>
              <th className="px-3 py-2.5 font-medium">Status</th>
              <th className="px-3 py-2.5 font-medium">Laatst</th>
              <th className="px-3 py-2.5 font-medium">Autopilot</th>
              <th className="px-4 py-2.5 font-medium text-right">Acties</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {rows.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-white/40 text-xs">
                Nog geen sessies. Start een nieuwe Claude Code-sessie — die verschijnt hier automatisch.
              </td></tr>
            )}
            {rows.map((r) => {
              const sk = `sess:${r.session_id}`
              return (
                <tr key={r.session_id} className="hover:bg-white/[0.015]">
                  <td className="px-4 py-3">
                    <div className="text-white/90 font-medium">{r.project}</div>
                    <div className="text-[11px] text-white/40">{r.host} · {r.last_prompt || r.last_event}</div>
                  </td>
                  <td className={`px-3 py-3 text-xs font-medium ${statusColor(r.status)}`}>
                    {r.status}
                    {r.resume_at && <div className="text-[10px] text-white/35 font-normal">↻ auto-hervat ~{klok(r.resume_at)}</div>}
                  </td>
                  <td className="px-3 py-3 text-xs text-white/50">{timeAgo(r.last_event_at)}</td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      <Pill on={r.autopilot_on} />
                      <span className="text-[10px] text-white/30">{r.autopilot_source}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        disabled={pending}
                        onClick={() => toggle('session', r.session_id, !r.autopilot_on, sk)}
                        className={`px-2.5 py-1 rounded-md text-[11px] border ${
                          r.autopilot_on ? 'bg-violet-500/15 text-violet-300 border-violet-500/20'
                                         : 'bg-white/5 text-white/60 border-white/10'} ${busy === sk ? 'opacity-50' : ''}`}>
                        Auto {r.autopilot_on ? 'uit' : 'aan'}
                      </button>
                      <button
                        disabled={pending}
                        onClick={() => resume(r.host, r.cwd, `resume:${r.session_id}`)}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] bg-emerald-500/15 text-emerald-300 border border-emerald-500/20 ${
                          busy === `resume:${r.session_id}` ? 'opacity-50' : ''}`}>
                        <Play size={11} /> Ga verder
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
