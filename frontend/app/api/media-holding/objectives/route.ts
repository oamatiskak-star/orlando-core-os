import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const revalidate = 0

// GET /api/media-holding/objectives
// Actieve kanaaldoelen + echte 30d-voortgang (omzet vs doel) uit v_channel_objective_progress.
// Stuurbron voor de "maak een €60k-kanaal"-tile op het dashboard.
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('v_channel_objective_progress')
    .select('*')
    .order('progress_pct', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ objectives: data ?? [] })
}
