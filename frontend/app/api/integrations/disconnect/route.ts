import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  const { type } = await request.json() as { type: string }
  if (!type) return NextResponse.json({ error: 'type vereist' }, { status: 400 })

  const supabase = createAdminClient()
  await supabase.from('integration_connections').update({
    status:     'disconnected',
    updated_at: new Date().toISOString(),
  }).eq('type', type)

  return NextResponse.json({ ok: true })
}
