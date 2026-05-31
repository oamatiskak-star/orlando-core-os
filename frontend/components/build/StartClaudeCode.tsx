'use client'

import { useState } from 'react'
import { Terminal, X, Cpu, Server } from 'lucide-react'

type Launched = {
  machine_id: string; worktree_path: string
  from_mobile?: boolean; terminus_link?: string | null; attach_cmd?: string | null
}

const HOSTS = [
  { id: 'cli-l', label: 'CLI-L', sub: 'orchestrator · orlando-core-os', icon: Cpu },
  { id: 'cli-r', label: 'CLI-R', sub: 'worker · aquier', icon: Server },
] as const

/**
 * "Start Claude Code" — zelfde flow als de "Ga verder"-knoppen, maar opent een
 * NIEUWE Claude-sessie op de gekozen host. Mobiel-aware: onderweg op afstand ingrijpen
 * via Terminus (gedeelde tmux-sessie).
 */
export default function StartClaudeCode({ size = 'sm' }: { size?: 'xs' | 'sm' }) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [launched, setLaunched] = useState<Launched | null>(null)
  const [err, setErr] = useState<string | null>(null)

  async function start(machine: string) {
    setBusy(machine); setErr(null)
    try {
      const fromMobile =
        typeof navigator !== 'undefined' &&
        (/iphone|ipad|android|mobile/i.test(navigator.userAgent) ||
          (typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches && window.innerWidth < 900))
      const r = await fetch('/api/build/continue-terminal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'new', machine, from_mobile: fromMobile }),
      })
      const j = await r.json()
      if (!r.ok) { setErr(j.error ?? 'Kon niet starten'); return }
      setLaunched({ machine_id: j.machine_id, worktree_path: j.worktree_path, from_mobile: j.from_mobile, terminus_link: j.terminus_link, attach_cmd: j.attach_cmd })
    } catch { setErr('Netwerkfout') } finally { setBusy(null) }
  }

  const btnPad = size === 'sm' ? 'px-2.5 py-1.5 text-[11px]' : 'px-2 py-1 text-[10px]'

  return (
    <>
      <button
        type="button"
        onClick={() => { setOpen(true); setLaunched(null); setErr(null) }}
        className={`inline-flex items-center gap-1.5 rounded-lg border font-medium transition-colors bg-indigo-500/10 border-indigo-400/30 text-indigo-200 hover:bg-indigo-500/20 ${btnPad}`}
      >
        <Terminal size={size === 'sm' ? 12 : 11} /> Start Claude Code
      </button>

      {open && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="relative bg-[#181830] border border-white/10 rounded-2xl w-full max-w-sm shadow-2xl">
            <div className="flex items-start justify-between px-5 py-4 border-b border-white/5">
              <div className="flex items-start gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/15 border border-indigo-400/30 text-indigo-300 flex items-center justify-center">
                  <Terminal size={15} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white leading-tight">Start Claude Code</p>
                  <p className="text-[10px] text-white/40 mt-0.5 leading-tight">Nieuwe sessie op de gekozen host. Onderweg? Dan via Terminus op je iPhone.</p>
                </div>
              </div>
              <button onClick={() => setOpen(false)} className="text-white/50 hover:text-white"><X size={16} /></button>
            </div>

            <div className="p-5 space-y-3">
              {launched ? (
                <div className="rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-2.5 text-[11px] text-emerald-200">
                  ✓ Nieuwe sessie gestart op <span className="font-mono font-semibold">{launched.machine_id}</span> — iTerm2 opent in <span className="font-mono">{launched.worktree_path}</span> en start <span className="font-mono">claude</span>.
                  {launched.from_mobile ? (
                    <div className="mt-2 pt-2 border-t border-emerald-400/20">
                      <span className="block text-emerald-100/90">📱 Mobiel — sessie draait in gedeelde tmux. Koppel via Terminus:</span>
                      {launched.terminus_link && (
                        <a href={launched.terminus_link} className="inline-block mt-1.5 px-2.5 py-1 rounded-md bg-emerald-500/20 border border-emerald-400/40 text-emerald-100 font-medium">Open in Terminus → {launched.machine_id}</a>
                      )}
                      {launched.attach_cmd && (
                        <code className="block mt-1.5 text-[10px] bg-black/30 px-2 py-1 rounded text-emerald-300 font-mono break-all">{launched.attach_cmd}</code>
                      )}
                    </div>
                  ) : (
                    <span className="block text-emerald-300/60 mt-1">Verschijnt niet? Draait de resume-listener op {launched.machine_id}?</span>
                  )}
                </div>
              ) : (
                <>
                  <p className="text-[11px] text-white/50">Kies de machine:</p>
                  <div className="grid grid-cols-2 gap-2">
                    {HOSTS.map((h) => {
                      const Icon = h.icon
                      return (
                        <button
                          key={h.id}
                          onClick={() => start(h.id)}
                          disabled={busy !== null}
                          className="flex flex-col items-start gap-1 p-3 rounded-lg border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] hover:border-indigo-400/40 disabled:opacity-50 transition-colors text-left"
                        >
                          <Icon size={15} className="text-indigo-300" />
                          <span className="text-xs font-semibold text-white">{busy === h.id ? 'Starten…' : h.label}</span>
                          <span className="text-[9px] text-white/40 leading-tight">{h.sub}</span>
                        </button>
                      )
                    })}
                  </div>
                </>
              )}
              {err && <p className="text-[11px] text-red-400">{err}</p>}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
