'use client'

import { useState, useEffect } from 'react'
import {
  GripVertical, RotateCcw, Tv2, TrendingUp, Upload, ShieldCheck,
  Play, AlertCircle, Gauge, CalendarClock,
} from 'lucide-react'
import clsx from 'clsx'
import ChannelHealth     from './ChannelHealth'
import ChannelStatsTable from './ChannelStatsTable'
import UploadQueue       from './UploadQueue'
import VerificationStatus from './VerificationStatus'
import LiveVideos        from './LiveVideos'
import RetryMonitor      from './RetryMonitor'
import AnalyticsInsights from './AnalyticsInsights'
import QuotaBoard        from './QuotaBoard'
import TodaySchedule     from './TodaySchedule'

type Board = {
  id:        string
  title:     string
  sub?:      string
  Icon:      React.ElementType
  iconColor: string
  Component: React.ComponentType
}

const BOARDS: Board[] = [
  { id: 'channel-health', title: 'Channel Health',       Icon: Tv2,          iconColor: 'text-white/65',    Component: ChannelHealth },
  { id: 'quota',          title: 'Quota Vandaag',         sub: 'per kanaal',  Icon: Gauge,        iconColor: 'text-emerald-400',  Component: QuotaBoard },
  { id: 'schedule',       title: 'Upload Schema',         sub: '48u',         Icon: CalendarClock,iconColor: 'text-sky-400',      Component: TodaySchedule },
  { id: 'channel-stats',  title: 'Kanaal Overzicht',      sub: 'stats',       Icon: TrendingUp,   iconColor: 'text-white/65',    Component: ChannelStatsTable },
  { id: 'upload-queue',   title: 'Upload Queue',          Icon: Upload,       iconColor: 'text-white/65',    Component: UploadQueue },
  { id: 'verification',   title: 'Verificatie Status',    Icon: ShieldCheck,  iconColor: 'text-white/65',    Component: VerificationStatus },
  { id: 'live-videos',    title: 'Live Videos',           Icon: Play,         iconColor: 'text-green-400',   Component: LiveVideos },
  { id: 'retry',          title: 'Retry Monitor',         Icon: AlertCircle,  iconColor: 'text-red-400/70',  Component: RetryMonitor },
  { id: 'analytics',      title: 'Analytics Insights',    sub: 'CTR · retentie · viral', Icon: TrendingUp, iconColor: 'text-violet-400', Component: AnalyticsInsights },
]

const DEFAULT_ORDER = BOARDS.map(b => b.id)
const STORAGE_KEY   = 'yt-dash-order-v2'

export default function DashboardGrid() {
  const [order,  setOrder]  = useState<string[]>(DEFAULT_ORDER)
  const [dragId, setDragId] = useState<string | null>(null)
  const [overId, setOverId] = useState<string | null>(null)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return
      const saved = JSON.parse(raw) as string[]
      const valid   = saved.filter(id => DEFAULT_ORDER.includes(id))
      const missing = DEFAULT_ORDER.filter(id => !valid.includes(id))
      setOrder([...valid, ...missing])
    } catch {}
  }, [])

  function save(next: string[]) {
    setOrder(next)
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch {}
  }

  function onDragStart(id: string) { setDragId(id) }

  function onDragOver(e: React.DragEvent, id: string) {
    e.preventDefault()
    if (id !== dragId) setOverId(id)
  }

  function onDrop(e: React.DragEvent, targetId: string) {
    e.preventDefault()
    if (!dragId || dragId === targetId) { setDragId(null); setOverId(null); return }
    const next = [...order]
    const from = next.indexOf(dragId)
    const to   = next.indexOf(targetId)
    next.splice(from, 1)
    next.splice(to, 0, dragId)
    save(next)
    setDragId(null)
    setOverId(null)
  }

  function onDragEnd() { setDragId(null); setOverId(null) }

  const map = Object.fromEntries(BOARDS.map(b => [b.id, b]))

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={() => save(DEFAULT_ORDER)}
          className="flex items-center gap-1.5 text-[11px] text-white/35 hover:text-white/60 transition-colors"
        >
          <RotateCcw size={11} />
          Volgorde resetten
        </button>
      </div>

      {order.map(id => {
        const board = map[id]
        if (!board) return null
        const { Icon, Component } = board
        const dragging = dragId === id
        const over     = overId  === id

        return (
          <div
            key={id}
            className={clsx(
              'rounded-xl border transition-all duration-150',
              dragging ? 'opacity-40 scale-[0.99]' : 'opacity-100 scale-100',
              over     ? 'border-sky-500/50 bg-sky-500/[0.04]' : 'border-white/5 bg-white/[0.06]'
            )}
            onDragOver={e => onDragOver(e, id)}
            onDrop={e => onDrop(e, id)}
            onDragEnd={onDragEnd}
          >
            {/* Header — draggable */}
            <div
              draggable
              onDragStart={() => onDragStart(id)}
              className="flex items-center justify-between px-5 pt-4 pb-3 cursor-grab active:cursor-grabbing select-none"
            >
              <div className="flex items-center gap-2">
                <Icon size={14} className={board.iconColor} />
                <h2 className="text-sm font-semibold text-white">{board.title}</h2>
                {board.sub && (
                  <span className="text-[11px] text-white/35">{board.sub}</span>
                )}
              </div>
              <GripVertical size={14} className="text-white/20 hover:text-white/50 transition-colors" />
            </div>

            {/* Content */}
            <div className="px-5 pb-5">
              <Component />
            </div>
          </div>
        )
      })}
    </div>
  )
}
