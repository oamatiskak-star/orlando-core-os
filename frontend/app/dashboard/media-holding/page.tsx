import { createClient } from '@/lib/supabase/server'
import {
  Tv2, TrendingUp, Video, Zap, Layers, Target,
  CheckCircle2, Circle, AlertTriangle,
} from 'lucide-react'
import Link from 'next/link'

const PHASE1_CHANNELS = ['SliceTheory', 'BrickPulse Lab', 'LoopForge AI']
const PHASE1_TARGET   = 840_000

function num(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + 'M'
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + 'K'
  return String(n)
}

const FASE_STYLE = {
  active:    { wrap: 'border-violet-500/25 bg-violet-500/[0.07]', badge: 'bg-violet-500/15 text-violet-400 border-violet-500/25', bar: '#8b5cf6', label: 'Actief' },
  building:  { wrap: 'border-amber-500/25  bg-amber-500/[0.07]',  badge: 'bg-amber-500/15  text-amber-400  border-amber-500/25',  bar: '#fbbf24', label: 'Bouwen' },
  pending:   { wrap: 'border-white/8        bg-white/[0.03]',      badge: 'bg-white/5       text-white/30   border-white/10',      bar: '#ffffff20', label: 'Gepland' },
  completed: { wrap: 'border-emerald-500/25 bg-emerald-500/[0.07]',badge: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25', bar: '#34d399', label: 'Voltooid' },
}

export default async function MediaHoldingPage() {
  const supabase = await createClient()

  const [
    { data: allChannels },
    { count: queuedCount },
    { data: phases },
    { data: modules },
    { data: workers },
  ] = await Promise.all([
    supabase.from('youtube_channels').select('id,naam,name,view_count,subscriber_count,oauth_connected,daily_upload_target,content_language,shorts_first'),
    supabase.from('youtube_videos').select('id', { count: 'exact', head: true }).eq('status', 'queued'),
    supabase.from('media_holding_phases').select('*').order('fase_nr'),
    supabase.from('media_holding_modules').select('fase_nr,status'),
    supabase.from('media_holding_workers').select('status'),
  ])

  const chList     = allChannels ?? []
  const p1Channels = chList.filter(c => PHASE1_CHANNELS.includes(c.naam ?? c.name ?? ''))
  const totalViews = p1Channels.reduce((s, c) => s + (c.view_count ?? 0), 0)
  const connectedCount = chList.filter(c => c.oauth_connected).length
  const phList    = phases ?? []
  const modList   = modules ?? []
  const wList     = workers ?? []
  const activeWorkers = wList.filter(w => ['idle', 'running'].includes(w.status)).length
  const progressPct   = Math.min(100, Math.round((totalViews / PHASE1_TARGET) * 100))

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
            <Tv2 size={16} className="text-violet-400" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-white">Media Holding OS</h1>
            <p className="text-xs text-white/45">Phase 1 actief · 3 kanalen · Shorts engine running</p>
          </div>
        </div>
        <span className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse inline-block" />
          LIVE
        </span>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        <KpiCard label="Totaal views"    value={num(totalViews)}              color="text-white" />
        <KpiCard label="Views vandaag"   value="—"                            color="text-white/50" />
        <KpiCard label="Kanalen actief"  value={String(connectedCount)}       color="text-emerald-300" />
        <KpiCard label="Upload queue"    value={String(queuedCount ?? 0)}     color="text-violet-300" />
        <KpiCard label="Workers"         value={`${activeWorkers}/${wList.length}`} color="text-sky-300" />
      </div>

      {/* Phase 1 progress */}
      <div className="bg-white/[0.04] border border-white/8 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Target size={14} className="text-violet-400" />
            <span className="text-sm font-semibold text-white">Phase 1 — Cashflow First</span>
          </div>
          <span className="text-xs text-white/45 tabular-nums">{num(totalViews)} / 840K views</span>
        </div>
        <div className="w-full h-2.5 bg-white/[0.07] rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${progressPct}%`,
              background: 'linear-gradient(to right, #8b5cf6, #6366f1)',
              minWidth: progressPct > 0 ? '6px' : '0',
            }}
          />
        </div>
        <div className="flex justify-between mt-2">
          <span className="text-[10px] text-white/30">{progressPct}% behaald</span>
          <span className="text-[10px] text-white/30">3 kanalen · Shorts-first · EN</span>
        </div>
      </div>

      {/* Phase 1 channel grid */}
      <div>
        <h2 className="text-[10px] font-semibold text-white/40 uppercase tracking-wider mb-3">Phase 1 Kanalen</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {p1Channels.length > 0 ? p1Channels.map(ch => (
            <div key={ch.id} className="bg-white/[0.04] border border-white/8 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center shrink-0">
                    <Video size={13} className="text-violet-400" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">{ch.naam ?? ch.name}</p>
                    <p className="text-[10px] text-white/35">Shorts-first · {(ch.content_language ?? 'en').toUpperCase()}</p>
                  </div>
                </div>
                {ch.oauth_connected && (
                  <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                    Live
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-white/[0.04] rounded-lg p-2">
                  <p className="text-[10px] text-white/35 uppercase">Views</p>
                  <p className="text-base font-bold text-white tabular-nums">{num(ch.view_count ?? 0)}</p>
                </div>
                <div className="bg-white/[0.04] rounded-lg p-2">
                  <p className="text-[10px] text-white/35 uppercase">Doel/dag</p>
                  <p className="text-base font-bold text-violet-400 tabular-nums">{ch.daily_upload_target ?? 0}</p>
                </div>
              </div>
            </div>
          )) : (
            <div className="col-span-3 py-8 text-center text-sm text-white/25">
              Kanalen worden geladen…
            </div>
          )}
        </div>
      </div>

      {/* 6 fases build status */}
      <div>
        <h2 className="text-[10px] font-semibold text-white/40 uppercase tracking-wider mb-3">Build Status — 6 Fases</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {phList.map(fase => {
            const faseMods  = modList.filter(m => m.fase_nr === fase.fase_nr)
            const liveCount = faseMods.filter(m => m.status === 'live').length
            const s         = FASE_STYLE[fase.status as keyof typeof FASE_STYLE] ?? FASE_STYLE.pending
            return (
              <div key={fase.id} className={`border rounded-xl p-3 space-y-2 ${s.wrap}`}>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-white/35 font-medium">F{fase.fase_nr}</span>
                  <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full border ${s.badge}`}>
                    {s.label}
                  </span>
                </div>
                <p className="text-xs font-semibold text-white/80 leading-tight">{fase.naam}</p>
                <div className="w-full h-1 bg-white/[0.07] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${fase.voortgang ?? 0}%`, backgroundColor: s.bar }}
                  />
                </div>
                <p className="text-[10px] text-white/30 tabular-nums">
                  {liveCount}/{faseMods.length} modules · {fase.voortgang ?? 0}%
                </p>
              </div>
            )
          })}
        </div>
      </div>

      {/* CTA buttons */}
      <div className="flex flex-wrap gap-2 pt-1">
        <Link
          href="/dashboard/youtube/strategy"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-white/60 hover:text-white hover:bg-white/8 transition-colors"
        >
          <TrendingUp size={12} /> Dagelijkse invoer
        </Link>
        <Link
          href="/dashboard/youtube/mission-control"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-white/60 hover:text-white hover:bg-white/8 transition-colors"
        >
          <Zap size={12} /> Viral Intelligence
        </Link>
        <Link
          href="/dashboard/media-holding/channels"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-white/60 hover:text-white hover:bg-white/8 transition-colors"
        >
          <Video size={12} /> Alle kanalen
        </Link>
        <Link
          href="/dashboard/media-holding/build"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-500/10 border border-violet-500/20 text-xs text-violet-400 hover:bg-violet-500/15 transition-colors"
        >
          <Layers size={12} /> Build Tracker →
        </Link>
      </div>
    </div>
  )
}

function KpiCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-white/[0.04] border border-white/8 rounded-xl p-3.5">
      <p className="text-[10px] text-white/40 uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-xl font-semibold tabular-nums ${color}`}>{value}</p>
    </div>
  )
}
