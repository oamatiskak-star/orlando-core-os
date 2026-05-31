'use client'

import { useState } from 'react'
import { ArrowRight, Copy, Check, X, Terminal } from 'lucide-react'
import { buildContinuePrompt, type ContinuePromptContext } from '@/lib/continue-prompt'

type Props = {
  context: ContinuePromptContext
  companyColor?: string
  size?: 'xs' | 'sm'
  label?: string
}

/**
 * "Ga verder"-knop voor elke build tracker. Opent een modal met een plak-klare
 * Claude Code prompt + kopieerknop, zodat je het werk direct in een terminal-sessie voortzet.
 */
export default function ContinueInClaude({
  context,
  companyColor = '#34d399',
  size = 'xs',
  label = 'Ga verder',
}: Props) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [launching, setLaunching] = useState(false)
  const [launched, setLaunched] = useState<{
    machine_id: string; worktree_path: string
    from_mobile?: boolean; terminus_link?: string | null; attach_cmd?: string | null
  } | null>(null)
  const [launchErr, setLaunchErr] = useState<string | null>(null)

  const prompt = buildContinuePrompt(context)

  async function start() {
    setLaunching(true)
    setLaunchErr(null)
    try {
      // Mobiel-detectie zodat Hermes de Terminus-flow erbij kan zetten.
      const fromMobile =
        typeof navigator !== 'undefined' &&
        (/iphone|ipad|android|mobile/i.test(navigator.userAgent) ||
          (typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches && window.innerWidth < 900))
      const r = await fetch('/api/build/continue-terminal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ context, from_mobile: fromMobile }),
      })
      const j = await r.json()
      if (!r.ok) { setLaunchErr(j.error ?? 'Kon niet starten'); return }
      setLaunched({
        machine_id: j.machine_id, worktree_path: j.worktree_path,
        from_mobile: j.from_mobile, terminus_link: j.terminus_link, attach_cmd: j.attach_cmd,
      })
    } catch {
      setLaunchErr('Netwerkfout')
    } finally {
      setLaunching(false)
    }
  }

  async function copy() {
    try {
      await navigator.clipboard?.writeText(prompt)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* clipboard niet beschikbaar — gebruiker kan handmatig selecteren */
    }
  }

  const btnPad = size === 'sm' ? 'px-2.5 py-1.5 text-[11px]' : 'px-2 py-1 text-[10px]'
  const iconSz = size === 'sm' ? 12 : 11

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          setOpen(true)
        }}
        className={`inline-flex items-center gap-1.5 rounded-lg border font-medium transition-colors bg-emerald-500/10 border-emerald-400/30 text-emerald-200 hover:bg-emerald-500/20 ${btnPad}`}
      >
        <ArrowRight size={iconSz} /> {label}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="relative bg-[#181830] border border-white/10 rounded-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto shadow-2xl">
            <div className="flex items-start justify-between px-5 py-4 border-b border-white/5 sticky top-0 bg-[#181830] z-10">
              <div className="flex items-start gap-2.5 pr-4">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: `${companyColor}1a`, border: `1px solid ${companyColor}33`, color: companyColor }}
                >
                  <Terminal size={15} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white leading-tight">Ga verder in Claude Code</p>
                  <p className="text-[10px] text-white/40 mt-0.5 leading-tight">
                    Start opent iTerm2 op de juiste host (op basis van worktree), typt <code className="text-emerald-300">claude</code> + Enter en laadt deze prompt. Of plak ’m handmatig.
                  </p>
                </div>
              </div>
              <button onClick={() => setOpen(false)} className="text-white/50 hover:text-white transition-colors">
                <X size={16} />
              </button>
            </div>

            <div className="p-5 space-y-3">
              <textarea
                readOnly
                rows={Math.min(20, prompt.split('\n').length + 1)}
                value={prompt}
                onFocus={(e) => e.currentTarget.select()}
                className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2.5 text-[12px] text-white/80 font-mono leading-relaxed resize-none outline-none focus:border-white/25"
              />

              {launched ? (
                <div className="rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-2.5 text-[11px] text-emerald-200">
                  ✓ Gestart op <span className="font-mono font-semibold">{launched.machine_id}</span> — iTerm2 opent in <span className="font-mono">{launched.worktree_path}</span>, typt <span className="font-mono">claude</span> en laadt de prompt.
                  {launched.from_mobile ? (
                    <div className="mt-2 pt-2 border-t border-emerald-400/20">
                      <span className="block text-emerald-100/90">📱 Mobiel herkend — sessie draait in tmux <span className="font-mono">{/* session */}gedeeld venster</span>. Open Terminus en koppel met de machine:</span>
                      {launched.terminus_link && (
                        <a href={launched.terminus_link} className="inline-block mt-1.5 px-2.5 py-1 rounded-md bg-emerald-500/20 border border-emerald-400/40 text-emerald-100 font-medium">
                          Open in Terminus → {launched.machine_id}
                        </a>
                      )}
                      {launched.attach_cmd && (
                        <code className="block mt-1.5 text-[10px] bg-black/30 px-2 py-1 rounded text-emerald-300 font-mono break-all">{launched.attach_cmd}</code>
                      )}
                    </div>
                  ) : (
                    <span className="block text-emerald-300/60 mt-1">Verschijnt niet? Controleer of de resume-listener op {launched.machine_id} draait.</span>
                  )}
                </div>
              ) : (
                <button
                  onClick={start}
                  disabled={launching}
                  className="w-full inline-flex items-center justify-center gap-2 text-xs font-semibold py-2.5 rounded-lg bg-emerald-500/15 border border-emerald-400/40 text-emerald-200 hover:bg-emerald-500/25 disabled:opacity-50 transition-colors"
                >
                  <Terminal size={13} /> {launching ? 'Starten…' : 'Start in Claude (open iTerm2 + laad prompt)'}
                </button>
              )}
              {launchErr && <p className="text-[11px] text-red-400">{launchErr}</p>}

              <div className="flex items-center gap-2">
                <button
                  onClick={copy}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 text-xs font-medium py-2.5 rounded-lg border transition-colors"
                  style={
                    copied
                      ? { backgroundColor: '#34d39922', borderColor: '#34d39955', color: '#6ee7b7' }
                      : { backgroundColor: `${companyColor}1a`, borderColor: `${companyColor}55`, color: companyColor }
                  }
                >
                  {copied ? <Check size={13} /> : <Copy size={13} />}
                  {copied ? 'Gekopieerd' : 'Kopieer prompt (handmatig)'}
                </button>
                <button
                  onClick={() => setOpen(false)}
                  className="inline-flex items-center justify-center gap-1.5 border border-white/10 text-white/70 hover:bg-white/[0.06] text-xs font-medium px-4 py-2.5 rounded-lg transition-colors"
                >
                  Sluiten
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
