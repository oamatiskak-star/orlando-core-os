// Agenda Vandaag — wat moet vandaag gebeuren (uit planning_items via v_build_today_agenda).
type Item = {
  id: string; titel: string; type: string | null; status: string | null
  priority: string | null; toegewezen: string | null; start_date: string | null; due_date: string | null
}
const PRIO: Record<string, string> = { critical: '#ef4444', high: '#f59e0b', P0: '#ef4444', P1: '#f59e0b' }

export default function TodayAgenda({ items }: { items: Item[] }) {
  return (
    <div className="rounded-lg border border-white/5 bg-[#0e1525] p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold text-white/80">Agenda Vandaag</span>
        <span className="text-[10px] text-white/35">{items.length} taken</span>
      </div>
      {items.length === 0 ? (
        <div className="text-[11px] text-white/40">Niets specifiek voor vandaag gepland. Vul <code className="text-white/55">planning_items</code> (start/due = vandaag) om hier dagtaken te zien.</div>
      ) : (
        <div className="space-y-1.5">
          {items.map((i) => (
            <div key={i.id} className="flex items-center gap-2 text-[11px]">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: PRIO[i.priority ?? ''] ?? '#64748b' }} />
              <span className="flex-1 truncate text-white/75">{i.titel}</span>
              {i.toegewezen && <span className="text-[10px] text-white/35">{i.toegewezen}</span>}
              {i.status && <span className="rounded bg-white/5 px-1.5 py-0.5 text-[9px] text-white/40">{i.status}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
