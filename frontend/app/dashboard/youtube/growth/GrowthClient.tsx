'use client'

import { useState } from 'react'
import { Loader2, RefreshCw, ChevronDown, ChevronUp, Lightbulb, Brain, FileText, AlertCircle, CheckCircle2 } from 'lucide-react'

type Idea = {
  title:             string
  hook_15s:          string
  thumbnail_concept: string
  viral_trigger:     string
}

type Report = {
  id: string
  title: string | null
  summaryMd: string | null
  generatedAt: string
  agent: string | null
} | null

type Props = {
  channelNaam:     string
  channelId:       string | null
  mediaHoldingId:  string | null
  viewCount:       number
  subscriberCount: number
  videoCount:      number
  oauthStatus:     string
  lastSync:        string | null
  initialIdeas:    Idea[]
  generatedAt:     string | null
  report:          Report
}

const CHANNEL_COLORS: Record<string, string> = {
  VermogenTv:         '#6366f1',
  SpaarTv:            '#10b981',
  VastgoedTv:         '#0ea5e9',
  CryptoVermogen:     '#f59e0b',
  BeleggingsTv:       '#8b5cf6',
  PropertyInvestorTv: '#ec4899',
  'BrickPulse Lab':   '#f97316',
  'LoopForge AI':     '#14b8a6',
  'LoopForge Lab':    '#14b8a6',
  SliceTheory:        '#a855f7',
  AquierTv:           '#22d3ee',
  AquierTvEs:         '#06b6d4',
}

function fmt(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return String(n)
}

function timeAgo(iso: string | null): string {
  if (!iso) return '—'
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000)
  if (mins < 1) return 'zojuist'
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}u`
  const days = Math.floor(hrs / 24)
  return `${days}d`
}

export default function GrowthClient(props: Props) {
  const { channelNaam, viewCount, subscriberCount, videoCount, oauthStatus, lastSync, initialIdeas, report } = props
  const [ideas,     setIdeas]     = useState<Idea[]>(initialIdeas)
  const [genAt,     setGenAt]     = useState<string | null>(props.generatedAt)
  const [loading,   setLoading]   = useState(false)
  const [running,   setRunning]   = useState(false)
  const [runResult, setRunResult] = useState<{ ok: boolean; msg: string } | null>(null)
  const [open,      setOpen]      = useState(false)
  const [expanded,  setExpanded]  = useState<number | null>(null)

  const color = CHANNEL_COLORS[channelNaam] ?? '#6366f1'
  const oauthOk = oauthStatus === 'connected'

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

  async function runAnalyst() {
    setRunning(true)
    setRunResult(null)
    try {
      const res = await fetch('/api/executive-layer/agents/run/channel_manager', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(props.mediaHoldingId ? { channel_id: props.mediaHoldingId } : {}),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setRunResult({ ok: false, msg: data.error ?? `HTTP ${res.status}` })
      } else {
        setRunResult({ ok: true, msg: 'analyst gestart' })
        setTimeout(() => setRunResult(null), 6000)
      }
    } catch (e) {
      setRunResult({ ok: false, msg: e instanceof Error ? e.message : String(e) })
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="bg-white/[0.04] border border-white/5 rounded-xl overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-white/[0.03] transition-colors gap-3"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
          <span className="text-sm font-medium text-white/80 truncate">{channelNaam}</span>
          <span
            className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium shrink-0 ${oauthOk ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}
            title={`OAuth ${oauthStatus}`}
          >
            {oauthOk ? 'OAuth ✓' : 'OAuth expired'}
          </span>
        </div>
        <div className="hidden sm:flex items-center gap-4 text-[10px] text-white/45 font-mono shrink-0">
          <span title="Views">{fmt(viewCount)} v</span>
          <span title="Subs">{fmt(subscriberCount)} s</span>
          <span title="Videos">{videoCount} vids</span>
          <span title="Last sync" className="text-white/30">sync {timeAgo(lastSync)}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0" onClick={e => e.stopPropagation()}>
          {runResult && (
            <span className={`text-[10px] flex items-center gap-1 ${runResult.ok ? 'text-emerald-400' : 'text-red-400'}`}>
              {runResult.ok ? <CheckCircle2 size={10} /> : <AlertCircle size={10} />} {runResult.msg}
            </span>
          )}
          <button
            onClick={runAnalyst}
            disabled={running}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/20 text-sky-300 text-[11px] transition-colors disabled:opacity-50"
            title="Run YouTube Analyst voor dit kanaal"
          >
            {running ? <Loader2 size={11} className="animate-spin" /> : <Brain size={11} />}
            Analyst
          </button>
          <button
            onClick={generateIdeas}
            disabled={loading}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white/90 text-[11px] transition-colors disabled:opacity-50"
            title="Genereer virale video-ideeën"
          >
            {loading ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />}
            Ideeën
          </button>
          <div className="text-white/30 pointer-events-none">
            {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </div>
        </div>
      </div>

      {/* Expanded body */}
      {open && (
        <div className="border-t border-white/[0.05]">
          {/* Latest analyst report */}
          <div className="px-4 py-3 border-b border-white/[0.04]">
            <div className="flex items-center gap-2 mb-2">
              <FileText size={11} className="text-sky-400" />
              <h3 className="text-[10px] font-semibold text-sky-300 uppercase tracking-wide">Laatste Analyst-rapport</h3>
              {report?.generatedAt && (
                <span className="text-[10px] text-white/30 font-mono">
                  · {new Date(report.generatedAt).toLocaleDateString('nl-NL', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })}
                </span>
              )}
              {report?.agent && (
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 text-white/40">{report.agent}</span>
              )}
            </div>
            {!report ? (
              <p className="text-xs text-white/30 py-2">Geen analyst-rapport. Klik &ldquo;Analyst&rdquo; om er een te genereren (channel_manager).</p>
            ) : (
              <div className="bg-white/[0.03] rounded-lg p-3 max-h-60 overflow-y-auto">
                <p className="text-[11px] font-medium text-white/80 mb-2">{report.title}</p>
                <pre className="text-[11px] text-white/60 leading-relaxed whitespace-pre-wrap font-sans">{report.summaryMd ?? '(geen samenvatting)'}</pre>
              </div>
            )}
          </div>

          {/* Virale ideeën */}
          <div className="px-4 py-3">
            <div className="flex items-center gap-2 mb-2">
              <Lightbulb size={11} className="text-amber-400" />
              <h3 className="text-[10px] font-semibold text-amber-300 uppercase tracking-wide">
                Virale ideeën {ideas.length > 0 ? `(${ideas.length})` : ''}
              </h3>
              {genAt && (
                <span className="text-[10px] text-white/30 font-mono">
                  · {new Date(genAt).toLocaleDateString('nl-NL', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })}
                </span>
              )}
            </div>
            {ideas.length === 0 ? (
              <p className="text-xs text-white/30 py-3">Geen ideeën. Klik &ldquo;Ideeën&rdquo; om te genereren.</p>
            ) : (
              <div className="divide-y divide-white/[0.04]">
                {ideas.map((idea, i) => (
                  <div key={i} className="py-2 first:pt-0 last:pb-0">
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
                            <p className="text-xs text-white/60 leading-relaxed italic">&ldquo;{idea.hook_15s}&rdquo;</p>
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
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
