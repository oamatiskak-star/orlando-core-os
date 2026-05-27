import { createClient } from '@/lib/supabase/server'
import { Target, TrendingUp, Zap, Calendar, CheckCircle2, AlertTriangle, Circle } from 'lucide-react'
import Image from 'next/image'
import StrategyDailyLog from './StrategyDailyLog'

function pct(actual: number, target: number) {
  if (target === 0) return 0
  return Math.min(100, Math.round((actual / target) * 100))
}

function num(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + 'M'
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + 'K'
  return String(n)
}

function dagNr(startDate: string): number {
  const start = new Date(startDate)
  const now   = new Date()
  const diff  = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
  return Math.min(10, Math.max(1, diff + 1))
}

export default async function StrategyPage() {
  const supabase = await createClient()

  const [
    { data: campaigns },
    { data: daily },
    { data: planItems },
    { data: reports },
    { data: channelNames },
  ] = await Promise.all([
    supabase
      .from('youtube_strategy_campaigns')
      .select('*')
      .eq('status', 'active')
      .order('channel_slug'),
    supabase
      .from('youtube_strategy_daily')
      .select('*')
      .order('dag_nr'),
    supabase
      .from('planning_items')
      .select('id, type, status, priority, titel, beschrijving, due_date, notes')
      .eq('status', 'bezig')
      .order('priority', { ascending: false })
      .limit(20),
    supabase
      .from('channel_analyst_reports')
      .select('*')
      .order('health_score', { ascending: false }),
    supabase
      .from('youtube_channels')
      .select('id, naam'),
  ])

  const cList = campaigns ?? []
  const dList = daily ?? []
  const rList = reports ?? []
  const naamById = new Map((channelNames ?? []).map((c) => [c.id, c.naam]))

  const totalViewsActual = dList.reduce((s, d) => s + (d.views_actual ?? 0), 0)
  const totalTarget      = cList.reduce((s, c) => s + (c.target_views_total ?? 0), 0)
  const totalUploads     = dList.reduce((s, d) => s + (d.uploads_actual ?? 0), 0)
  const breakouts        = dList.filter(d => d.breakout_detected).length
  const currentDag       = cList.length > 0 ? dagNr(cList[0].start_date) : 1

  const STATUS_ICON: Record<string, React.ReactNode> = {
    open:       <Circle       size={13} className="text-white/30" />,
    bezig:      <TrendingUp   size={13} className="text-sky-400" />,
    gereed:     <CheckCircle2 size={13} className="text-emerald-400" />,
    geblokkeerd:<AlertTriangle size={13} className="text-red-400" />,
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
            <Zap size={16} className="text-violet-400" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-white">Viral Shorts Engine</h1>
            <p className="text-xs text-white/45">3 kanalen · 10 dagen · 840K views target</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-white/60">
            <span className="text-white font-semibold">Dag {currentDag}</span> van 10
          </div>
          {cList[0]?.end_date && (
            <div className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-white/50 flex items-center gap-1.5">
              <Calendar size={11} />
              Deadline {new Date(cList[0].end_date).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}
            </div>
          )}
        </div>
      </div>

      {/* Totaal progress */}
      <div className="bg-white/[0.04] border border-white/8 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-xs text-white/50 uppercase tracking-wide">Totaal views</p>
            <p className="text-3xl font-black text-white tabular-nums mt-0.5">
              {num(totalViewsActual)}
              <span className="text-sm font-normal text-white/35 ml-2">/ {num(totalTarget)}</span>
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-white/50 uppercase tracking-wide">Uploads</p>
            <p className="text-2xl font-bold text-white tabular-nums">{totalUploads}</p>
          </div>
        </div>
        <div className="w-full h-2.5 bg-white/8 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-violet-500 to-indigo-400 rounded-full transition-all duration-700"
            style={{ width: `${pct(totalViewsActual, totalTarget)}%` }}
          />
        </div>
        <div className="flex items-center justify-between mt-2">
          <p className="text-xs text-white/40">{pct(totalViewsActual, totalTarget)}% van doel</p>
          <div className="flex items-center gap-4">
            {breakouts > 0 && (
              <span className="flex items-center gap-1 text-xs text-amber-400">
                <Zap size={11} /> {breakouts} breakout{breakouts > 1 ? 's' : ''}
              </span>
            )}
            <span className="text-xs text-white/35">
              {num(Math.max(0, totalTarget - totalViewsActual))} resterend
            </span>
          </div>
        </div>
      </div>

      {/* Per-kanaal cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {cList.map(c => {
          const channelDaily = dList.filter(d => d.channel_slug === c.channel_slug)
          const viewsActual  = channelDaily.reduce((s, d) => s + (d.views_actual ?? 0), 0)
          const uploadsActual= channelDaily.reduce((s, d) => s + (d.uploads_actual ?? 0), 0)
          const progress     = pct(viewsActual, c.target_views_total)
          const todayRow     = channelDaily.find(d => d.dag_nr === currentDag)
          const todayViews   = todayRow?.views_actual ?? 0
          const todayTarget  = todayRow?.views_target ?? c.target_views_daily
          const hasBreakout  = channelDaily.some(d => d.breakout_detected)
          const color        = c.accent_color ?? '#ffffff'

          const onTrack = viewsActual >= (c.target_views_daily * (currentDag - 1))

          return (
            <div key={c.id} className="bg-white/[0.04] border border-white/8 rounded-2xl p-5 space-y-4 hover:border-white/12 transition-colors">
              {/* Channel header */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl overflow-hidden bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                  {c.logo_path ? (
                    <Image src={c.logo_path} alt={c.naam} width={40} height={40} className="object-cover"/>
                  ) : (
                    <Target size={16} className="text-white/30" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{c.naam}</p>
                  <p className="text-xs text-white/40">{c.target_uploads_daily} Shorts/dag</p>
                </div>
                {hasBreakout && (
                  <span className="ml-auto shrink-0 text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/25 text-amber-400 flex items-center gap-1">
                    <Zap size={9} /> BREAKOUT
                  </span>
                )}
              </div>

              {/* Progress bar */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs text-white/50">Views voortgang</span>
                  <span className="text-xs font-semibold text-white tabular-nums">{num(viewsActual)} / {num(c.target_views_total)}</span>
                </div>
                <div className="w-full h-1.5 bg-white/8 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${progress}%`, backgroundColor: color }}
                  />
                </div>
                <p className="text-[11px] mt-1" style={{ color }}>{progress}%</p>
              </div>

              {/* Today stats */}
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-white/[0.04] rounded-lg p-2.5">
                  <p className="text-[10px] text-white/40 uppercase tracking-wide">Vandaag</p>
                  <p className="text-lg font-bold text-white tabular-nums">{num(todayViews)}</p>
                  <p className="text-[10px] text-white/35">target {num(todayTarget)}</p>
                </div>
                <div className="bg-white/[0.04] rounded-lg p-2.5">
                  <p className="text-[10px] text-white/40 uppercase tracking-wide">Uploads</p>
                  <p className="text-lg font-bold text-white tabular-nums">{uploadsActual}</p>
                  <p className="text-[10px] text-white/35">target {c.target_uploads_daily * currentDag}</p>
                </div>
              </div>

              {/* Status badge */}
              <div className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border ${
                hasBreakout
                  ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                  : onTrack
                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                    : 'bg-red-500/10 border-red-500/20 text-red-400'
              }`}>
                {hasBreakout ? <Zap size={11}/> : onTrack ? <CheckCircle2 size={11}/> : <AlertTriangle size={11}/>}
                {hasBreakout ? 'Breakout gedetecteerd!' : onTrack ? 'On track' : 'Achterstand — opschalen'}
              </div>
            </div>
          )
        })}
      </div>

      {/* Analyse-agent — bewijst dat er geanalyseerd wordt + stuurt de strategie */}
      <div className="bg-white/[0.04] border border-white/8 rounded-2xl p-5">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <TrendingUp size={14} className="text-violet-400" />
            Analyse-agent — health & aanbevelingen
          </h2>
          {rList.length > 0 && rList[0].analyzed_at && (
            <span className="text-[11px] text-white/45">
              laatste analyse: {new Date(rList[0].analyzed_at).toLocaleString('nl-NL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>

        {rList.length === 0 ? (
          <p className="text-xs text-white/40 py-4 text-center">
            Nog geen analyse — de <code className="text-white/60">run-analyst</code> cron draait dagelijks 10:30 en vult dit.
          </p>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {rList.map((r) => {
              const naam = naamById.get(r.channel_id) ?? 'Onbekend kanaal'
              const g48 = r.growth_48h ?? 0
              const recs: string[] = Array.isArray(r.recommendations) ? r.recommendations : []
              return (
                <div key={r.channel_id} className="bg-white/[0.03] border border-white/5 rounded-xl p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-white truncate">{naam}</p>
                    <span className={`shrink-0 text-[10px] font-medium px-2 py-0.5 rounded-full border ${
                      r.on_track
                        ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                        : 'bg-red-500/10 border-red-500/20 text-red-400'
                    }`}>
                      {r.on_track ? 'on track' : 'achterstand'}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-white/[0.04] rounded-lg py-1.5">
                      <p className="text-[10px] text-white/40 uppercase">Health</p>
                      <p className="text-sm font-bold text-white tabular-nums">{r.health_score ?? 0}<span className="text-white/30 text-[10px]">/100</span></p>
                    </div>
                    <div className="bg-white/[0.04] rounded-lg py-1.5">
                      <p className="text-[10px] text-white/40 uppercase">Views</p>
                      <p className="text-sm font-bold text-white tabular-nums">{num(r.total_views ?? 0)}</p>
                    </div>
                    <div className="bg-white/[0.04] rounded-lg py-1.5">
                      <p className="text-[10px] text-white/40 uppercase">Groei 48u</p>
                      <p className={`text-sm font-bold tabular-nums ${g48 > 0 ? 'text-emerald-400' : g48 < 0 ? 'text-red-400' : 'text-white/60'}`}>
                        {g48 > 0 ? '+' : ''}{g48}%
                      </p>
                    </div>
                  </div>
                  {recs.length > 0 && (
                    <ul className="space-y-1">
                      {recs.slice(0, 3).map((rec, i) => (
                        <li key={i} className="text-[11px] text-white/60 leading-snug">{rec}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* 10-dag tijdlijn */}
      <div className="bg-white/[0.04] border border-white/8 rounded-2xl p-5">
        <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
          <Calendar size={14} className="text-white/50" />
          10-daagse tijdlijn
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-white/35 border-b border-white/5">
                <th className="text-left py-2 pr-3 font-medium">Dag</th>
                <th className="text-left py-2 pr-3 font-medium">Datum</th>
                <th className="text-right py-2 pr-3 font-medium">SliceTheory</th>
                <th className="text-right py-2 pr-3 font-medium">BrickPulse</th>
                <th className="text-right py-2 pr-3 font-medium">LoopForge</th>
                <th className="text-right py-2 pr-3 font-medium">Dag totaal</th>
                <th className="text-right py-2 font-medium">Cumulatief</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 10 }, (_, i) => i + 1).map(dag => {
                const datum = new Date('2026-05-19')
                datum.setDate(datum.getDate() + dag - 1)
                const datumStr = datum.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })
                const dagRows  = dList.filter(d => d.dag_nr === dag)
                const dagViews = dagRows.reduce((s, d) => s + (d.views_actual ?? 0), 0)
                const dagTarget= dagRows.reduce((s, d) => s + (d.views_target ?? 0), 0)
                const cumTarget= dag * (dagTarget / Math.max(1, dagRows.length)) * dagRows.length
                const cumActual= dList.filter(d => d.dag_nr <= dag).reduce((s, d) => s + (d.views_actual ?? 0), 0)
                const isToday  = dag === currentDag
                const isPast   = dag < currentDag
                const hasBreakoutDay = dagRows.some(d => d.breakout_detected)

                const sliceRow  = dagRows.find(d => d.channel_slug === 'slice-theory')
                const brickRow  = dagRows.find(d => d.channel_slug === 'brick-pulse-lab')
                const loopRow   = dagRows.find(d => d.channel_slug === 'loop-forge-ai')

                return (
                  <tr key={dag} className={`border-b border-white/[0.04] transition-colors ${
                    isToday ? 'bg-indigo-500/8' : isPast ? '' : 'opacity-50'
                  }`}>
                    <td className="py-2 pr-3">
                      <span className={`inline-flex items-center gap-1 font-medium ${isToday ? 'text-indigo-400' : isPast ? 'text-white/60' : 'text-white/25'}`}>
                        {isToday && <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse"/>}
                        {dag}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-white/40">{datumStr}</td>
                    <td className="py-2 pr-3 text-right">
                      <span className={sliceRow?.views_actual ? 'text-[#00d4ff]' : 'text-white/20'}>
                        {num(sliceRow?.views_actual ?? 0)}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-right">
                      <span className={brickRow?.views_actual ? 'text-[#f5c432]' : 'text-white/20'}>
                        {num(brickRow?.views_actual ?? 0)}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-right">
                      <span className={loopRow?.views_actual ? 'text-[#a78bfa]' : 'text-white/20'}>
                        {num(loopRow?.views_actual ?? 0)}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-right">
                      <span className={dagViews > 0 ? 'text-white/80 font-medium' : 'text-white/20'}>
                        {num(dagViews)}
                        {dagTarget > 0 && <span className="text-white/25 ml-1">/{num(dagTarget)}</span>}
                      </span>
                      {hasBreakoutDay && <Zap size={10} className="inline ml-1 text-amber-400"/>}
                    </td>
                    <td className="py-2 text-right">
                      <span className={cumActual > 0 ? 'text-white/70' : 'text-white/20'}>
                        {num(cumActual)}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-white/10">
                <td colSpan={5} className="py-2 text-white/40 font-medium text-xs">DOEL TOTAAL</td>
                <td className="py-2 text-right font-bold text-white">{num(totalTarget)}</td>
                <td className="py-2 text-right font-bold text-white">{num(totalTarget)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Actieve planning items */}
      {(planItems ?? []).length > 0 && (
        <div className="bg-white/[0.04] border border-white/8 rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <Target size={14} className="text-white/50" />
            Actieve taken — Viral Shorts Engine
          </h2>
          <div className="space-y-2">
            {(planItems ?? []).map(item => (
              <div key={item.id} className="flex items-start gap-3 py-2 border-b border-white/[0.04] last:border-0">
                <span className="mt-0.5 shrink-0">{STATUS_ICON[item.status] ?? STATUS_ICON.open}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white/85 font-medium truncate">{item.titel}</p>
                  {item.beschrijving && (
                    <p className="text-xs text-white/40 mt-0.5 line-clamp-1">{item.beschrijving}</p>
                  )}
                </div>
                {item.due_date && (
                  <span className="text-[11px] text-white/35 shrink-0">
                    {new Date(item.due_date).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Daily log update component */}
      <StrategyDailyLog campaigns={cList} currentDag={currentDag} />
    </div>
  )
}
