import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Mislukte queue-job terug naar 'pending' zodat de worker 'm opnieuw oppakt.
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const id = typeof body.id === 'string' ? body.id : null
  if (!id) return NextResponse.json({ error: 'id vereist' }, { status: 400 })

  const admin = createAdminClient()
  const { error } = await admin
    .from('oc_queue_jobs')
    .update({ status: 'pending', error_message: null, retry_count: 0 })
    .eq('id', id)
    .eq('status', 'failed')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
