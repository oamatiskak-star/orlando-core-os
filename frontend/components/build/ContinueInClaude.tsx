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

  const prompt = buildContinuePrompt(context)

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
                    Plak deze opdracht in een nieuwe Claude Code sessie (terminal) in de orlando-core-os repo.
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
                  {copied ? 'Gekopieerd' : 'Kopieer prompt'}
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
