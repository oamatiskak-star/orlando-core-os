import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

// Handmatige Hermes-hercheck vanaf het dashboard: draait de supervisor opnieuw
// (her-evalueert alle checks + lost opgeloste alarmen automatisch op).
export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { error } = await admin.rpc('hermes_supervisor')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, ran_at: new Date().toISOString() })
}
