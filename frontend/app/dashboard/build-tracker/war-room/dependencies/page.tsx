import { createClient } from '@/lib/supabase/server'
import BuildGraph from '@/components/build-war-room/BuildGraph'
import type { BuildRawNode, BuildRawEdge } from '@/lib/build-war-room/graph'

export const dynamic = 'force-dynamic'

export default async function BuildDependenciesPage() {
  const supabase = await createClient()
  const [nodesRes, edgesRes] = await Promise.all([
    supabase.from('v_build_war_room_nodes').select('*'),
    supabase.from('v_build_war_room_edges').select('*'),
  ])
  const rawNodes = (nodesRes.data ?? []) as BuildRawNode[]
  const ids = new Set(rawNodes.map((n) => n.node_id))
  // alleen afhankelijkheids- en blocker-relaties (geen spine) → kritisch pad zichtbaar
  const depEdges = ((edgesRes.data ?? []) as BuildRawEdge[]).filter(
    (e) => (e.edge_type === 'dependency' || e.edge_type === 'blocker') && ids.has(e.source_id) && ids.has(e.target_id)
  )

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-white/5 bg-[#0e1525] p-3 text-xs text-white/55">
        <span className="font-semibold text-white/80">Dependency- &amp; blocker-graaf.</span>{' '}
        {depEdges.filter((e) => e.edge_type === 'dependency').length} dependency-relaties ·{' '}
        {depEdges.filter((e) => e.edge_type === 'blocker').length} blocker-relaties.
        Vul <code className="text-white/70">build_project_dependencies</code> om project-naar-project ketens
        (kritisch pad) te tonen; blocker-lijnen komen automatisch uit sectie-C build-items.
      </div>
      <BuildGraph rawNodes={rawNodes} rawEdges={depEdges} />
    </div>
  )
}
