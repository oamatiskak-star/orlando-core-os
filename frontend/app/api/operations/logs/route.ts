import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = new URL(req.url)
  const runId = searchParams.get('run_id')
  const workflowId = searchParams.get('workflow_id')
  const level = searchParams.get('level')
  const limit = parseInt(searchParams.get('limit') ?? '100', 10)

  let query = supabase
    .from('oc_workflow_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(Math.min(limit, 500))

  if (runId) query = query.eq('run_id', runId)
  if (workflowId) query = query.eq('workflow_id', workflowId)
  if (level) query = query.eq('level', level)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
