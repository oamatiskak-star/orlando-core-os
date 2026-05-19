import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const revalidate = 0

// GET /api/orchestrator/task-chain?root=<parent_task_id>
// Levert alle orchestrator_task_chain steps voor een chain-root.
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const root = req.nextUrl.searchParams.get('root')
  if (!root) return NextResponse.json({ steps: [] })

  const { data, error } = await supabase
    .from('orchestrator_task_chain')
    .select('*')
    .eq('parent_task_id', root)
    .order('step_order', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ steps: data ?? [] })
}
