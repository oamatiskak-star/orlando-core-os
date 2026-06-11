import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getActiveCompanyId } from '@/lib/active-company-server'

export const revalidate = 0

// Read-only Build War Room graaf: nodes + edges uit de v_build_war_room_* views (shaunum).
// Gescopet op de actieve entiteit (cookie orlando_active_company == entity_slug),
// zodat realtime-refetch dezelfde scope behoudt als de server-render.
export async function GET(_req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const slug = await getActiveCompanyId()
  const [nodesRes, edgesRes] = await Promise.all([
    supabase.from('v_build_war_room_nodes').select('*').eq('entity_slug', slug),
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
