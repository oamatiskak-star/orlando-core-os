import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const body = await req.json()

  const { channel_slug, dag_nr, views_actual, uploads_actual, breakout_detected, notes } = body

  if (!channel_slug || !dag_nr) {
    return NextResponse.json({ error: 'channel_slug en dag_nr vereist' }, { status: 400 })
  }

  const datum = new Date('2026-05-19')
  datum.setDate(datum.getDate() + dag_nr - 1)

  const { error } = await supabase
    .from('youtube_strategy_daily')
    .update({
      views_actual:       views_actual   ?? 0,
      uploads_actual:     uploads_actual ?? 0,
      breakout_detected:  breakout_detected ?? false,
      notes:              notes ?? null,
      updated_at:         new Date().toISOString(),
    })
    .eq('channel_slug', channel_slug)
    .eq('dag_nr', dag_nr)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
