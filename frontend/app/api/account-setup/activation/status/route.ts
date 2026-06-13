import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Live-poll voor de Activation-tabel: laatste runs + recente steps + open human-actions
 * (MANUAL REQUIRED) per programma. Read-only.
 */
export const revalidate = 0

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const programId = req.nextUrl.searchParams.get('programId')?.trim()
  if (!programId) return NextResponse.json({ error: 'programId ontbreekt' }, { status: 400 })

  const [runs, steps, actions] = await Promise.all([
    supabase
      .from('account_setup_runs')
      .select('id, run_kind, status, started_at, ended_at, heartbeat_at')
      .eq('program_id', programId)
      .order('started_at', { ascending: false })
      .limit(12),
    supabase
      .from('account_setup_run_steps')
      .select('id, run_id, order_idx, step_kind, status, output, started_at')
      .order('started_at', { ascending: false })
      .limit(30),
    supabase
      .from('account_setup_human_actions')
      .select('id, action_kind, title, description, status, metadata, due_at, created_at')
      .eq('program_id', programId)
      .in('status', ['open', 'in_progress'])
      .order('created_at', { ascending: false }),
  ])

  if (runs.error) return NextResponse.json({ error: runs.error.message }, { status: 500 })

  // Steps filteren op de runs van dit programma (zonder extra round-trip).
  const runIds = new Set((runs.data ?? []).map(r => r.id))
  const programSteps = (steps.data ?? []).filter(s => runIds.has(s.run_id as string))

  return NextResponse.json({
    runs: runs.data ?? [],
    steps: programSteps,
    actions: actions.data ?? [],
  })
}
