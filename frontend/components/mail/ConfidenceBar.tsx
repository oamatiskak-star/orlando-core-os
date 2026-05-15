'use client'

interface ConfidenceBarProps {
  value: number
  label?: string
  showPercent?: boolean
}

export default function ConfidenceBar({ value, label, showPercent = true }: ConfidenceBarProps) {
  const pct = Math.round(value * 100)
  const color = pct >= 75 ? '#22c55e' : pct >= 50 ? '#f59e0b' : '#ef4444'

  return (
    <div className="space-y-1">
      {(label || showPercent) && (
        <div className="flex items-center justify-between">
          {label && <span className="text-[11px] text-white/40">{label}</span>}
          {showPercent && (
            <span className="text-[11px] font-medium" style={{ color }}>
              {pct}%
            </span>
          )}
        </div>
      )}
      <div className="h-1 bg-white/[0.06] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  )
}
