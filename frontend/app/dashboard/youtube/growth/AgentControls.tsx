'use client'

import { useState } from 'react'
import { Brain, Megaphone, Activity, Eye, Banknote, Crown, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react'

type AgentKey = 'atlas' | 'channel_manager' | 'algorithm_strategist' | 'content_fund_manager' | 'retention_scientist' | 'viral_analyst'

type AgentRow = {
  key: string
  name: string
  lastRunAt: string | null
  lastRunStatus: string | null
  enabled: boolean
}

const AGENTS: Array<{ key: AgentKey; label: string; subtitle: string; icon: React.ComponentType<{ size?: number; className?: string }>; group: 'analyst' | 'marketing' }> = [
  { key: 'channel_manager',     label: 'Channel Analyst',      subtitle: 'Per-kanaal deep-dive (aanbevelingen + acties)',          icon: Brain,     group: 'analyst' },
  { key: 'viral_analyst',       label: 'Viral Analyst',        subtitle: 'Post-publish forensics — wat sloeg aan en waarom',       icon: Eye,       group: 'analyst' },
  { key: 'retention_scientist', label: 'Retention Scientist',  subtitle: 'Hook/pacing optimisatie op basis van retentie-curves',   icon: Activity,  group: 'analyst' },
  { key: 'atlas',               label: 'ATLAS · CEO Briefing', subtitle: 'Dagelijkse strategische prioriteiten voor het netwerk',  icon: Crown,     group: 'marketing' },
  { key: 'algorithm_strategist',label: 'Algorithm Strategist', subtitle: 'Upload-timing, swarm & pivot signalen',                  icon: Megaphone, group: 'marketing' },
  { key: 'content_fund_manager',label: 'Content Fund Manager', subtitle: 'Budget herallocatie tussen kanalen (op/afschalen)',     icon: Banknote,  group: 'marketing' },
]

function timeAgo(iso: string | null): string {
  if (!iso) return 'nog niet gedraaid'
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diffMs / 60_000)
  if (mins < 1) return 'zojuist'
  if (mins < 60) return `${mins} min geleden`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs} uur geleden`
  const days = Math.floor(hrs / 24)
  return `${days} dag${days === 1 ? '' : 'en'} geleden`
}

export default function AgentControls({ agents }: { agents: AgentRow[] }) {
  const byKey = new Map(agents.map(a => [a.key, a]))
  const [running, setRunning] = useState<Record<string, boolean>>({})
  const [result,  setResult]  = useState<Record<string, { ok: boolean; msg: string } | null>>({})

  async function run(key: AgentKey) {
    setRunning(s => ({ ...s, [key]: true }))
    setResult(s => ({ ...s, [key]: null }))
    try {
      const res = await fetch(`/api/executive-layer/agents/run/${key}`, { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setResult(s => ({ ...s, [key]: { ok: false, msg: data.error ?? `HTTP ${res.status}` } }))
      } else {
        setResult(s => ({ ...s, [key]: { ok: true, msg: 'gestart — herlaad over ~30s' } }))
        setTimeout(() => setResult(s => ({ ...s, [key]: null })), 8000)
      }
    } catch (e) {
      setResult(s => ({ ...s, [key]: { ok: false, msg: e instanceof Error ? e.message : String(e) } }))
    } finally {
      setRunning(s => ({ ...s, [key]: false }))
    }
  }

  function renderGroup(group: 'analyst' | 'marketing') {
    const items = AGENTS.filter(a => a.group === group)
    return (
      <div className="space-y-2">
        {items.map(a => {
          const meta = byKey.get(a.key)
          const Icon = a.icon
          const r = result[a.key]
          return (
            <div key={a.key} className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-white/[0.03] border border-white/[0.05]">
              <div className="w-7 h-7 rounded-md bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                <Icon size={13} className={group === 'analyst' ? 'text-sky-400' : 'text-fuchsia-400'} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-xs font-medium text-white/85 truncate">{a.label}</p>
                  {meta && !meta.enabled && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 text-white/40">disabled</span>
                  )}
                </div>
                <p className="text-[10px] text-white/40 truncate">{a.subtitle}</p>
                <p className="text-[10px] text-white/30 mt-0.5">
                  Laatste run: <span className="font-mono">{timeAgo(meta?.lastRunAt ?? null)}</span>
                  {meta?.lastRunStatus && <span className="ml-1 text-white/40">· {meta.lastRunStatus}</span>}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {r && (
                  <span className={`text-[10px] flex items-center gap-1 ${r.ok ? 'text-emerald-400' : 'text-red-400'}`}>
                    {r.ok ? <CheckCircle2 size={11} /> : <AlertCircle size={11} />} {r.msg}
                  </span>
                )}
                <button
                  onClick={() => run(a.key)}
                  disabled={running[a.key]}
                  className="text-[11px] px-3 py-1.5 rounded-md bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white disabled:opacity-50 flex items-center gap-1.5"
                >
                  {running[a.key] ? <Loader2 size={11} className="animate-spin" /> : null}
                  {running[a.key] ? 'Bezig…' : 'Run'}
                </button>
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="bg-sky-500/[0.04] border border-sky-500/15 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Brain size={14} className="text-sky-400" />
          <h2 className="text-[11px] font-semibold text-sky-300 uppercase tracking-wide">YouTube Analyst</h2>
        </div>
        <p className="text-[10px] text-white/40 mb-3">Analyseert kanaal-prestaties, hooks, retentie. Geen strategie-wijzigingen.</p>
        {renderGroup('analyst')}
      </div>
      <div className="bg-fuchsia-500/[0.04] border border-fuchsia-500/15 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Megaphone size={14} className="text-fuchsia-400" />
          <h2 className="text-[11px] font-semibold text-fuchsia-300 uppercase tracking-wide">Marketing Agent — Strategie</h2>
        </div>
        <p className="text-[10px] text-white/40 mb-3">Stelt strategie bij: op/afschaling, budget herallocatie, upload-windows.</p>
        {renderGroup('marketing')}
      </div>
    </div>
  )
}
