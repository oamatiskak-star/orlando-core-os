import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const revalidate = 30

export async function GET(_req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  const { data: uploads } = await supabase
    .from('media_holding_uploads')
    .select('id, status, created_at, updated_at, error')
    .gte('created_at', todayStart.toISOString())

  const uploadList = uploads ?? []

  const planned = uploadList.filter(u => ['queued', 'uploading', 'processing'].includes(u.status)).length
  const processed = uploadList.filter(u => u.status === 'verified_live').length
  const failed = uploadList.filter(u => u.status === 'failed').length

  return NextResponse.json({
    planned_uploads: planned,
    processed_uploads: processed,
    failed_uploads: failed,
    solved_uploads: 0,
    total_today: uploadList.length,
    by_status: {
      queued: uploadList.filter(u => u.status === 'queued').length,
      uploading: uploadList.filter(u => u.status === 'uploading').length,
      processing: uploadList.filter(u => u.status === 'processing').length,
      verified_live: uploadList.filter(u => u.status === 'verified_live').length,
      failed: uploadList.filter(u => u.status === 'failed').length,
    },
  })
}
