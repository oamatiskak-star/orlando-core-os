import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const revalidate = 0

// GET /api/media-holding/launches/rank — dry-run rangschikking zonder promote
export async function GET(_req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase.rpc('rank_actief_opportunities')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ranked: data ?? [] })
}
