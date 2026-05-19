import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import {
  Tv2, Zap, Target, CheckCircle2, AlertTriangle, Circle,
  TrendingUp, Video, Upload, Server, Layers, BarChart2,
  Calendar,
} from 'lucide-react'
import Image from 'next/image'

function num(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + 'M'
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + 'K'
  return String(n)
}

function pct(actual: number, target: number) {
  if (target === 0) return 0
  return Math.min(100, Math.round((actual / target) * 100))
}

function dagNr(startDate: string): number {
  const start = new Date(startDate)
  const now   = new Date()
  const diff  = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
  return Math.min(10, Math.max(1, diff + 1))
}

const FASE_STATUS_STYLE: Record<string, string> = {
  active:    'bg-violet-500/15 border-violet-500/25 text-violet-400',
  building:  'bg-amber-500/15 border-amber-500/25 text-amber-400',
  pending:   'bg-white/5 border-white/10 text-white/35',
  completed: 'bg-emerald-500/15 border-emerald-500/25 text-emerald-400',
}

const FASE_STATUS_LABEL: Record<string, string> = {
  active:    'Actief',
  building:  'Bouwen',
  pending:   'Gepland',
  completed: 'Voltooid',
}

export default async function MediaHoldingPage() {
  const supabase = await createClient()

  const now = new Date().toISOString()
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()

  const [
    { data: campaigns },
    { data: daily },
    { data: channels },
    { count: queueCount },
    { data: workers },
    { data: phases },
    { data: modules },
  ] = await Promise.all([
    supabase.from('youtube_strategy_campaigns').select('*').eq('status', 'active').order('channel_slug'),
    supabase.from('youtube_strategy_daily').select('*').order('dag_nr'),
    supabase.from('youtube_channels').select('id,naam,channel_slug,accent_color,logo_svg_path,content_language,daily_upload_target,shorts_first').in('channel_slug', ['slice-theory','brick-pulse-lab','loop-forge-ai']),
    supabase.from('youtube_upload_queue').select('*', { count: 'exact', head: true }).in('status', ['queued','uploading']),
    supabase.from('infra_workers').select('worker_name,status,last_heartbeat').gte('last_heartbeat', fiveMinAgo),
    supabase.from('media_holding_phases').select('*').order('fase_nr'),
    supabase.from('media_holding_modules').select('*').order('fase_nr').order('module_key'),
  ])

  const cList    = campaigns ?? []
  const dList    = daily     ?? []
  const phList   = phases    ?? []
  const modList  = modules   ?? []

  const totalViews   = dList.reduce((s, d) => s + (d.views_actual ?? 0), 0)
  const totalTarget  = 840_000
  const totalUploads = dList.reduce((s, d) => s + (d.uploads_actual ?? 0), 0)
  const breakouts    = dList.filter(d => d.breakout_detected).length
  const currentDag   = cList.length > 0 ? dagNr(cList[0].start_date) : 1
  const activeWorkers = (workers ?? []).length

  const viewsToday = dList.filter(d => d.dag_nr === currentDag).reduce((s, d) => s + (d.views_actual ?? 0), 0)

  const KPI_CARDS = [
    { label: 'Totaal views',    value: num(totalViews),        sub: `target ${num(totalTarget)}`,      color: 'text-violet-400',  icon: TrendingUp },
    { label: 'Views vandaag',   value: num(viewsToday),        sub: `dag ${currentDag} van 10`,        color: 'text-indigo-400',  icon: BarChart2  },
    { label: 'Actieve kanalen', value: String(channels?.length ?? 0), sub: 'shorts-only kanalen',      color: 'text-sky-400',     icon: Video      },
    { label: 'Upload queue',    value: String(queueCount ?? 0), sub: 'wachtend + uploaden',            color: 'text-amber-400',   icon: Upload     },
    { label: 'Workers online',  value: String(activeWorkers),  sub: 'actief afgelopen 5 min',         color: 'text-emerald-400', icon: Server     },
  ]

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
            <p className="text-xs text-white/45">Phase 1 actief · 3 kanalen · AI media infrastructure</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-violet-500/15 border border-violet-500/25 text-[10px] font-semibold text-violet-400 uppercase tracking-wide">
            <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
            LIVE
          </span>
          <Link
            href="/dashboard/media-holding/build"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-white/60 hover:text-white/80 hover:bg-white/8 transition-colors"
          >
            <Layers size={11} /> Build Tracker
          </Link>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {KPI_CARDS.map(k => {
          const Icon = k.icon
          return (
            <div key={k.label} className="bg-white/[0.04] border border-white/8 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Icon size={13} className={k.color} />
                <p className="text-[10px] text-white/40 uppercase tracking-wide">{k.label}</p>
              </div>
              <p className={`text-2xl font-black tabular-nums ${k.color}`}>{k.value}</p>
              <p className="text-[11px] text-white/30 mt-0.5">{k.sub}</p>
            </div>
          )
        })}
      </div>

      {/* Phase 1 progress */}
      <div className="bg-white/[0.04] border border-white/8 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-xs text-white/50 uppercase tracking-wide">Phase 1 — Views voortgang</p>
            <p className="text-3xl font-black text-white tabular-nums mt-0.5">
              {num(totalViews)}
              <span className="text-sm font-normal text-white/35 ml-2">/ {num(totalTarget)}</span>
            </p>
          </div>
          <div className="text-right space-y-0.5">
            <div>
              <p className="text-[10px] text-white/40 uppercase tracking-wide">Uploads</p>
              <p className="text-xl font-bold text-white tabular-nums">{totalUploads}</p>
            </div>
            <div className="px-3 py-1 rounded-lg bg-white/5 border border-white/10 text-xs text-white/60">
              <span className="text-white font-semibold">Dag {currentDag}</span> van 10
            </div>
          </div>
        </div>
        <div className="w-full h-2.5 bg-white/8 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-violet-500 to-indigo-400 rounded-full transition-all duration-700"
            style={{ width: `${pct(totalViews, totalTarget)}%` }}
          />
        </div>
        <div className="flex items-center justify-between mt-2">
          <p className="text-xs text-white/40">{pct(totalViews, totalTarget)}% van 840K doel</p>
          <div className="flex items-center gap-4">
            {breakouts > 0 && (
              <span className="flex items-center gap-1 text-xs text-amber-400">
                <Zap size={11} /> {breakouts} breakout{breakouts > 1 ? 's' : ''}
              </span>
            )}
            <span className="text-xs text-white/35">{num(Math.max(0, totalTarget - totalViews))} resterend</span>
          </div>
        </div>
      </div>

      {/* 3 kanaalkaarten */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {cList.map(c => {
          const channelDaily  = dList.filter(d => d.channel_slug === c.channel_slug)
          const viewsActual   = channelDaily.reduce((s, d) => s + (d.views_actual ?? 0), 0)
          const uploadsActual = channelDaily.reduce((s, d) => s + (d.uploads_actual ?? 0), 0)
          const progress      = pct(viewsActual, c.target_views_total)
          const todayRow      = channelDaily.find(d => d.dag_nr === currentDag)
          const todayViews    = todayRow?.views_actual ?? 0
          const hasBreakout   = channelDaily.some(d => d.breakout_detected)
          const color         = c.accent_color ?? '#ffffff'
          const onTrack       = viewsActual >= (c.target_views_daily * (currentDag - 1))

          return (
            <div key={c.id} className="bg-white/[0.04] border border-white/8 rounded-2xl p-5 space-y-4 hover:border-white/12 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl overflow-hidden bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                  {c.logo_path ? (
                    <Image src={c.logo_path} alt={c.naam} width={36} height={36} className="object-cover" />
                  ) : (
                    <Target size={14} className="text-white/30" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{c.naam}</p>
                  <p className="text-xs text-white/40">{c.target_uploads_daily} Shorts/dag</p>
                </div>
                {hasBreakout && (
                  <span className="ml-auto text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/25 text-amber-400 flex items-center gap-1 shrink-0">
                    <Zap size={9} /> BREAKOUT
                  </span>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs text-white/50">Views</span>
                  <span className="text-xs font-semibold text-white tabular-nums">{num(viewsActual)} / {num(c.target_views_total)}</span>
                </div>
                <div className="w-full h-1.5 bg-white/8 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-700" style={{ width: `${progress}%`, backgroundColor: color }} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="bg-white/[0.04] rounded-lg p-2.5">
                  <p className="text-[10px] text-white/40">Vandaag</p>
                  <p className="text-lg font-bold text-white tabular-nums">{num(todayViews)}</p>
                </div>
                <div className="bg-white/[0.04] rounded-lg p-2.5">
                  <p className="text-[10px] text-white/40">Uploads</p>
                  <p className="text-lg font-bold text-white tabular-nums">{uploadsActual}</p>
                </div>
              </div>

              <div className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border ${
                hasBreakout ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                  : onTrack  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                             : 'bg-red-500/10 border-red-500/20 text-red-400'
              }`}>
                {hasBreakout ? <Zap size={11}/> : onTrack ? <CheckCircle2 size={11}/> : <AlertTriangle size={11}/>}
                {hasBreakout ? 'Breakout gedetecteerd!' : onTrack ? 'On track' : 'Achterstand — opschalen'}
              </div>
            </div>
          )
        })}
      </div>

      {/* 6 fases build status */}
      <div>
        <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
          <Layers size={14} className="text-white/50" /> Build Voortgang — 6 Fases
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {phList.map(fase => {
            const faseMods = modList.filter(m => m.fase_nr === fase.fase_nr)
            const liveMods = faseMods.filter(m => m.status === 'live').length
            return (
              <div key={fase.id} className="bg-white/[0.04] border border-white/8 rounded-xl p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-[10px] text-white/35 uppercase tracking-wide mb-0.5">Fase {fase.fase_nr}</p>
                    <p className="text-sm font-semibold text-white">{fase.naam}</p>
                  </div>
                  <span className={`shrink-0 text-[10px] font-medium px-2 py-0.5 rounded-full border ${FASE_STATUS_STYLE[fase.status]}`}>
                    {FASE_STATUS_LABEL[fase.status]}
                  </span>
                </div>

                <div className="w-full h-1.5 bg-white/8 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${fase.voortgang}%`,
                      backgroundColor: fase.status === 'active' ? '#a78bfa' : fase.status === 'building' ? '#fbbf24' : fase.status === 'completed' ? '#34d399' : '#ffffff20',
                    }}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <p className="text-xs text-white/40">{fase.voortgang}% voltooid</p>
                  <p className="text-xs text-white/40">{liveMods}/{faseMods.length} modules live</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* CTA strip */}
      <div className="flex flex-wrap gap-2">
        <Link href="/dashboard/youtube/strategy" className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-violet-500/15 border border-violet-500/20 text-violet-400 hover:bg-violet-500/25 transition-colors text-xs font-medium">
          <Calendar size={12} /> Dagelijkse invoer
        </Link>
        <Link href="/dashboard/youtube/mission-control" className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-500/15 border border-indigo-500/20 text-indigo-400 hover:bg-indigo-500/25 transition-colors text-xs font-medium">
          <Zap size={12} /> Mission Control
        </Link>
        <Link href="/dashboard/media-holding/channels" className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-sky-500/15 border border-sky-500/20 text-sky-400 hover:bg-sky-500/25 transition-colors text-xs font-medium">
          <Video size={12} /> Alle kanalen
        </Link>
        <Link href="/dashboard/media-holding/build" className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white/60 hover:text-white/80 hover:bg-white/8 transition-colors text-xs font-medium">
          <Layers size={12} /> Build Tracker
        </Link>
        <Link href="/dashboard/youtube/analytics" className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white/60 hover:text-white/80 hover:bg-white/8 transition-colors text-xs font-medium">
          <BarChart2 size={12} /> Analytics
        </Link>
      </div>
    </div>
  )
}
