// Projecten per status — altijd zichtbaar (niet verstopt in de graaf).
type Counts = { done: number; in_progress: number; queued: number; blocked: number }

const COLS: { key: keyof Counts; label: string; icon: string; c: string }[] = [
  { key: 'done', label: 'Afgerond', icon: '✅', c: '#22c55e' },
  { key: 'in_progress', label: 'In uitvoering', icon: '🔵', c: '#38bdf8' },
  { key: 'queued', label: 'Gepland', icon: '⚪', c: '#64748b' },
  { key: 'blocked', label: 'Geblokkeerd', icon: '🔴', c: '#ef4444' },
]

export default function StatusColumns({ counts }: { counts: Counts }) {
  return (
    <div className="rounded-lg border border-white/5 bg-[#0e1525] p-3">
      <div className="mb-2 text-xs font-semibold text-white/80">Projecten per status</div>
      <div className="grid grid-cols-4 gap-2">
        {COLS.map((col) => (
          <div key={col.key} className="rounded border border-white/5 bg-[#070b14] p-2 text-center">
            <div className="text-lg">{col.icon}</div>
            <div className="text-xl font-bold" style={{ color: col.c }}>{counts[col.key]}</div>
            <div className="text-[10px] text-white/45">{col.label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
