'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Video, Upload, Zap, CheckCircle, AlertCircle, Clock,
  RefreshCw, ChevronRight, ShieldCheck, ShieldAlert,
  Play, FileVideo, Layers, Activity,
} from 'lucide-react'
import Link from 'next/link'

type ChannelData = {
  id: string
  naam: string
  oauthStatus: string
  tokenOk: boolean
  tokenExpires: string | null
  quotaUsed: number
  hasRefreshToken: boolean
  queue: { planned: number; queued: number; uploading: number; live: number; failed: number }
  videos: { productie: number; scheduled: number; published: number; failed: number }
}

type Pipeline = {
  productie: number; planned: number; queued: number
  uploading: number; live: number; failed: number; published: number
}

type Props = {
  channelData: ChannelData[]
  pipeline: Pipeline
  recentQueue: any[]
}

const STEP_STATUS_COLOR: Record<string, string> = {
  uploading:                    'text-indigo-400',
  uploaded_pending_processing:  'text-violet-400',
  processing:                   'text-violet-400',
  verifying:                    'text-amber-400',
  verified_live:                'text-green-400',
  queued:                       'text-sky-400',
  retrying:                     'text-amber-400',
  preparing:                    'text-sky-400',
  normalizing:                  'text-sky-400',
  failed:                       'text-red-400',
  manual_review_required:       'text-red-400',
}

const STEP_LABEL: Record<string, string> = {
  queued: 'Wachtrij', retrying: 'Opnieuw', preparing: 'Voorbereiden',
  normalizing: 'ffmpeg', uploading: 'Uploaden',
  uploaded_pending_processing: 'YT verwerking', processing: 'Processing',
  verifying: 'Verificatie', verified_live: 'Live ✓',
  failed: 'Mislukt', manual_review_required: 'Handmatig',
}

const CH_COLOR: Record<string, string> = {
  VermogenTv: '#6366f1', VastgoedTv: '#0ea5e9', SpaarTv: '#10b981',
  CryptoVermogen: '#f59e0b', BeleggingsTv: '#8b5cf6', PropertyInvestorTv: '#ec4899',
}

function PipelineStep({ label, value, icon: Icon, color, active, blocked, arrow = true }:
  { label: string; value: number; icon: React.ElementType; color: string; active?: boolean; blocked?: boolean; arrow?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <div className={`flex flex-col items-center gap-1.5 px-4 py-3 rounded-xl border transition-all min-w-[90px]
        ${blocked  ? 'border-red-500/30 bg-red-500/5' :
          active   ? 'border-white/15 bg-white/[0.07]' :
                     'border-white/5 bg-white/[0.04]'}`}>
        <Icon size={14} className={blocked ? 'text-red-400' : color} />
        <span className={`text-lg font-bold leading-none ${blocked ? 'text-red-400' : color}`}>{value}</span>
        <span className="text-[9px] text-white/40 text-center leading-tight">{label}</span>
        {blocked && <span className="text-[8px] text-red-400/70 font-medium">GEBLOKKEERD</span>}
        {active && value > 0 && <span className="text-[8px] text-emerald-400/70 font-medium animate-pulse">ACTIEF</span>}
      </div>
      {arrow && <ChevronRight size={12} className="text-white/15 shrink-0" />}
    </div>
  )
}

export default function WorkflowClient({ channelData, pipeline, recentQueue }: Props) {
  const [liveQueue, setLiveQueue] = useState(recentQueue)
  const [lastUpdate, setLastUpdate] = useState(new Date())

  useEffect(() => {
    const supabase = createClient()
    const ch = supabase.channel('pipeline_live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'youtube_upload_queue' }, async () => {
        const { data } = await supabase
          .from('youtube_upload_queue')
          .select('id, status, title, updated_at, youtube_video_id, last_error, channel_id, youtube_channels(naam)')
          .not('status', 'eq', 'planned')
          .order('updated_at', { ascending: false })
          .limit(30)
        if (data) {
          setLiveQueue(data)
          setLastUpdate(new Date())
        }
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [])

  const allConnected   = channelData.every(c => c.oauthStatus === 'connected' && c.tokenOk)
  const anyFailed      = pipeline.failed > 0
  const engineActive   = pipeline.uploading > 0 || pipeline.queued > 0

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold text-white">Upload Pipeline</h1>
          <p className="text-xs text-white/40 mt-0.5">
            Realtime — bijgewerkt {lastUpdate.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-medium border ${
            engineActive ? 'bg-green-500/10 border-green-500/20 text-green-400' :
                           'bg-white/5 border-white/10 text-white/40'}`}>
            <Activity size={10} className={engineActive ? 'animate-pulse' : ''} />
            Engine {engineActive ? 'actief' : 'wacht'}
          </div>
          {!allConnected && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-medium border bg-red-500/10 border-red-500/20 text-red-400">
              <ShieldAlert size={10} /> OAuth problemen
            </div>
          )}
        </div>
      </div>

      {/* Pipeline visualization */}
      <div className="bg-white/[0.04] border border-white/5 rounded-2xl p-5">
        <h2 className="text-[11px] font-semibold text-white/40 uppercase tracking-wide mb-4">Upload Pipeline — volledig overzicht</h2>
        <div className="flex items-center gap-1 flex-wrap">
          <PipelineStep
            label="In Productie"     value={pipeline.productie}  icon={FileVideo}  color="text-violet-400"
            blocked={pipeline.productie === 0} />
          <PipelineStep
            label="Slots Gepland"    value={pipeline.planned}    icon={Clock}      color="text-white/50" />
          <PipelineStep
            label="Slot Gevuld"      value={pipeline.queued}     icon={Layers}     color="text-sky-400"
            active={pipeline.queued > 0} />
          <PipelineStep
            label="Uploaden"         value={pipeline.uploading}  icon={Upload}     color="text-indigo-400"
            active={pipeline.uploading > 0} />
          <PipelineStep
            label="Live ✓"           value={pipeline.live}       icon={Play}       color="text-green-400" />
          <PipelineStep
            label="Gepubliceerd"     value={pipeline.published}  icon={CheckCircle} color="text-emerald-400" arrow={false} />
        </div>

        {anyFailed && (
          <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/8 border border-red-500/15">
            <AlertCircle size={12} className="text-red-400 shrink-0" />
            <span className="text-xs text-red-400">
              {pipeline.failed} upload{pipeline.failed > 1 ? 's' : ''} mislukt —{' '}
              <Link href="/dashboard/youtube/queue" className="underline hover:text-red-300">bekijk Queue pagina</Link>
            </span>
          </div>
        )}

        {pipeline.productie === 0 && (
          <div className="mt-3 flex items-start gap-2 px-3 py-2.5 rounded-lg bg-amber-500/8 border border-amber-500/15">
            <AlertCircle size={12} className="text-amber-400 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-400/80 leading-relaxed">
              <strong className="text-amber-400">Geen video's in productie.</strong>{' '}
              Voeg video bestanden toe via "Upload toevoegen" met een geldig bestandspad op de Render server.
              De slot-filler koppelt ze automatisch aan het eerstvolgende vrije tijdslot.
            </div>
          </div>
        )}
      </div>

      {/* Workflow uitleg */}
      <div className="bg-white/[0.04] border border-white/5 rounded-2xl p-5">
        <h2 className="text-[11px] font-semibold text-white/40 uppercase tracking-wide mb-4">Hoe de pipeline werkt</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-7 gap-3">
          {[
            { step: '1', title: 'Productie',      desc: 'Video bestand aangemaakt en geregistreerd in youtube_videos (status=queued)', icon: FileVideo,   color: 'text-violet-400', bg: 'bg-violet-500/10' },
            { step: '2', title: 'Slot-Filler',    desc: 'Engine koppelt video elke 2 min aan eerstvolgende lege planned slot', icon: Zap,         color: 'text-sky-400',    bg: 'bg-sky-500/10' },
            { step: '3', title: 'Orchestrator',   desc: 'Orchestrator polt elke 30s voor status=queued items → dispatcht naar BullMQ', icon: RefreshCw,  color: 'text-indigo-400', bg: 'bg-indigo-500/10' },
            { step: '4', title: 'ffmpeg',         desc: 'Normalizer optimaliseert video voor YouTube (optioneel)', icon: Layers,      color: 'text-cyan-400',   bg: 'bg-cyan-500/10' },
            { step: '5', title: 'YouTube Upload', desc: 'Upload worker stuurt video naar YouTube Data API v3 met OAuth token', icon: Upload,      color: 'text-blue-400',   bg: 'bg-blue-500/10' },
            { step: '6', title: 'Verificatie',    desc: 'Verification worker checkt processing status elke 30s totdat video live is', icon: ShieldCheck, color: 'text-amber-400',  bg: 'bg-amber-500/10' },
            { step: '7', title: 'Live',           desc: 'Status=verified_live, youtube_videos.status=published, analytics gestart', icon: CheckCircle, color: 'text-green-400',  bg: 'bg-green-500/10' },
          ].map(s => {
            const Icon = s.icon
            return (
              <div key={s.step} className="flex flex-col gap-2">
                <div className={`w-7 h-7 rounded-lg ${s.bg} flex items-center justify-center`}>
                  <Icon size={13} className={s.color} />
                </div>
                <p className="text-[11px] font-semibold text-white/70">{s.step}. {s.title}</p>
                <p className="text-[10px] text-white/35 leading-relaxed">{s.desc}</p>
              </div>
            )
          })}
        </div>
      </div>

      {/* Per-channel status */}
      <div className="bg-white/[0.04] border border-white/5 rounded-2xl p-5">
        <h2 className="text-[11px] font-semibold text-white/40 uppercase tracking-wide mb-4">Kanaal Status</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-white/5">
                {['Kanaal', 'OAuth', 'Token', 'Productie', 'Planned', 'Queue', 'Uploaden', 'Live', 'Gepubliceerd', 'Fouten', 'Quota'].map(h => (
                  <th key={h} className="text-left py-2 pr-4 text-white/35 font-medium text-[10px] whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {channelData.map(ch => {
                const color = CH_COLOR[ch.naam] ?? '#6366f1'
                const tokenMin = ch.tokenExpires
                  ? Math.floor((new Date(ch.tokenExpires).getTime() - Date.now()) / 60_000)
                  : null
                return (
                  <tr key={ch.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                    <td className="py-2.5 pr-4">
                      <Link href={`/dashboard/youtube/channel/${ch.id}`}
                        className="flex items-center gap-2 hover:text-white transition-colors text-white/70">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                        {ch.naam}
                      </Link>
                    </td>
                    <td className="py-2.5 pr-4">
                      {ch.oauthStatus === 'connected' ? (
                        <span className="flex items-center gap-1 text-green-400"><ShieldCheck size={10} /> OK</span>
                      ) : (
                        <Link href={`/api/youtube/oauth/connect?channel_uuid=${ch.id}`}
                          className="flex items-center gap-1 text-red-400 hover:text-red-300">
                          <ShieldAlert size={10} /> Verbinden
                        </Link>
                      )}
                    </td>
                    <td className="py-2.5 pr-4 font-mono text-[10px]">
                      {tokenMin === null ? <span className="text-white/25">—</span> :
                       tokenMin < 5     ? <span className="text-red-400">{tokenMin}m</span> :
                       tokenMin < 30    ? <span className="text-amber-400">{tokenMin}m</span> :
                                         <span className="text-green-400">{tokenMin}m</span>}
                    </td>
                    <td className="py-2.5 pr-4">
                      <span className={ch.videos.productie > 0 ? 'text-violet-400 font-medium' : 'text-white/25'}>
                        {ch.videos.productie}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4 text-white/40 font-mono">{ch.queue.planned}</td>
                    <td className="py-2.5 pr-4">
                      <span className={ch.queue.queued > 0 ? 'text-sky-400 font-medium' : 'text-white/25'}>
                        {ch.queue.queued}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4">
                      <span className={ch.queue.uploading > 0 ? 'text-indigo-400 font-medium animate-pulse' : 'text-white/25'}>
                        {ch.queue.uploading}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4">
                      <span className={ch.queue.live > 0 ? 'text-green-400 font-medium' : 'text-white/25'}>
                        {ch.queue.live}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4 text-emerald-400/70 font-mono">{ch.videos.published}</td>
                    <td className="py-2.5 pr-4">
                      <span className={ch.queue.failed > 0 ? 'text-red-400 font-medium' : 'text-white/20'}>
                        {ch.queue.failed || '—'}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4 font-mono text-white/40">{ch.quotaUsed}/6</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Live activity log */}
      <div className="bg-white/[0.04] border border-white/5 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[11px] font-semibold text-white/40 uppercase tracking-wide">Live activiteit</h2>
          <span className="text-[10px] text-white/25 font-mono">Realtime via Supabase</span>
        </div>
        {liveQueue.length === 0 ? (
          <div className="text-center py-8">
            <Clock size={20} className="text-white/20 mx-auto mb-2" />
            <p className="text-xs text-white/30">Geen actieve pipeline items</p>
            <p className="text-[11px] text-white/20 mt-1">Voeg een video toe om de pipeline te starten</p>
          </div>
        ) : (
          <div className="space-y-1">
            {liveQueue.map((item: any) => {
              const stColor = STEP_STATUS_COLOR[item.status] ?? 'text-white/40'
              const stLabel = STEP_LABEL[item.status] ?? item.status
              const naam = item.youtube_channels?.naam ?? '—'
              const color = CH_COLOR[naam] ?? '#6366f1'
              return (
                <div key={item.id} className="flex items-center gap-3 py-1.5 px-2 rounded-lg hover:bg-white/[0.03] transition-colors">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                  <span className="text-[10px] text-white/35 w-24 shrink-0 font-mono">{naam}</span>
                  <span className={`text-[10px] font-medium w-24 shrink-0 ${stColor}`}>{stLabel}</span>
                  <span className="text-xs text-white/55 flex-1 truncate">{item.title ?? item.youtube_video_id ?? item.id?.slice(0,8)}</span>
                  {item.last_error && (
                    <span className="text-[9px] text-red-400/70 truncate max-w-[140px]" title={item.last_error}>
                      ✗ {item.last_error.slice(0, 40)}
                    </span>
                  )}
                  {item.youtube_video_id && (
                    <a href={`https://youtube.com/watch?v=${item.youtube_video_id}`}
                      target="_blank" rel="noopener noreferrer"
                      className="text-[9px] text-green-400/60 hover:text-green-400 shrink-0 font-mono">
                      YT↗
                    </a>
                  )}
                  <span className="text-[9px] text-white/20 font-mono shrink-0">
                    {new Date(item.updated_at).toLocaleTimeString('nl-NL', { hour:'2-digit', minute:'2-digit' })}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Upload Queue',  href: '/dashboard/youtube/queue',     desc: 'Realtime queue monitor + retry' },
          { label: 'Logs',          href: '/dashboard/youtube/logs',      desc: 'Engine logs per upload job' },
          { label: 'Analytics',     href: '/dashboard/youtube/analytics', desc: 'Views, RPM, CTR per kanaal' },
          { label: 'Planning',      href: '/dashboard/youtube/scheduled', desc: 'Geplande tijdslots beheren' },
        ].map(l => (
          <Link key={l.href} href={l.href}
            className="bg-white/[0.04] border border-white/5 hover:border-white/10 rounded-xl p-4 transition-colors group">
            <p className="text-xs font-medium text-white/70 group-hover:text-white transition-colors">{l.label}</p>
            <p className="text-[10px] text-white/30 mt-1 leading-tight">{l.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
