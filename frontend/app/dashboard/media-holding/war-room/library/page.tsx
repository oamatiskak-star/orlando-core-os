import { createClient } from '@/lib/supabase/server'
import CreativeLibrary from '@/components/war-room/CreativeLibrary'
import type { WarRoomRawNode, WarRoomRawEdge, WarRoomHermesRec } from '@/lib/war-room/graph'

export const dynamic = 'force-dynamic'

export default async function CreativeLibraryPage() {
  const supabase = await createClient()
  const [nodesRes, edgesRes, hermesRes] = await Promise.all([
    supabase.from('v_war_room_nodes').select('*'),
    supabase.from('v_war_room_edges').select('*'),
    supabase
      .from('executive_recommendations')
      .select('id, action_kind, target_id, priority, rationale, status')
      .eq('target_kind', 'channel')
      .neq('status', 'executed')
      .order('priority', { ascending: false })
      .limit(600),
  ])

  const rawNodes = (nodesRes.data ?? []) as WarRoomRawNode[]
  const allEdges = (edgesRes.data ?? []) as WarRoomRawEdge[]
  const ids = new Set(rawNodes.map((n) => n.node_id))
  const rawEdges = allEdges.filter((e) => ids.has(e.source_id) && ids.has(e.target_id))

  const hermesByChannel: Record<string, WarRoomHermesRec[]> = {}
  for (const r of (hermesRes.data ?? []) as Array<{ id: string; action_kind: string; target_id: string; priority: number | null; rationale: string | null; status: string | null }>) {
    if (!r.target_id) continue
    const list = (hermesByChannel[r.target_id] ??= [])
    if (list.length < 5) list.push({ id: r.id, action_kind: r.action_kind, priority: r.priority, rationale: r.rationale, status: r.status })
  }

  const err = nodesRes.error?.message ?? edgesRes.error?.message
  if (err) {
    return <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-300">Kon de library niet laden: {err}</div>
  }
  const creativeCount = rawNodes.filter((n) => n.node_type === 'creative').length
  if (creativeCount === 0) {
    return <div className="rounded-lg border border-white/10 bg-[#0e1525] p-6 text-sm text-white/50">Nog geen creatives in de fabriek. Zodra de Content Factory produceert verschijnen ze hier.</div>
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-white/45">Creative Library (Human View) — alle creatives visueel beoordelen. Klik een creative voor het detail-paneel.</p>
      <CreativeLibrary rawNodes={rawNodes} rawEdges={rawEdges} hermesByChannel={hermesByChannel} />
    </div>
  )
}
