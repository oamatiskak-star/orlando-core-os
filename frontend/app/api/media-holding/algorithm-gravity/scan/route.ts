import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const revalidate = 0

// POST /api/media-holding/algorithm-gravity/scan
// Dispatches een orchestrator_task met executor='gravity_detector' zodat
// de ao-executor de breakout-scan + variant-dispatch draait.
export async function POST(_req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('orchestrator_tasks')
    .insert({
      company_id: 'modiwerijo',
      title: 'Algorithm Gravity scan',
      task_type: 'gravity_scan',
      executor: 'gravity_detector',
      allowed_actions: ['*'],
      priority: 3,
      status: 'open',
      objective: ['Detecteer breakouts in viral_opportunities en dispatch winner_extraction variants.'],
      payload: { persona: 'Vortex' }, // Vortex is supervisor van viral intelligence; gravity is sub
    })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ task_id: data.id }, { status: 202 })
}
