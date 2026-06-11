import { createClient } from '@/lib/supabase/server'
import { getActiveCompanyId } from '@/lib/active-company-server'

export const dynamic = 'force-dynamic'

type MNode = {
  node_id: string; label: string; status: string | null; progress: number | null; score: number | null
  payload: { milestone_nr?: number; value_stage?: string; verdienmodel?: string; fundament?: string; route?: string }
}

const STATUS_COLOR: Record<string, string> = {
  done: '#22c55e', live: '#22c55e', in_progress: '#f59e0b', building: '#f59e0b', planned: '#64748b',
}

export default async function BuildMilestonesPage() {
  const supabase = await createClient()
  const slug = await getActiveCompanyId()
  const { data, error } = await supabase
    .from('v_build_war_room_nodes').select('*').eq('node_type', 'milestone').eq('entity_slug', slug)
  if (error) {
    return <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-300">Kon milestones niet laden: {error.message}</div>
  }
  const milestones = ((data ?? []) as MNode[]).sort(
    (a, b) => (a.payload?.milestone_nr ?? a.score ?? 0) - (b.payload?.milestone_nr ?? b.score ?? 0)
  )

  return (
    <div className="space-y-3">
      <p className="text-xs text-white/45">
        Milestone-roadmap (holding-niveau, {milestones.length} mijlpalen) — fase A → B → C → International →
        Enterprise → Global, op echte <code className="text-white/65">holding_milestones</code>-data.
      </p>
      <div className="relative space-y-2 border-l border-white/10 pl-5">
        {milestones.map((m) => {
          const c = STATUS_COLOR[(m.status ?? '').toLowerCase()] ?? '#64748b'
          return (
            <div key={m.node_id} className="relative rounded-lg border border-white/5 bg-[#0e1525] p-3">
              <span className="absolute -left-[27px] top-4 h-3 w-3 rounded-full border-2 border-[#070b14]" style={{ background: c }} />
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-white/40">#{m.payload?.milestone_nr ?? '—'}</span>
                  <span className="text-sm font-semibold text-white">{m.label}</span>
                </div>
                <span className="rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase" style={{ color: c, background: `${c}1a` }}>
                  {m.status ?? '—'}
                </span>
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-3 text-[10px] text-white/45">
                {m.payload?.value_stage && <span>fase: {m.payload.value_stage}</span>}
                {m.payload?.verdienmodel && <span>verdienmodel: {m.payload.verdienmodel}</span>}
                {m.progress != null && <span>{m.progress}%</span>}
              </div>
              {m.progress != null && (
                <div className="mt-1.5 h-1.5 w-full max-w-xs rounded-full bg-white/10 overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${m.progress}%`, background: c }} />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
