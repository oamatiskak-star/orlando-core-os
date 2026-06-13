// CEO Minutes Per Day — primaire CEO-OS-KPI (doel <20). Geschatte handmatige interventietijd + trend.
type Minutes = {
  ceo_minutes_estimate: number; target_minutes: number
  manual_reviews: number; failing_checks: number; open_incidents: number; open_escalations: number; norm: string
}
type TrendPoint = { day: string; ceo_minutes: number }

export default function CeoMinutesGauge({ data, trend = [] }: { data: Minutes | null; trend?: TrendPoint[] }) {
  const min = data?.ceo_minutes_estimate ?? 0
  const target = data?.target_minutes ?? 20
  const ok = min <= target
  const color = ok ? '#22c55e' : min <= target * 3 ? '#f59e0b' : '#ef4444'
  const pct = Math.min(100, Math.round((target / Math.max(min, 1)) * 100))

  // trend: delta vs vorige snapshot (↓ = beter); mini-sparkline
  const tlast = trend.length >= 2 ? trend[trend.length - 1].ceo_minutes : null
  const tprev = trend.length >= 2 ? trend[trend.length - 2].ceo_minutes : null
  const delta = tlast != null && tprev != null ? tlast - tprev : null
  const tmax = Math.max(target, ...trend.map((t) => t.ceo_minutes), 1)

  return (
    <div className="rounded-lg border border-white/5 bg-[#0e1525] p-4">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-white/40">CEO Minutes / Dag</span>
        <span className="text-[10px] text-white/35">doel &lt; {target}</span>
      </div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="text-3xl font-bold" style={{ color }}>{min}</span>
        <span className="text-xs text-white/40">min/dag</span>
        {!ok && <span className="rounded bg-red-500/15 px-1.5 py-0.5 text-[9px] font-semibold text-red-400">keten niet gesloten</span>}
      </div>
      <div className="mt-2 h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>

      {/* trend (dagelijkse snapshot 03:00) */}
      <div className="mt-2 flex items-end justify-between gap-2">
        <div className="flex h-8 items-end gap-0.5">
          {trend.length > 0 ? trend.slice(-21).map((t, i) => {
            const h = Math.max(2, Math.round((t.ceo_minutes / tmax) * 30))
            const c = t.ceo_minutes <= target ? '#22c55e' : t.ceo_minutes <= target * 3 ? '#f59e0b' : '#ef4444'
            return <span key={i} title={`${t.day}: ${t.ceo_minutes} min`} className="w-1.5 rounded-sm" style={{ height: h, background: c }} />
          }) : <span className="text-[9px] text-white/30">trend bouwt op…</span>}
        </div>
        <div className="text-right text-[10px]">
          {delta != null
            ? <span className={delta < 0 ? 'text-emerald-400' : delta > 0 ? 'text-red-400' : 'text-white/40'}>
                {delta < 0 ? '▼' : delta > 0 ? '▲' : '■'} {Math.abs(delta)} vs vorige
              </span>
            : <span className="text-white/30">snapshot 03:00/dag</span>}
        </div>
      </div>
      {data && (
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-white/45">
          <span>{data.manual_reviews} reviews</span>
          <span>{data.failing_checks} checks</span>
          <span>{data.open_incidents} incidenten</span>
          <span>{data.open_escalations} escalaties</span>
        </div>
      )}
    </div>
  )
}
