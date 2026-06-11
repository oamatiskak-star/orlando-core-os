// Incident-lifecycle — gesloten keten per incident: detect→diagnose→heal→validate→escalate.
// Beantwoordt: echt probleem? · auto-opgelost? · root cause? · mens nodig?
type Incident = {
  service_name: string | null; service_type: string | null; failure_kind: string | null
  failure_summary: string | null; proposed_actions: unknown; status: string | null
  opened_at: string | null; resolved_at: string | null; incident_kind: string | null
}

function Stage({ on, label }: { on: boolean; label: string }) {
  return (
    <span className="inline-flex items-center gap-0.5 text-[9px]" style={{ color: on ? '#22c55e' : '#475569' }}>
      <span>{on ? '●' : '○'}</span>{label}
    </span>
  )
}

export default function IncidentLifecycle({ incidents, openCount, resolvedCount }: {
  incidents: Incident[]; openCount: number; resolvedCount: number
}) {
  return (
    <div className="rounded-lg border border-white/5 bg-[#0e1525] p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold text-white/80">Incident-lifecycle</span>
        <span className="text-[10px]">
          <span className="text-red-400">{openCount} open</span>
          <span className="text-white/30"> · </span>
          <span className="text-emerald-400">{resolvedCount} auto-resolved</span>
        </span>
      </div>
      <div className="space-y-2">
        {incidents.slice(0, 5).map((inc, i) => {
          const resolved = inc.status === 'resolved' || !!inc.resolved_at
          const diagnosed = inc.proposed_actions != null && (Array.isArray(inc.proposed_actions) ? inc.proposed_actions.length > 0 : true)
          return (
            <div key={i} className="rounded border border-white/5 bg-[#070b14] p-2">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-[11px] font-medium text-white/75">{inc.service_name ?? inc.incident_kind ?? 'incident'}</span>
                <span className="rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase"
                  style={{ color: resolved ? '#22c55e' : '#ef4444', background: resolved ? '#22c55e1a' : '#ef44441a' }}>
                  {resolved ? 'auto-resolved' : 'open · mens?'}
                </span>
              </div>
              {inc.failure_summary && <div className="mt-0.5 truncate text-[10px] text-white/45">{inc.failure_summary}</div>}
              <div className="mt-1 flex flex-wrap gap-2">
                <Stage on={!!inc.opened_at} label="detect" />
                <Stage on={diagnosed} label="diagnose" />
                <Stage on={resolved} label="heal" />
                <Stage on={resolved} label="validate" />
                <Stage on={!resolved} label="escalate" />
              </div>
            </div>
          )
        })}
        {incidents.length === 0 && <div className="text-[11px] text-emerald-400/70">Geen incidenten — keten rustig.</div>}
      </div>
    </div>
  )
}
