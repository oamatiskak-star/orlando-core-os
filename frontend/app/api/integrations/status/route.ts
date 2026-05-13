import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('integration_connections')
    .select('type, status, connected_at, metadata')
  const map = Object.fromEntries((data ?? []).map(r => [r.type, r]))
  return NextResponse.json(map)
}
