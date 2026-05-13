import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = new URL(req.url)
  const company = searchParams.get('company')
  const workflowId = searchParams.get('workflow_id')
  const days = parseInt(searchParams.get('days') ?? '30', 10)

  const sinceDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  let query = supabase
    .from('oc_workflow_metrics')
    .select('*')
    .gte('date', sinceDate)
    .order('date', { ascending: true })

  if (company) query = query.eq('company', company)
  if (workflowId) query = query.eq('workflow_id', workflowId)

  const { data: metrics, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const aggregated = {
    total_runs: metrics?.reduce((s, m) => s + (m.runs_total ?? 0), 0) ?? 0,
    total_success: metrics?.reduce((s, m) => s + (m.runs_success ?? 0), 0) ?? 0,
    total_failed: metrics?.reduce((s, m) => s + (m.runs_failed ?? 0), 0) ?? 0,
    avg_duration_ms: metrics?.length
      ? metrics.reduce((s, m) => s + (m.avg_duration_ms ?? 0), 0) / metrics.length
      : 0,
    by_date: metrics,
  }

  return NextResponse.json(aggregated)
}
