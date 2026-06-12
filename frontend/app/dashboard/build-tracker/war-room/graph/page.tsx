import { createClient } from '@/lib/supabase/server'
import { getActiveCompanyId } from '@/lib/active-company-server'
import BuildGraph from '@/components/build-war-room/BuildGraph'
import type { BuildRawNode, BuildRawEdge } from '@/lib/build-war-room/graph'

export const dynamic = 'force-dynamic'

export default async function BuildWarRoomGraphPage() {
  const supabase = await createClient()
  const slug = await getActiveCompanyId() // actieve entiteit (cookie orlando_active_company) == entity_slug
  const [nodesRes, edgesRes, complRes] = await Promise.all([
    supabase.from('v_build_war_room_nodes').select('*').eq('entity_slug', slug),
    supabase.from('v_build_war_room_edges').select('*'),
    supabase.from('v_build_entity_completion').select('*').eq('entity_slug', slug),
  ])

  const rawNodes = (nodesRes.data ?? []) as BuildRawNode[]
  const allEdges = (edgesRes.data ?? []) as BuildRawEdge[]
  const ids = new Set(rawNodes.map((n) => n.node_id))
  const rawEdges = allEdges.filter((e) => ids.has(e.source_id) && ids.has(e.target_id))
  const completion = (complRes.data ?? []) as Array<{
    entity_slug: string; entity_name: string; completion_pct: number
    total: number; done: number; blocker_count: number
  }>

  const err = nodesRes.error?.message ?? edgesRes.error?.message
  if (err) {
    return (
      <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-300">
        Kon de graph niet laden: {err}
      </div>
    )
  }

  const count = (t: string) => rawNodes.filter((n) => n.node_type === t).length

  return (
    <div className="space-y-3">
      {/* completion per entiteit (echte milestones/projecten, geen handmatig %) */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        {completion.map((c) => (
          <div key={c.entity_slug} className="rounded-lg border border-white/5 bg-[#0e1525] p-2.5">
            <div className="text-[10px] uppercase tracking-wide text-white/40 truncate">{c.entity_name}</div>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-lg font-bold text-white">{c.completion_pct}%</span>
              <span className="text-[10px] text-white/35">{c.done}/{c.total}</span>
            </div>
            <div className="mt-1 h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
              <div className="h-full rounded-full bg-violet-400" style={{ width: `${c.completion_pct}%` }} />
            </div>
            {c.blocker_count > 0 && (
              <div className="mt-1 text-[9px] font-semibold text-red-400">{c.blocker_count} blocker(s)</div>
            )}
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-4 text-xs text-white/45">
        <span>{count('entity')} entiteiten</span>
        <span>{count('program')} programma&apos;s</span>
        <span>{count('project')} projecten</span>
        <span>{count('milestone')} milestones</span>
        <span>{count('build_item')} build items</span>
        <span>{count('pr')} PR&apos;s (inferred)</span>
        <span>{count('revenue')} resultaten</span>
      </div>

      {rawNodes.length === 0 ? (
        <div className="rounded-lg border border-white/10 bg-[#0e1525] p-6 text-sm text-white/50">
          Nog geen build-data. Zodra de Build Tracker gevuld is verschijnt de graph hier.
        </div>
      ) : (
        <BuildGraph rawNodes={rawNodes} rawEdges={rawEdges} defaultZoom="day" />
      )}
    </div>
  )
}
