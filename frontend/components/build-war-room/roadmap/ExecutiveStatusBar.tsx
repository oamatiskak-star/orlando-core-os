// Executive Status Bar — "waar staan we" in één rij KPI-tegels (per actieve entiteit).
type Props = {
  completionPct: number; done: number; total: number
  active: number; queued: number; blocked: number
  openBlockers: number; upcomingMilestones: number
}

function Tile({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent: string }) {
  return (
    <div className="rounded-lg border border-white/5 bg-[#0e1525] p-2.5">
      <div className="text-[10px] uppercase tracking-wide text-white/40">{label}</div>
      <div className="mt-0.5 text-lg font-bold" style={{ color: accent }}>{value}</div>
      {sub && <div className="text-[10px] text-white/35">{sub}</div>}
    </div>
  )
}

export default function ExecutiveStatusBar(p: Props) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
      <Tile label="Completion" value={`${p.completionPct}%`} sub={`${p.done}/${p.total} af`} accent="#a855f7" />
      <Tile label="Actief" value={String(p.active)} sub="in uitvoering" accent="#38bdf8" />
      <Tile label="Gepland" value={String(p.queued)} accent="#64748b" />
      <Tile label="Geblokkeerd" value={String(p.blocked)} accent={p.blocked > 0 ? '#ef4444' : '#64748b'} />
      <Tile label="Open blockers" value={String(p.openBlockers)} accent={p.openBlockers > 0 ? '#ef4444' : '#22c55e'} />
      <Tile label="Komende milestones" value={String(p.upcomingMilestones)} accent="#f59e0b" />
    </div>
  )
}
