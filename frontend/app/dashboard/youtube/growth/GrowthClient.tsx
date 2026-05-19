'use client'

import { useState } from 'react'
import { Loader2, RefreshCw, ChevronDown, ChevronUp, Lightbulb } from 'lucide-react'

type Idea = {
  title:             string
  hook_15s:          string
  thumbnail_concept: string
  viral_trigger:     string
}

type Props = {
  channelNaam:  string
  channelId:    string | null
  initialIdeas: Idea[]
  generatedAt:  string | null
}

const CHANNEL_COLORS: Record<string, string> = {
  VermogenTv:         '#6366f1',
  SpaarTv:            '#10b981',
  VastgoedTv:         '#0ea5e9',
  CryptoVermogen:     '#f59e0b',
  BeleggingsTv:       '#8b5cf6',
  PropertyInvestorTv: '#ec4899',
}

export default function GrowthClient({ channelNaam, initialIdeas, generatedAt }: Props) {
  const [ideas,     setIdeas]     = useState<Idea[]>(initialIdeas)
  const [genAt,     setGenAt]     = useState<string | null>(generatedAt)
  const [loading,   setLoading]   = useState(false)
  const [open,      setOpen]      = useState(false)
  const [expanded,  setExpanded]  = useState<number | null>(null)

  const color = CHANNEL_COLORS[channelNaam] ?? '#6366f1'

  async function generateIdeas() {
    setLoading(true)
    try {
      const res = await fetch('/api/youtube/research', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ channel_naam: channelNaam }),
      })
      const data = await res.json()
      if (data.ok && data.ideas) {
        setIdeas(data.ideas)
        setGenAt(new Date().toISOString())
        setOpen(true)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white/[0.04] border border-white/5 rounded-xl overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-white/[0.03] transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-center gap-2.5">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
          <span className="text-sm font-medium text-white/80">{channelNaam}</span>
          <span className="text-[10px] text-white/30">
            {ideas.length > 0 ? `${ideas.length} ideeën` : 'geen ideeën'}
          </span>
          {genAt && (
            <span className="text-[9px] text-white/20 font-mono">
              {new Date(genAt).toLocaleDateString('nl-NL', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
          <button
            onClick={generateIdeas}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/50 hover:text-white/80 text-[11px] transition-colors disabled:opacity-50"
          >
            {loading ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />}
            {loading ? 'Genereren...' : 'Genereer ideeën'}
          </button>
          <div className="text-white/30 pointer-events-none">
            {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </div>
        </div>
      </div>

      {/* Ideas list */}
      {open && (
        <div className="border-t border-white/[0.05] divide-y divide-white/[0.04]">
          {ideas.length === 0 ? (
            <div className="px-4 py-6 text-center">
              <Lightbulb size={20} className="text-white/20 mx-auto mb-2" />
              <p className="text-xs text-white/30">Geen ideeën. Klik "Genereer ideeën" om te starten.</p>
            </div>
          ) : (
            ideas.map((idea, i) => (
              <div key={i} className="px-4 py-3">
                <div
                  className="flex items-start justify-between gap-3 cursor-pointer"
                  onClick={() => setExpanded(expanded === i ? null : i)}
                >
                  <div className="flex items-start gap-2.5 min-w-0">
                    <span className="text-[10px] font-mono text-white/20 mt-0.5 w-4 shrink-0">{i + 1}</span>
                    <p className="text-xs font-medium text-white/80 leading-snug">{idea.title}</p>
                  </div>
                  <span className="text-white/20 shrink-0 mt-0.5">
                    {expanded === i ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  </span>
                </div>

                {expanded === i && (
                  <div className="mt-3 ml-6 space-y-3">
                    <div className="bg-white/[0.03] rounded-lg p-3 space-y-2">
                      <div>
                        <p className="text-[9px] font-semibold text-white/30 uppercase tracking-wide mb-1">Hook (eerste 15s)</p>
                        <p className="text-xs text-white/60 leading-relaxed italic">"{idea.hook_15s}"</p>
                      </div>
                      <div>
                        <p className="text-[9px] font-semibold text-white/30 uppercase tracking-wide mb-1">Thumbnail</p>
                        <p className="text-xs text-white/60 leading-relaxed">{idea.thumbnail_concept}</p>
                      </div>
                      <div>
                        <p className="text-[9px] font-semibold text-white/30 uppercase tracking-wide mb-1">Viral trigger</p>
                        <p className="text-xs text-amber-400/80 leading-relaxed">{idea.viral_trigger}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
