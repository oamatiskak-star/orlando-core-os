import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const revalidate = 0
export const dynamic = 'force-dynamic'

export async function GET() {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('media_holding_targets')
    .select('channel_id,metric,period,target_value,notes,updated_at')
    .order('metric', { ascending: true })

  if (error) {
    // Migratie 083 nog niet applied → laat overview leeg targets renderen.
    return NextResponse.json({ targets: [], warning: error.message })
  }
  return NextResponse.json({ targets: data ?? [] })
}
