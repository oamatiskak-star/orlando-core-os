'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Zap, RefreshCw, Play, CheckCircle2, AlertCircle, Clock, Film,
  Scissors, ExternalLink, Activity, Radio, ChevronDown, ChevronUp, Terminal,
} from 'lucide-react'
import clsx from 'clsx'

// ── Types ──────────────────────────────────────────────────────────────────────

type Slot = {
  id: string
  title: string
  status: string
  scheduled_publish_at: string
  channel_name: string
  youtube_video_id: string | null
  youtube_url: string | null
  last_error: string | null
  retry_count: number
  upload_started_at: string | null
  upload_finished_at: string | null
}

type ChannelStat = {
  name: string
  uploaded: number
  planned: number
  failed: number
  uploading: number
}

type RecentUpload = {
  id: string
  title: string
  youtube_video_id: string
  thumbnail_url: string | null
  is_short: boolean
  published_at: string
  channel_name: string
}

type Channel = { id: string; name: string; oauth_status: string; last_upload_at: string | null }

type StatusData = {
  slots: Slot[]
  channelStats: ChannelStat[]
  recentUploads: RecentUpload[]
  daemon: { active: boolean; lastActivity: string | null }
  channels: Channel[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const CHANNEL_COLORS: Record<string, string> = {
  VermogenTv:       '#6366f1',
  SpaarTv:          '#10b981',
  VastgoedTv:       '#0ea5e9',
  CryptoVermogen:   '#f59e0b',
  BeleggingsTv:     '#8b5cf6',
  PropertyInvestorTv: '#ec4899',
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  planned:   { label: 'Gepland',   color: 'text-white/65',  bg: 'bg-white/5',          dot: 'bg-white/30' },
  uploading: { label: 'Bezig',     color: 'text-blue-400',  bg: 'bg-blue-500/10',      dot: 'bg-blue-400 animate-pulse' },
  uploaded:  { label: 'Klaar',     color: 'text-emerald-400', bg: 'bg-emerald-500/10', dot: 'bg-emerald-400' },
  verified_live: { label: 'Live',  color: 'text-emerald-400', bg: 'bg-emerald-500/10', dot: 'bg-emerald-400' },
  failed:    { label: 'Mislukt',   color: 'text-red-400',   bg: 'bg-red-500/10',       dot: 'bg-red-400' },
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })
}

function fmtAgo(iso: string | null) {
  if (!iso) return '—'
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60) return `${Math.round(diff)}s geleden`
  if (diff < 3600) return `${Math.round(diff / 60)}m geleden`
  return `${Math.round(diff / 3600)}u geleden`
}

function isShort(title: string) { return title.startsWith('[Short]') }

// ── Sub-components ────────────────────────────────────────────────────────────

function DaemonStatus({ daemon, channels }: { daemon: StatusData['daemon']; channels: Channel[] }) {
  const allConnected = channels.every(c => c.oauth_status === 'connected')
  return (
    <div className="bg-white/[0.06] border border-white/5 rounded-xl p-5">
      <h2 className="text-xs font-semibold text-white/50 uppercase tracking-wide mb-4">Pipeline Status</h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">

        {/* Daemon */}
        <div className={clsx('rounded-xl border p-4', daemon.active ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-amber-500/20 bg-amber-500/5')}>
          <div className="flex items-center gap-2 mb-2">
            <Activity size={13} className={daemon.active ? 'text-emerald-400' : 'text-amber-400'} />
            <span className="text-xs font-semibold text-white">Queue Processor</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className={clsx('w-2 h-2 rounded-full', daemon.active ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400')} />
            <span className={clsx('text-xs', daemon.active ? 'text-emerald-400' : 'text-amber-400')}>
              {daemon.active ? 'Actief' : 'Idle'}
            </span>
          </div>
          <p className="text-[10px] text-white/50 mt-1.5">Laatste activiteit: {fmtAgo(daemon.lastActivity)}</p>
          <p className="text-[10px] text-white/38 mt-0.5">Check elke 5 minuten</p>
        </div>

        {/* Token status */}
        <div className={clsx('rounded-xl border p-4', allConnected ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-amber-500/20 bg-amber-500/5')}>
          <div className="flex items-center gap-2 mb-2">
            <Radio size={13} className={allConnected ? 'text-emerald-400' : 'text-amber-400'} />
            <span className="text-xs font-semibold text-white">OAuth Tokens</span>
          </div>
          <div className="space-y-1">
            {channels.map(ch => (
              <div key={ch.id} className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: CHANNEL_COLORS[ch.name] ?? '#6366f1' }} />
                <span className="text-[10px] text-white/50 flex-1">{ch.name}</span>
                <span className={clsx('text-[10px]', ch.oauth_status === 'connected' ? 'text-emerald-400' : 'text-amber-400')}>
                  {ch.oauth_status === 'connected' ? '✓' : '!'}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* PM2 info */}
        <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4">
          <div className="flex items-center gap-2 mb-2">
            <Terminal size={13} className="text-white/65" />
            <span className="text-xs font-semibold text-white">PM2 Daemon</span>
          </div>
          <p className="text-[10px] text-white/50 leading-relaxed">
            yt-queue-processor draait lokaal via PM2. Tokens worden elke cycle automatisch vernieuwd.
          </p>
          <p className="text-[10px] text-white/38 mt-2 font-mono">pm2 logs yt-queue-processor</p>
        </div>
      </div>
    </div>
  )
}

function TodayTimeline({ slots }: { slots: Slot[] }) {
  const channels = [...new Set(slots.map(s => s.channel_name))].sort()
  const hours = Array.from({ length: 18 }, (_, i) => i + 6) // 06:00–23:00

  const slotsByChannelHour: Record<string, Slot[]> = {}
  for (const slot of slots) {
    const hour = new Date(slot.scheduled_publish_at).getHours()
    const key = `${slot.channel_name}__${hour}`
    if (!slotsByChannelHour[key]) slotsByChannelHour[key] = []
    slotsByChannelHour[key].push(slot)
  }

  const uploaded = slots.filter(s => s.status === 'uploaded' || s.status === 'verified_live').length
  const failed = slots.filter(s => s.status === 'failed').length
  const pending = slots.filter(s => s.status === 'planned').length
  const busy = slots.filter(s => s.status === 'uploading').length

  return (
    <div className="bg-white/[0.06] border border-white/5 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xs font-semibold text-white/50 uppercase tracking-wide">Planning Vandaag</h2>
        <div className="flex items-center gap-3 text-[10px]">
          <span className="flex items-center gap-1 text-emerald-400"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />{uploaded} klaar</span>
          {busy > 0 && <span className="flex items-center gap-1 text-blue-400"><span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />{busy} bezig</span>}
          {failed > 0 && <span className="flex items-center gap-1 text-red-400"><span className="w-1.5 h-1.5 rounded-full bg-red-400" />{failed} mislukt</span>}
          <span className="text-white/50">{pending} gepland</span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div style={{ minWidth: `${18 * 44 + 140}px` }}>
          {/* Hour header */}
          <div className="flex mb-2 pl-36">
            {hours.map(h => (
              <div key={h} className="w-11 text-center text-[9px] text-white/38 font-mono flex-shrink-0">{h}:00</div>
            ))}
          </div>

          {/* Channel rows */}
          {channels.map(ch => (
            <div key={ch} className="flex items-center mb-2">
              <div className="w-36 flex-shrink-0 flex items-center gap-2 pr-3">
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: CHANNEL_COLORS[ch] ?? '#6366f1' }} />
                <span className="text-[10px] text-white/50 truncate">{ch}</span>
              </div>
              {hours.map(h => {
                const key = `${ch}__${h}`
                const cellSlots = slotsByChannelHour[key] ?? []
                return (
                  <div key={h} className="w-11 h-7 flex items-center justify-center gap-0.5 flex-shrink-0">
                    {cellSlots.length === 0 ? (
                      <div className="w-1.5 h-1.5 rounded-full bg-white/5" />
                    ) : (
                      cellSlots.map(slot => {
                        const cfg = STATUS_CONFIG[slot.status] ?? STATUS_CONFIG.planned
                        const short = isShort(slot.title)
                        return (
                          <div
                            key={slot.id}
                            title={`${slot.title}\n${cfg.label}${slot.youtube_url ? '\n' + slot.youtube_url : ''}${slot.last_error ? '\nFout: ' + slot.last_error : ''}`}
                            className="group relative cursor-default"
                          >
                            {short
                              ? <div className={clsx('w-3 h-3 rounded-sm flex items-center justify-center', cfg.dot === 'bg-white/30' ? 'bg-white/10' : cfg.dot.replace('animate-pulse',''))}
                                  style={{ backgroundColor: slot.status === 'planned' ? undefined : undefined }}>
                                  <Scissors size={7} className={cfg.color} />
                                </div>
                              : <div className={clsx('w-3.5 h-3.5 rounded', cfg.dot === 'bg-white/30' ? 'bg-white/10 border border-white/15' : '')}
                                  style={{
                                    backgroundColor: slot.status !== 'planned'
                                      ? (CHANNEL_COLORS[ch] ?? '#6366f1') + (slot.status === 'uploaded' ? 'ff' : '99')
                                      : undefined
                                  }}
                                />
                            }
                          </div>
                        )
                      })
                    )}
                  </div>
                )
              })}
            </div>
          ))}

          {/* Legend */}
          <div className="flex items-center gap-4 mt-3 pl-36 text-[9px] text-white/45">
            <span className="flex items-center gap-1"><div className="w-3.5 h-3.5 rounded bg-white/10 border border-white/15" />Gepland</span>
            <span className="flex items-center gap-1"><div className="w-3.5 h-3.5 rounded" style={{ backgroundColor: '#6366f199' }} />Uploaden</span>
            <span className="flex items-center gap-1"><div className="w-3.5 h-3.5 rounded" style={{ backgroundColor: '#6366f1ff' }} />Klaar</span>
            <span className="flex items-center gap-1"><div className="w-3 h-3 rounded-sm bg-white/10" /><Scissors size={8} className="text-white/45" />Short</span>
            <span className="flex items-center gap-1"><div className="w-3.5 h-3.5 rounded bg-red-500/40" />Mislukt</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function ChannelStats({ stats }: { stats: ChannelStat[] }) {
  return (
    <div className="bg-white/[0.06] border border-white/5 rounded-xl p-5">
      <h2 className="text-xs font-semibold text-white/50 uppercase tracking-wide mb-4">Kanalen vandaag</h2>
      <div className="space-y-2">
        {stats.sort((a, b) => (b.uploaded + b.uploading) - (a.uploaded + a.uploading)).map(ch => {
          const total = ch.uploaded + ch.planned + ch.failed + ch.uploading
          const pct = total > 0 ? Math.round((ch.uploaded / total) * 100) : 0
          const color = CHANNEL_COLORS[ch.name] ?? '#6366f1'
          return (
            <div key={ch.name}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                  <span className="text-xs text-white/60">{ch.name}</span>
                </div>
                <div className="flex items-center gap-3 text-[10px]">
                  {ch.uploading > 0 && <span className="text-blue-400">{ch.uploading} bezig</span>}
                  <span className="text-emerald-400">{ch.uploaded}/{total} klaar</span>
                  {ch.failed > 0 && <span className="text-red-400">{ch.failed} fout</span>}
                </div>
              </div>
              <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${pct}%`, backgroundColor: color }} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function RecentUploads({ uploads }: { uploads: RecentUpload[] }) {
  if (uploads.length === 0) return null
  return (
    <div className="bg-white/[0.06] border border-white/5 rounded-xl p-5">
      <h2 className="text-xs font-semibold text-white/50 uppercase tracking-wide mb-4">Recente uploads</h2>
      <div className="space-y-2">
        {uploads.map(v => (
          <div key={v.id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-white/[0.06] transition-colors group">
            <div className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: CHANNEL_COLORS[v.channel_name] ?? '#6366f1' }} />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-white/70 truncate">{v.title}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[10px] text-white/50">{v.channel_name}</span>
                {v.is_short && (
                  <span className="flex items-center gap-0.5 text-[10px] text-white/45">
                    <Scissors size={8} /> Short
                  </span>
                )}
                <span className="text-[10px] text-white/38">{fmtAgo(v.published_at)}</span>
              </div>
            </div>
            {v.youtube_video_id && (
              <a
                href={`https://youtube.com/watch?v=${v.youtube_video_id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="opacity-0 group-hover:opacity-100 w-6 h-6 rounded-lg border border-white/10 flex items-center justify-center text-white/50 hover:text-white transition-all flex-shrink-0"
              >
                <ExternalLink size={10} />
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function FailedSlots({ slots }: { slots: Slot[] }) {
  const failed = slots.filter(s => s.status === 'failed')
  if (failed.length === 0) return null
  return (
    <div className="bg-red-500/[0.03] border border-red-500/15 rounded-xl p-5">
      <h2 className="text-xs font-semibold text-red-400 flex items-center gap-2 mb-3">
        <AlertCircle size={13} /> {failed.length} mislukte slot{failed.length > 1 ? 's' : ''}
      </h2>
      <div className="space-y-2">
        {failed.map(slot => (
          <div key={slot.id} className="bg-white/[0.02] rounded-lg p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-white/60">{slot.channel_name} · {fmtTime(slot.scheduled_publish_at)}</span>
              <span className="text-[10px] text-white/45">{slot.retry_count}/3 pogingen</span>
            </div>
            <p className="text-[10px] text-white/65 mt-1 truncate">{slot.title}</p>
            {slot.last_error && (
              <p className="text-[10px] text-red-400/70 mt-1 font-mono truncate">{slot.last_error.slice(0, 120)}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function SlotList({ slots }: { slots: Slot[] }) {
  const [expanded, setExpanded] = useState(false)
  const visible = expanded ? slots : slots.slice(0, 8)

  return (
    <div className="bg-white/[0.06] border border-white/5 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xs font-semibold text-white/50 uppercase tracking-wide">Alle slots vandaag</h2>
        <span className="text-[10px] text-white/45">{slots.length} totaal</span>
      </div>
      <div className="space-y-1">
        {visible.map(slot => {
          const cfg = STATUS_CONFIG[slot.status] ?? STATUS_CONFIG.planned
          const short = isShort(slot.title)
          return (
            <div key={slot.id}
              className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/[0.02] transition-colors">
              <span className={clsx('w-1.5 h-1.5 rounded-full flex-shrink-0', cfg.dot)} />
              <span className="text-[10px] text-white/50 font-mono w-10 flex-shrink-0">
                {fmtTime(slot.scheduled_publish_at)}
              </span>
              <span className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: CHANNEL_COLORS[slot.channel_name] ?? '#6366f1' }} />
              <span className="text-[10px] text-white/65 w-32 flex-shrink-0">{slot.channel_name}</span>
              {short
                ? <Scissors size={9} className="text-white/45 flex-shrink-0" />
                : <Film size={9} className="text-white/45 flex-shrink-0" />
              }
              <span className={clsx('text-[10px] flex-1 truncate', cfg.color)}>{cfg.label}</span>
              {slot.youtube_url && (
                <a href={slot.youtube_url} target="_blank" rel="noopener noreferrer"
                  className="text-white/38 hover:text-emerald-400 flex-shrink-0">
                  <ExternalLink size={9} />
                </a>
              )}
            </div>
          )
        })}
      </div>
      {slots.length > 8 && (
        <button onClick={() => setExpanded(e => !e)}
          className="w-full mt-3 py-2 text-[11px] text-white/50 hover:text-white/60 flex items-center justify-center gap-1 border-t border-white/5 transition-colors">
          {expanded ? <><ChevronUp size={11} /> Minder</>: <><ChevronDown size={11} /> Alle {slots.length} slots zien</>}
        </button>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AutomationPage() {
  const [data, setData] = useState<StatusData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [triggering, setTriggering] = useState(false)

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true)
    else setRefreshing(true)
    try {
      const res = await fetch('/api/youtube/automation/status')
      if (res.ok) setData(await res.json())
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    load()
    const iv = setInterval(() => load(true), 30_000)
    return () => clearInterval(iv)
  }, [load])

  async function triggerNow() {
    setTriggering(true)
    // Refresh tokens + let the processor know to run immediately
    // by hitting the token refresh for all channels
    await fetch('/api/youtube/cron/refresh-tokens', { method: 'POST' }).catch(() => {})
    setTimeout(() => { load(true); setTriggering(false) }, 2000)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 gap-2 text-white/50">
        <RefreshCw size={14} className="animate-spin" />
        <span className="text-sm">Pipeline laden...</span>
      </div>
    )
  }

  if (!data) return <p className="text-sm text-white/50 text-center py-20">Geen data beschikbaar</p>

  const { slots, channelStats, recentUploads, daemon, channels } = data
  const uploadedToday = slots.filter(s => s.status === 'uploaded' || s.status === 'verified_live').length
  const totalToday = slots.length

  return (
    <div className="space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-sm font-semibold text-white">Productie Pipeline</h1>
          <p className="text-[11px] text-white/50 mt-0.5">
            {uploadedToday}/{totalToday} slots geüpload vandaag · Auto-refresh elke 30s
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={triggerNow}
            disabled={triggering}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 rounded-lg text-xs font-semibold hover:bg-indigo-500/25 transition-all disabled:opacity-50"
          >
            <Play size={10} className={triggering ? 'animate-pulse' : ''} />
            {triggering ? 'Gestart...' : 'Tokens vernieuwen'}
          </button>
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            className="p-1.5 rounded-lg border border-white/10 text-white/50 hover:text-white/60 transition-all"
          >
            <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Daemon status */}
      <DaemonStatus daemon={daemon} channels={channels} />

      {/* Timeline */}
      <TodayTimeline slots={slots} />

      {/* Channel stats + recent uploads */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChannelStats stats={channelStats} />
        <RecentUploads uploads={recentUploads} />
      </div>

      {/* Failed slots */}
      <FailedSlots slots={slots} />

      {/* All slots list */}
      <SlotList slots={slots} />
    </div>
  )
}
