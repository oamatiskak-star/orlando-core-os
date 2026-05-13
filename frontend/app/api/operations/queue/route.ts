import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = new URL(req.url)
  const queueName = searchParams.get('queue_name')
  const status = searchParams.get('status')
  const company = searchParams.get('company')

  let query = supabase
    .from('oc_queue_jobs')
    .select('id, queue_name, company, job_type, status, priority, retry_count, max_retries, error_message, scheduled_at, started_at, completed_at, created_at')
    .order('created_at', { ascending: false })
    .limit(200)

  if (queueName) query = query.eq('queue_name', queueName)
  if (status) query = query.eq('status', status)
  if (company) query = query.eq('company', company)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const stats = {
    pending: data?.filter(j => j.status === 'pending').length ?? 0,
    running: data?.filter(j => j.status === 'running').length ?? 0,
    completed: data?.filter(j => j.status === 'completed').length ?? 0,
    failed: data?.filter(j => j.status === 'failed').length ?? 0,
  }

  return NextResponse.json({ jobs: data, stats })
}
