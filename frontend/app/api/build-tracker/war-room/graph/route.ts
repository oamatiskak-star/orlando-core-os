import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const revalidate = 0

// Read-only Build War Room graaf: nodes + edges uit de v_build_war_room_* views (shaunum).
export async function GET(_req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [nodesRes, edgesRes] = await Promise.all([
    supabase.from('v_build_war_room_nodes').select('*'),
    supabase.from('v_build_war_room_edges').select('*'),
  ])

  if (nodesRes.error) return NextResponse.json({ error: nodesRes.error.message }, { status: 500 })
  if (edgesRes.error) return NextResponse.json({ error: edgesRes.error.message }, { status: 500 })

  const nodes = nodesRes.data ?? []
  const ids = new Set(nodes.map((n: { node_id: string }) => n.node_id))
  const edges = (edgesRes.data ?? []).filter(
    (e: { source_id: string; target_id: string }) => ids.has(e.source_id) && ids.has(e.target_id)
  )

  return NextResponse.json({ nodes, edges })
}
