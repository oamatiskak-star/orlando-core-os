import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const revalidate = 0

const VALID_SOURCES = ['reddit','google_trends'] as const

// POST /api/media-holding/trend-scanner/scan
// Body: { sources?: string[], regions?: string[], subreddits?: string[] }
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const sources = Array.isArray(body.sources)
    ? body.sources.filter((s: unknown) => typeof s === 'string' && (VALID_SOURCES as readonly string[]).includes(s))
    : ['reddit','google_trends']
  const regions   = Array.isArray(body.regions)    ? body.regions    : ['NL','US','GB']
  const subreddits = Array.isArray(body.subreddits) ? body.subreddits : undefined

  const { data, error } = await supabase
    .from('orchestrator_tasks')
    .insert({
      company_id: 'modiwerijo',
      title: `Trend scan (${sources.join('+')})`,
      task_type: 'trend_scan',
      executor: 'trend_scanner',
      allowed_actions: ['*'],
      priority: 4,
      status: 'open',
      objective: [`Scan ${sources.join(', ')} voor trending keywords/topics en push naar trend_scanner_signals.`],
      payload: { sources, regions, subreddits, persona: 'Vortex' },
    })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ task_id: data.id, sources }, { status: 202 })
}
