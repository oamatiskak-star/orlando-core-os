import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Mislukte upload terug naar de wachtrij. Niet voor 'unrecoverable' (bronbestand weg).
const RETRYABLE = ['failed', 'manual_review_required', 'retrying']

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const id = typeof body.id === 'string' ? body.id : null
  if (!id) return NextResponse.json({ error: 'id vereist' }, { status: 400 })

  const admin = createAdminClient()
  const { data: job } = await admin
    .from('youtube_upload_queue').select('status').eq('id', id).maybeSingle()
  if (!job) return NextResponse.json({ error: 'Job niet gevonden' }, { status: 404 })
  if (!RETRYABLE.includes(job.status)) {
    return NextResponse.json({ error: `Status '${job.status}' is niet opnieuw te proberen` }, { status: 400 })
  }

  const { error } = await admin
    .from('youtube_upload_queue')
    .update({ status: 'queued', last_error: null, retry_count: 0, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
