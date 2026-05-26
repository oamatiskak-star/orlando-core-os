'use client'

import clsx from 'clsx'

export type TrendCell = {
  keyword: string
  momentum: number // 0-100+ (normalized server-side)
  region?: string | null
  source: string
}

/**
 * Trend Heatmap — keywords sorted by aggregated momentum.
 * Color intensity scales with momentum; tooltip exposes source + region.
 */
export function TrendHeatmap({ cells, max = 36 }: { cells: TrendCell[]; max?: number }) {
  const sorted = [...cells].sort((a, b) => b.momentum - a.momentum).slice(0, max)
  if (sorted.length === 0) {
    return (
      <div className="text-xs text-white/40 italic">
        Geen trend signals — trend-scan cron draait elke 4 uur.
      </div>
    )
  }
  const peak = Math.max(...sorted.map(c => c.momentum), 1)
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-1.5">
      {sorted.map(cell => {
        const intensity = Math.min(1, cell.momentum / peak)
        const opacity = 0.12 + intensity * 0.6
        return (
          <div
            key={`${cell.source}-${cell.keyword}`}
            title={`${cell.source}${cell.region ? ` · ${cell.region}` : ''} · momentum ${cell.momentum.toFixed(0)}`}
            className={clsx(
              'rounded-lg border border-white/5 px-2.5 py-2 flex items-center justify-between gap-2',
              'transition-transform hover:scale-[1.03]',
            )}
            style={{
              background: `linear-gradient(135deg, rgba(139,92,246,${opacity}) 0%, rgba(99,102,241,${opacity * 0.6}) 100%)`,
            }}
          >
            <div className="text-[11px] font-medium text-white/90 truncate">{cell.keyword}</div>
            <div className="text-[10px] tabular-nums text-white/60 shrink-0">{cell.momentum.toFixed(0)}</div>
          </div>
        )
      })}
    </div>
  )
}
