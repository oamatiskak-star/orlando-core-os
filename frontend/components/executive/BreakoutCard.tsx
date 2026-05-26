'use client'

import { motion } from 'framer-motion'
import clsx from 'clsx'
import { Flame, Repeat, Zap, TrendingDown, TrendingUp, Sparkles } from 'lucide-react'
import { ActionCTA } from './ActionCTA'

export type GravityEventType =
  | 'breakout' | 'momentum' | 'replay_spike'
  | 'session_extension' | 'algo_boost' | 'decay'

export type BreakoutItem = {
  id: string
  event_type: GravityEventType
  magnitude: number
  detected_at: string
  notes: string | null
  content_item_id: string | null
  upload_id: string | null
  // verrijking als beschikbaar via /api/algorithm/signals:
  content_title?: string | null
  channel_name?: string | null
  niche?: string | null
}

const EVENT_META: Record<GravityEventType, { label: string; icon: React.ComponentType<{ size?: number }>; tone: string; glow: string }> = {
  breakout:          { label: 'BREAKOUT',          icon: Flame,        tone: 'text-emerald-300 border-emerald-400/40 bg-emerald-500/[0.08]', glow: 'exec-glow-breakout' },
  momentum:          { label: 'MOMENTUM',          icon: TrendingUp,   tone: 'text-indigo-300 border-indigo-400/30 bg-indigo-500/[0.06]',    glow: '' },
  replay_spike:      { label: 'REPLAY SPIKE',      icon: Repeat,       tone: 'text-violet-300 border-violet-400/30 bg-violet-500/[0.06]',    glow: '' },
  session_extension: { label: 'SESSION EXTENSION', icon: Sparkles,     tone: 'text-cyan-300 border-cyan-400/30 bg-cyan-500/[0.06]',          glow: '' },
  algo_boost:        { label: 'ALGO BOOST',        icon: Zap,          tone: 'text-amber-300 border-amber-400/30 bg-amber-500/[0.06]',       glow: 'exec-glow-warn' },
  decay:             { label: 'DECAY',             icon: TrendingDown, tone: 'text-red-300 border-red-400/30 bg-red-500/[0.06]',             glow: '' },
}

export function BreakoutCard({
  item, onAction, index = 0,
}: {
  item: BreakoutItem
  onAction: (kind: 'swarm' | 'clone' | 'push' | 'expand') => Promise<unknown> | void
  index?: number
}) {
  const meta = EVENT_META[item.event_type] ?? EVENT_META.momentum
  const Icon = meta.icon
  const isBreakout = item.event_type === 'breakout'
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, delay: index * 0.03, ease: 'easeOut' }}
      className={clsx('relative border rounded-xl p-3 overflow-hidden', meta.tone, meta.glow)}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <Icon size={14} />
          <div className="text-[10px] uppercase tracking-wider font-semibold">{meta.label}</div>
          <div className="text-[10px] text-white/40 tabular-nums">·  +{item.magnitude.toFixed(0)}%</div>
        </div>
        <div className="text-[10px] text-white/30 shrink-0">{new Date(item.detected_at).toLocaleString('nl-NL')}</div>
      </div>
      <div className="text-xs text-white/85 truncate" title={item.content_title ?? undefined}>
        {item.content_title ?? item.notes ?? '—'}
      </div>
      <div className="text-[10px] text-white/40 mt-0.5">
        {item.channel_name ?? '—'}{item.niche ? ` · ${item.niche}` : ''}
      </div>
      {item.event_type !== 'decay' ? (
        <div className="flex flex-wrap gap-1.5 mt-3">
          <ActionCTA
            label="Swarm"
            intent="swarm"
            size="xs"
            icon={<Sparkles size={10} />}
            onClick={() => onAction('swarm')}
            confirm={isBreakout ? undefined : 'Swarm activeren ondanks dat dit geen breakout is?'}
          />
          <ActionCTA label="Clone hook" intent="clone" size="xs" icon={<Repeat size={10} />} onClick={() => onAction('clone')} />
          <ActionCTA label="Push variants" intent="push" size="xs" icon={<TrendingUp size={10} />} onClick={() => onAction('push')} />
          <ActionCTA label="Expand niche" intent="expand" size="xs" icon={<Flame size={10} />} onClick={() => onAction('expand')} />
        </div>
      ) : (
        <div className="mt-3 text-[10px] text-white/40">Decay — overweeg productie voor deze niche terug te schroeven.</div>
      )}
    </motion.div>
  )
}
