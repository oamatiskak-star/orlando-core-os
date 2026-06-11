// Prioriteitsverdeling P0-P3 — direct zien waar de focus ligt.
type Dist = { P0: number; P1: number; P2: number; P3: number; none: number }

const ROWS: { key: keyof Dist; label: string; c: string }[] = [
  { key: 'P0', label: 'P0 · Kritiek', c: '#ef4444' },
  { key: 'P1', label: 'P1 · Hoog', c: '#f59e0b' },
  { key: 'P2', label: 'P2 · Normaal', c: '#38bdf8' },
  { key: 'P3', label: 'P3 · Laag', c: '#64748b' },
]

export default function PriorityDistribution({ dist }: { dist: Dist }) {
  const max = Math.max(1, dist.P0, dist.P1, dist.P2, dist.P3)
  return (
    <div className="rounded-lg border border-white/5 bg-[#0e1525] p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold text-white/80">Prioriteitsverdeling</span>
        {dist.none > 0 && <span className="text-[10px] text-white/35">{dist.none} zonder prioriteit</span>}
      </div>
      <div className="space-y-1.5">
        {ROWS.map((r) => (
          <div key={r.key} className="flex items-center gap-2">
            <span className="w-24 text-[10px] text-white/55">{r.label}</span>
            <div className="h-3 flex-1 rounded bg-white/5 overflow-hidden">
              <div className="h-full rounded" style={{ width: `${(dist[r.key] / max) * 100}%`, background: r.c }} />
            </div>
            <span className="w-6 text-right text-xs font-semibold" style={{ color: r.c }}>{dist[r.key]}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
