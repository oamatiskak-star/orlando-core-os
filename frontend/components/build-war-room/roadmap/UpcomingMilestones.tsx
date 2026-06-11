// Komende Milestones — commitments met echte target_date (eerst), dan op volgorde.
type M = {
  id: string; milestone_nr: number | null; naam: string; status: string | null
  progress_pct: number | null; value_stage: string | null; target_date: string | null
}
const SC: Record<string, string> = { done: '#22c55e', live: '#22c55e', in_progress: '#f59e0b', building: '#f59e0b', planned: '#64748b' }

export default function UpcomingMilestones({ milestones }: { milestones: M[] }) {
  const top = milestones.slice(0, 8)
  return (
    <div className="rounded-lg border border-white/5 bg-[#0e1525] p-3">
      <div className="mb-2 text-xs font-semibold text-white/80">Komende Milestones</div>
      <div className="space-y-1.5">
        {top.map((m) => {
          const c = SC[(m.status ?? '').toLowerCase()] ?? '#64748b'
          return (
            <div key={m.id} className="flex items-center gap-2 text-[11px]">
              <span style={{ color: '#f59e0b' }}>◆</span>
              <span className="flex-1 truncate text-white/75">{m.naam}</span>
              {m.target_date
                ? <span className="text-[10px] text-amber-400">{new Date(m.target_date).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}</span>
                : <span className="text-[10px] text-white/30">geen datum</span>}
              <span className="rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase" style={{ color: c, background: `${c}1a` }}>{m.status ?? '—'}</span>
            </div>
          )
        })}
        {top.length === 0 && <div className="text-[11px] text-white/40">Geen milestones.</div>}
      </div>
      {milestones.some((m) => !m.target_date) && (
        <div className="mt-1.5 text-[9px] text-white/30">Tip: zet `target_date` op milestones voor echte deadline-sturing (B).</div>
      )}
    </div>
  )
}
