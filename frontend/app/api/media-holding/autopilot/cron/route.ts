import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const revalidate = 0

// POST /api/media-holding/autopilot/cron
// Body: { tasks?: string[] }  // default: ['viral_scanner','trend_scanner','audio_scanner']
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const tasks = Array.isArray(body.tasks) && body.tasks.length > 0 ? body.tasks : undefined

  const { data, error } = await supabase
    .from('orchestrator_tasks')
    .insert({
      company_id: 'modiwerijo',
      title: '[cron] dispatcher tick',
      task_type: 'cron_tick',
      executor: 'cron_dispatcher',
      allowed_actions: ['*'],
      priority: 5,
      status: 'open',
      objective: ['Periodieke scan-tick.'],
      payload: tasks ? { tasks } : {},
    })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ task_id: data.id, tasks: tasks ?? 'default' }, { status: 202 })
}
