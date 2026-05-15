'use client'

interface CategoryBadgeProps {
  category: string | null
}

const CONFIG: Record<string, { label: string; color: string }> = {
  leverancier:   { label: 'Leverancier',   color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  klant:         { label: 'Klant',         color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
  incasso:       { label: 'Incasso',       color: 'bg-red-500/20 text-red-400 border-red-500/30' },
  factuur:       { label: 'Factuur',       color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
  belasting:     { label: 'Belasting',     color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
  advocaat:      { label: 'Advocaat',      color: 'bg-rose-500/20 text-rose-400 border-rose-500/30' },
  privé:         { label: 'Privé',         color: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30' },
  vastgoed:      { label: 'Vastgoed',      color: 'bg-teal-500/20 text-teal-400 border-teal-500/30' },
  support:       { label: 'Support',       color: 'bg-sky-500/20 text-sky-400 border-sky-500/30' },
  automatisering:{ label: 'Automatisering',color: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' },
  spam:          { label: 'Spam',          color: 'bg-zinc-700 text-zinc-400 border-zinc-600' },
}

export default function CategoryBadge({ category }: CategoryBadgeProps) {
  if (!category) return null
  const cfg = CONFIG[category] ?? { label: category, color: 'bg-white/[0.06] text-white/40 border-white/[0.08]' }

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${cfg.color}`}>
      {cfg.label}
    </span>
  )
}
