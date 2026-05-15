'use client'

interface PriorityBadgeProps {
  priority: string
}

const CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  urgent: { label: 'Urgent', color: 'bg-red-500/20 text-red-400 border-red-500/30', dot: 'bg-red-500' },
  high:   { label: 'Hoog',   color: 'bg-orange-500/20 text-orange-400 border-orange-500/30', dot: 'bg-orange-400' },
  normal: { label: 'Normaal', color: 'bg-white/[0.06] text-white/50 border-white/[0.08]', dot: 'bg-white/40' },
  low:    { label: 'Laag',   color: 'bg-white/[0.04] text-white/30 border-white/[0.06]', dot: 'bg-white/20' },
  spam:   { label: 'Spam',   color: 'bg-zinc-800 text-zinc-500 border-zinc-700', dot: 'bg-zinc-500' },
}

export default function PriorityBadge({ priority }: PriorityBadgeProps) {
  const cfg = CONFIG[priority] ?? CONFIG.normal

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium border ${cfg.color}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  )
}
