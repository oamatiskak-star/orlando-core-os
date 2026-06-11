import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const revalidate = 0

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const [blk, risk] = await Promise.all([
    supabase.from('v_build_blockers').select('*'),
    supabase.from('v_build_risks').select('*'),
  ])
  if (blk.error) return NextResponse.json({ error: blk.error.message }, { status: 500 })
  if (risk.error) return NextResponse.json({ error: risk.error.message }, { status: 500 })
  return NextResponse.json({ blockers: blk.data ?? [], risks: risk.data ?? [] })
}
