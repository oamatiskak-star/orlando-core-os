// System Health Board — CEO-OS kern: 1 rij per kernsysteem (status/autonomie/aandacht/incidenten).
// Beantwoordt "werkt het? · wie vraagt mens? · waar zit de bottleneck?" zonder externe tool.
type Sys = {
  system: string; status: string; autonomy_live: boolean | null
  needs_attention: number; checks_total: number; checks_ok: number
  worst_severity: string | null; last_run: string | null; open_incidents: number
}

const STATUS: Record<string, { c: string; dot: string }> = {
  ok: { c: '#22c55e', dot: '🟢' }, degraded: { c: '#f59e0b', dot: '🟡' },
  down: { c: '#ef4444', dot: '🔴' }, idle: { c: '#64748b', dot: '⚪' },
}

export default function SystemHealthBoard({ data }: { data: Sys[] }) {
  const sorted = [...data].sort((a, b) => b.needs_attention - a.needs_attention)
  return (
    <div className="rounded-lg border border-white/5 bg-[#0e1525]">
      <div className="flex items-center justify-between border-b border-white/5 px-3 py-2">
        <span className="text-xs font-semibold text-white">System Health Board</span>
        <span className="text-[10px] text-white/35">operationele gezondheid — geen externe tool nodig</span>
      </div>
      <table className="w-full text-left text-xs">
        <thead className="text-white/35">
          <tr className="border-b border-white/5">
            <th className="px-3 py-1.5 font-medium">Systeem</th>
            <th className="px-3 py-1.5 font-medium">Status</th>
            <th className="px-3 py-1.5 font-medium">Autonoom</th>
            <th className="px-3 py-1.5 font-medium">Vraagt aandacht</th>
            <th className="px-3 py-1.5 font-medium">Incidenten</th>
            <th className="px-3 py-1.5 font-medium">Checks</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((s) => {
            const st = STATUS[s.status] ?? STATUS.idle
            return (
              <tr key={s.system} className="border-b border-white/5 last:border-0">
                <td className="px-3 py-1.5 font-medium text-white/80">{s.system}</td>
                <td className="px-3 py-1.5">
                  <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase"
                    style={{ color: st.c, background: `${st.c}1a` }}>{st.dot} {s.status}</span>
                </td>
                <td className="px-3 py-1.5">
                  {s.autonomy_live
                    ? <span className="text-emerald-400">autonoom</span>
                    : <span className="text-white/40">handmatig</span>}
                </td>
                <td className="px-3 py-1.5">
                  {s.needs_attention > 0
                    ? <span className="font-semibold text-amber-400">{s.needs_attention}</span>
                    : <span className="text-white/30">—</span>}
                </td>
                <td className="px-3 py-1.5">{s.open_incidents > 0 ? <span className="text-red-400">{s.open_incidents} open</span> : <span className="text-white/30">—</span>}</td>
                <td className="px-3 py-1.5 text-white/45">{s.checks_ok}/{s.checks_total}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
