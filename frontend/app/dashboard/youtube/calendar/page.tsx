'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Calendar, RefreshCw, Film, Scissors, CheckCircle, XCircle,
  Clock, Zap, ExternalLink, ChevronDown, ChevronUp, Filter, Eye,
} from 'lucide-react'
import clsx from 'clsx'

type CalItem = {
  id: string
  channel_id: string
  week_start: string | null
  publish_date: string | null
  day_index: number | null
  video_type: string | null
  video_type_detail: string | null
  title: string | null
  seo_title: string | null
  hook_script: string | null
  thumbnail_concept: string | null
  cta: string | null
  status: string
  error_message: string | null
  youtube_video_id: string | null
  storage_path: string | null
  created_at: string
  updated_at: string
  youtube_channels: { naam: string } | null
}

const STATUS_STYLE: Record<string, string> = {
  planned:    'bg-white/5 text-white/50 border-white/10',
  scripting:  'bg-sky-500/10 text-sky-400 border-sky-500/20',
  recorded:   'bg-violet-500/10 text-violet-400 border-violet-500/20',
  editing:    'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
  scheduled:  'bg-amber-500/10 text-amber-400 border-amber-500/20',
  published:  'bg-green-500/10 text-green-400 border-green-500/20',
  failed:     'bg-red-500/10 text-red-400 border-red-500/20',
  skipped:    'bg-white/5 text-white/30 border-white/8',
}

const STATUS_LABELS: Record<string, string> = {
  planned: 'Gepland', scripting: 'Script', recorded: 'Opgenomen', editing: 'Editing',
  scheduled: 'Ingepland', published: '✓ Live', failed: '✗ Mislukt', skipped: 'Overgeslagen',
}

const STATUS_ICONS: Record<string, typeof CheckCircle> = {
  published: CheckCircle,
  failed:    XCircle,
  scheduled: Clock,
  planned:   Calendar,
  scripting: Zap,
  recorded:  Film,
  editing:   Film,
  skipped:   Filter,
}

const TYPE_ICON: Record<string, typeof Film> = {
  short: Scissors,
  shorts: Scissors,
}

const CHANNEL_COLORS: Record<string, string> = {
  VermogenTv:          'text-indigo-400',
  VastgoedTv:          'text-sky-400',
  SpaarTv:             'text-green-400',
  CryptoVermogen:      'text-amber-400',
  BeleggingsTv:        'text-violet-400',
  PropertyInvestorTv:  'text-pink-400',
}

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('nl-NL', { weekday: 'short', day: '2-digit', month: 'short' })
}

function groupByWeek(items: CalItem[]) {
  const map = new Map<string, CalItem[]>()
  for (const item of items) {
    const key = item.week_start ?? item.publish_date?.slice(0, 10) ?? 'Onbekend'
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(item)
  }
  return map
}

export default function ContentCalendarPage() {
  const [items, setItems]       = useState<CalItem[]>([])
  const [loading, setLoading]   = useState(true)
  const [channelFilter, setChannelFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter]   = useState<string>('all')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [channels, setChannels] = useState<{ id: string; naam: string }[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const url = channelFilter !== 'all'
        ? `/api/youtube/calendar?channel_id=${channelFilter}&limit=200`
        : `/api/youtube/calendar?limit=200`
      const res = await fetch(url)
      const { items: data } = await res.json()
      setItems(data ?? [])
    } finally {
      setLoading(false)
    }
  }, [channelFilter])

  useEffect(() => {
    const supabase = createClient()
    supabase.from('youtube_channels').select('id, naam').order('naam').then(({ data }) => {
      if (data) setChannels(data)
    })
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = statusFilter === 'all'
    ? items
    : items.filter(i => i.status === statusFilter)

  const grouped = groupByWeek(filtered)
  const weeks   = Array.from(grouped.keys()).sort()

  const counts = {
    total:     items.length,
    published: items.filter(i => i.status === 'published').length,
    scheduled: items.filter(i => i.status === 'scheduled').length,
    planned:   items.filter(i => i.status === 'planned').length,
    failed:    items.filter(i => i.status === 'failed').length,
  }

  function toggleWeek(week: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(week) ? next.delete(week) : next.add(week)
      return next
    })
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
            <Calendar size={16} className="text-violet-400" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-white">Content Calendar</h1>
            <p className="text-[11px] text-white/45">{counts.total} items · {counts.published} live · {counts.scheduled} ingepland · {counts.planned} gepland</p>
          </div>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs text-white/60 hover:text-white hover:bg-white/10 transition-all disabled:opacity-40"
        >
          <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Live',      value: counts.published, color: 'text-green-400  bg-green-500/8   border-green-500/15' },
          { label: 'Ingepland', value: counts.scheduled, color: 'text-amber-400  bg-amber-500/8   border-amber-500/15' },
          { label: 'Gepland',   value: counts.planned,   color: 'text-white/60   bg-white/5        border-white/10'     },
          { label: 'Fouten',    value: counts.failed,    color: counts.failed > 0 ? 'text-red-400 bg-red-500/8 border-red-500/15' : 'text-white/30 bg-white/5 border-white/8' },
        ].map(s => (
          <div key={s.label} className={`rounded-xl border px-4 py-3 ${s.color}`}>
            <p className="text-xl font-bold">{s.value}</p>
            <p className="text-[11px] opacity-70 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <select
          value={channelFilter}
          onChange={e => setChannelFilter(e.target.value)}
          className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white/70 focus:outline-none focus:border-indigo-500/40"
        >
          <option value="all">Alle kanalen</option>
          {channels.map(c => <option key={c.id} value={c.id}>{c.naam}</option>)}
        </select>

        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white/70 focus:outline-none focus:border-indigo-500/40"
        >
          <option value="all">Alle statussen</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>

        {filtered.length !== items.length && (
          <span className="text-[11px] text-white/40">{filtered.length} van {items.length} items</span>
        )}
      </div>

      {/* Calendar grouped by week */}
      {loading && (
        <div className="text-center py-12 text-white/30 text-sm">Laden…</div>
      )}

      {!loading && weeks.length === 0 && (
        <div className="text-center py-12 text-white/30 text-sm">
          Geen content calendar items gevonden. Start de pipeline via het Automation scherm.
        </div>
      )}

      {!loading && weeks.map(week => {
        const weekItems = grouped.get(week) ?? []
        const isOpen    = expanded.has(week)
        const weekLabel = week !== 'Onbekend'
          ? `Week van ${new Date(week).toLocaleDateString('nl-NL', { day: '2-digit', month: 'long' })}`
          : 'Onbekende week'

        const weekStats = {
          published: weekItems.filter(i => i.status === 'published').length,
          scheduled: weekItems.filter(i => i.status === 'scheduled').length,
          planned:   weekItems.filter(i => i.status === 'planned').length,
          failed:    weekItems.filter(i => i.status === 'failed').length,
        }

        return (
          <div key={week} className="bg-white/[0.025] border border-white/8 rounded-2xl overflow-hidden">
            {/* Week header */}
            <button
              onClick={() => toggleWeek(week)}
              className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-white/[0.02] transition-colors"
            >
              <div className="flex items-center gap-3">
                <Calendar size={14} className="text-violet-400 flex-shrink-0" />
                <span className="text-sm font-semibold text-white">{weekLabel}</span>
                <span className="text-[11px] text-white/40">{weekItems.length} items</span>
                <div className="flex items-center gap-1.5 ml-1">
                  {weekStats.published > 0 && <span className="text-[10px] bg-green-500/10 text-green-400 border border-green-500/15 px-1.5 py-0.5 rounded-full">{weekStats.published} live</span>}
                  {weekStats.scheduled > 0 && <span className="text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/15 px-1.5 py-0.5 rounded-full">{weekStats.scheduled} ingepland</span>}
                  {weekStats.failed > 0    && <span className="text-[10px] bg-red-500/10 text-red-400 border border-red-500/15 px-1.5 py-0.5 rounded-full">{weekStats.failed} fouten</span>}
                </div>
              </div>
              {isOpen ? <ChevronUp size={14} className="text-white/40" /> : <ChevronDown size={14} className="text-white/40" />}
            </button>

            {/* Items */}
            {isOpen && (
              <div className="border-t border-white/5 divide-y divide-white/5">
                {weekItems.sort((a, b) => (a.publish_date ?? '').localeCompare(b.publish_date ?? '')).map(item => {
                  const Icon = STATUS_ICONS[item.status] ?? Calendar
                  const TypeIcon = TYPE_ICON[item.video_type?.toLowerCase() ?? ''] ?? Film
                  const channelName = item.youtube_channels?.naam ?? '—'
                  const channelColor = CHANNEL_COLORS[channelName] ?? 'text-white/60'

                  return (
                    <div key={item.id} className="px-5 py-3.5 hover:bg-white/[0.02] transition-colors">
                      <div className="flex items-start gap-3">
                        <TypeIcon size={14} className="text-white/30 flex-shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={clsx('text-xs font-medium truncate', channelColor)}>{channelName}</span>
                            {item.publish_date && (
                              <span className="text-[11px] text-white/35">{fmtDate(item.publish_date)}</span>
                            )}
                            <span className={clsx('inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full border font-medium', STATUS_STYLE[item.status] ?? STATUS_STYLE.planned)}>
                              <Icon size={9} />
                              {STATUS_LABELS[item.status] ?? item.status}
                            </span>
                            {item.video_type && (
                              <span className={clsx('text-[10px] px-1.5 py-0.5 rounded-full border',
                                item.video_type.toLowerCase().includes('short')
                                  ? 'bg-pink-500/10 text-pink-400 border-pink-500/20'
                                  : 'bg-white/5 text-white/40 border-white/10'
                              )}>
                                {item.video_type_detail ?? item.video_type}
                              </span>
                            )}
                          </div>

                          <p className="text-xs font-semibold text-white mt-1 truncate">
                            {item.seo_title ?? item.title ?? '—'}
                          </p>

                          {item.hook_script && (
                            <p className="text-[11px] text-white/45 mt-0.5 line-clamp-2 leading-relaxed">
                              {item.hook_script}
                            </p>
                          )}

                          {item.thumbnail_concept && (
                            <p className="text-[10px] text-white/30 mt-1 truncate">
                              <span className="text-white/20">Thumbnail: </span>{item.thumbnail_concept}
                            </p>
                          )}

                          {item.error_message && (
                            <p className="text-[10px] text-red-400/70 mt-1 truncate">
                              {item.error_message}
                            </p>
                          )}
                        </div>

                        {item.youtube_video_id && (
                          <a
                            href={`https://studio.youtube.com/video/${item.youtube_video_id}/edit`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-shrink-0 text-white/25 hover:text-white/60 transition-colors"
                            title="Open in YouTube Studio"
                          >
                            <ExternalLink size={12} />
                          </a>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
