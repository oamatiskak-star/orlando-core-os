import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  const supabase = await createClient()
  const { key } = await params
  const { status } = await req.json()

  const allowed = ['pending', 'building', 'live', 'blocked']
  if (!status || !allowed.includes(status)) {
    return NextResponse.json({ error: 'Ongeldige status' }, { status: 400 })
  }

  const update: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  }

  if (status === 'live') {
    update.live_at = new Date().toISOString()
  }

  const { error } = await supabase
    .from('media_holding_modules')
    .update(update)
    .eq('module_key', key)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
