import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const revalidate = 0

export async function GET() {
  try {
    const admin = createAdminClient()
    await admin.from('infra_watchdog_checks').select('slug', { count: 'exact', head: true }).limit(1)
    return NextResponse.json({ ok: true, timestamp: new Date().toISOString() })
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 503 }
    )
  }
}
