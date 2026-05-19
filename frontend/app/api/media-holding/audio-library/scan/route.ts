import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const revalidate = 0

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const regions = Array.isArray(body.regions) ? body.regions : ['NL','US','GB']
  const maxPerRegion = typeof body.max_per_region === 'number' ? body.max_per_region : 50

  const { data, error } = await supabase
    .from('orchestrator_tasks')
    .insert({
      company_id: 'modiwerijo',
      title: `Audio scan YouTube Music (${regions.join('/')})`,
      task_type: 'audio_scan',
      executor: 'audio_scanner',
      allowed_actions: ['*'],
      priority: 4,
      status: 'open',
      objective: [`Scan trending music op YouTube ${regions.join(', ')}.`],
      payload: { regions, max_per_region: maxPerRegion, persona: 'Vortex' },
    })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ task_id: data.id }, { status: 202 })
}
