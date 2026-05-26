'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Loader2, Play, Users, X } from 'lucide-react'

type Role = { id: string; label: string; short: string }

type State = 'idle' | 'streaming' | 'done' | 'error'

export function ExpertPanel({ dossierId }: { dossierId: string }) {
  const [roles, setRoles] = useState<Role[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set(['curator', 'fiscalist', 'vastgoedjurist']))
  const [question, setQuestion] = useState('')
  const [outputs, setOutputs] = useState<Record<string, string>>({})
  const [activeRoles, setActiveRoles] = useState<Role[]>([])
  const [state, setState] = useState<State>('idle')
  const [globalError, setGlobalError] = useState<string | null>(null)
  const [roleErrors, setRoleErrors] = useState<Record<string, string>>({})
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    fetch(`/api/advocaat/dossiers/${dossierId}/expert-panel`)
      .then(r => r.json())
      .then(d => setRoles(d.roles ?? []))
      .catch(() => {})
  }, [dossierId])

  const toggle = useCallback((id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const run = useCallback(async () => {
    if (selected.size === 0) {
      alert('Selecteer ten minste één rol')
      return
    }
    setState('streaming')
    setGlobalError(null)
    setRoleErrors({})
    setOutputs({})
    setActiveRoles([])

    const ctrl = new AbortController()
    abortRef.current = ctrl

    try {
      const res = await fetch(`/api/advocaat/dossiers/${dossierId}/expert-panel`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          roles: Array.from(selected),
          question: question.trim() || null,
        }),
        signal: ctrl.signal,
      })

      if (!res.ok || !res.body) {
        const text = await res.text()
        throw new Error(text.slice(0, 200) || `HTTP ${res.status}`)
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        let sep: number
        while ((sep = buffer.indexOf('\n\n')) !== -1) {
          const raw = buffer.slice(0, sep)
          buffer = buffer.slice(sep + 2)
          let event = 'message', data = ''
          for (const line of raw.split('\n')) {
            if (line.startsWith('event:')) event = line.slice(6).trim()
            else if (line.startsWith('data:')) data += line.slice(5).trim()
          }
          if (!data) continue
          const payload = JSON.parse(data)

          if (event === 'start') {
            setActiveRoles(payload.roles)
          } else if (event === 'chunk') {
            setOutputs(prev => ({ ...prev, [payload.role]: (prev[payload.role] ?? '') + payload.text }))
          } else if (event === 'role-error') {
            setRoleErrors(prev => ({ ...prev, [payload.role]: payload.error }))
          } else if (event === 'role-done') {
            // no-op; output already accumulated
          } else if (event === 'done') {
            setState('done')
          } else if (event === 'error') {
            setGlobalError(payload.error)
            setState('error')
          }
        }
      }
      if (state !== 'error') setState('done')
    } catch (e) {
      const msg = (e as Error).message
      if (msg !== 'The user aborted a request.') {
        setGlobalError(msg)
        setState('error')
      } else {
        setState('idle')
      }
    } finally {
      abortRef.current = null
    }
  }, [dossierId, selected, question, state])

  const cancel = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  return (
    <div className="p-4 rounded border border-emerald-500/20 bg-emerald-500/[0.03] space-y-3">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-emerald-400" />
          <h2 className="text-sm font-semibold text-white">Expert panel</h2>
          <span className="text-[10px] text-zinc-500">parallel multi-rol analyse</span>
        </div>
        {state === 'streaming' && (
          <button onClick={cancel}
                  className="text-xs px-2 py-1 border border-red-500/30 rounded text-red-400 hover:bg-red-500/10 flex items-center gap-1">
            <X className="w-3 h-3" /> Stop
          </button>
        )}
      </header>

      <div>
        <div className="text-xs text-zinc-400 mb-2">Selecteer rollen ({selected.size} actief)</div>
        <div className="flex gap-2 flex-wrap">
          {roles.map(r => {
            const on = selected.has(r.id)
            return (
              <button key={r.id} onClick={() => toggle(r.id)}
                      className={`text-xs px-3 py-1.5 rounded border transition ${on
                        ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
                        : 'border-white/10 text-zinc-400 hover:text-white hover:bg-white/5'
                      }`}>
                {r.label}
              </button>
            )
          })}
          {roles.length === 0 && <span className="text-xs text-zinc-500">Rollen laden…</span>}
        </div>
      </div>

      <div className="flex gap-2 items-end">
        <textarea value={question} onChange={(e) => setQuestion(e.target.value)}
                  placeholder="Optionele vraag voor alle rollen — bv. 'Wat is de belangrijkste deadline en wie moet wat doen?' (leeg = generieke analyse per vakgebied)"
                  rows={2}
                  className="flex-1 bg-zinc-900 border border-white/10 rounded px-3 py-2 text-sm resize-y" />
        <button onClick={run} disabled={state === 'streaming' || selected.size === 0}
                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 rounded text-sm flex items-center gap-2 self-stretch">
          {state === 'streaming' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          Run panel
        </button>
      </div>

      {globalError && (
        <div className="text-xs text-red-400 border border-red-500/30 bg-red-500/10 p-2 rounded">
          {globalError}
        </div>
      )}

      {activeRoles.length > 0 && (
        <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${Math.min(activeRoles.length, 3)}, 1fr)` }}>
          {activeRoles.map(r => {
            const text = outputs[r.id] ?? ''
            const err = roleErrors[r.id]
            return (
              <div key={r.id} className="rounded border border-white/10 bg-white/[0.02] flex flex-col max-h-[500px]">
                <div className="p-2.5 border-b border-white/5 flex items-center justify-between">
                  <span className="text-xs font-semibold text-emerald-300">{r.short}</span>
                  <span className="text-[10px] text-zinc-500">{text.length} chars</span>
                </div>
                <div className="flex-1 overflow-y-auto p-3 text-xs text-zinc-100 whitespace-pre-wrap leading-relaxed">
                  {err
                    ? <span className="text-red-400">Fout: {err}</span>
                    : (text || <span className="text-zinc-500 italic">Wacht op antwoord…</span>)}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
