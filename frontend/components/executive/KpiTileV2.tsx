'use client'

import { motion } from 'framer-motion'
import clsx from 'clsx'
import { ReactNode } from 'react'
import { Sparkline } from './Sparkline'
import { MetricDelta } from './MetricDelta'

export type KpiTileAccent = 'amplify' | 'breakout' | 'warn' | 'decay' | 'momentum' | 'neutral'

export type KpiTileItem = {
  label: string
  current: number
  display?: string                 // overrides default number formatting
  target?: number | null
  trend?: number[]                 // 5-30 punten
  unit?: string                    // % / € / k
  icon?: ReactNode
  accent?: KpiTileAccent
  invertGood?: boolean             // lager = beter
  hint?: string
  live?: boolean
}

const ACCENT_BORDER: Record<KpiTileAccent, string> = {
  amplify:  'border-violet-400/25',
  breakout: 'border-emerald-400/30',
  warn:     'border-amber-400/30',
  decay:    'border-red-400/30',
  momentum: 'border-indigo-400/25',
  neutral:  'border-white/10',
}
const ACCENT_TEXT: Record<KpiTileAccent, string> = {
  amplify:  'text-violet-300',
  breakout: 'text-emerald-300',
  warn:     'text-amber-300',
  decay:    'text-red-300',
  momentum: 'text-indigo-300',
  neutral:  'text-white/90',
}
const ACCENT_STROKE: Record<KpiTileAccent, string> = {
  amplify:  '#a78bfa',
  breakout: '#34d399',
  warn:     '#fbbf24',
  decay:    '#f87171',
  momentum: '#818cf8',
  neutral:  '#9ca3af',
}

function defaultFormat(n: number, unit?: string): string {
  if (!Number.isFinite(n)) return '—'
  if (unit === '%') return `${n.toFixed(n < 1 ? 0 : 0)}%`
  if (unit === '€') {
    if (Math.abs(n) >= 1_000_000) return `€${(n / 1_000_000).toFixed(1)}M`
    if (Math.abs(n) >= 1_000) return `€${(n / 1_000).toFixed(1)}k`
    return `€${n.toLocaleString('nl-NL')}`
  }
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return n.toLocaleString('nl-NL')
}

export function KpiTileV2({ item, index = 0 }: { item: KpiTileItem; index?: number }) {
  const accent: KpiTileAccent = item.accent ?? 'neutral'
  const display = item.display ?? defaultFormat(item.current, item.unit)
  const targetDisplay = item.target != null ? defaultFormat(item.target, item.unit) : null
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.04, ease: 'easeOut' }}
      className={clsx(
        'relative bg-white/[0.04] rounded-xl border p-3 overflow-hidden',
        ACCENT_BORDER[accent],
      )}
    >
      <div className="flex items-center justify-between mb-1.5">
        <div className="text-[10px] uppercase tracking-wider text-white/40">{item.label}</div>
        <div className="flex items-center gap-1.5 text-white/30">
          {item.live ? <span className="exec-live-dot" /> : null}
          {item.icon ? <span>{item.icon}</span> : null}
        </div>
      </div>
      <div className="flex items-baseline justify-between gap-2">
        <div className={clsx('text-xl font-semibold tabular-nums', ACCENT_TEXT[accent])}>
          {display}
        </div>
        {item.trend && item.trend.length >= 2 ? (
          <div className={ACCENT_TEXT[accent]}>
            <Sparkline values={item.trend} stroke={ACCENT_STROKE[accent]} width={64} height={20} />
          </div>
        ) : null}
      </div>
      <div className="mt-1.5 flex items-center justify-between gap-2">
        <div className="text-[10px] text-white/40 truncate">
          {targetDisplay
            ? <>target <span className="text-white/60 tabular-nums">{targetDisplay}</span></>
            : item.hint ?? ''}
        </div>
        {targetDisplay
          ? <MetricDelta current={item.current} target={item.target ?? null} invertGood={item.invertGood} />
          : null}
      </div>
    </motion.div>
  )
}

export function KpiTileGrid({ items }: { items: KpiTileItem[] }) {
  if (items.length === 0) return null
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {items.map((it, i) => <KpiTileV2 key={it.label} item={it} index={i} />)}
    </div>
  )
}
