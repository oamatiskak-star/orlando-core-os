import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const revalidate = 0

// Enqueue "Maak N variaties" op een winnende structuur. Consument = CF2 (gated).
// Geen productie/spend hier — alleen een aanvraag wegschrijven.
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const b = await req.json().catch(() => ({})) as {
    source_video_id?: string; title?: string; niche?: string; category?: string
    structure?: Record<string, unknown>; count?: number
  }
  if (!b.source_video_id) return NextResponse.json({ error: 'source_video_id ontbreekt' }, { status: 400 })

  const { error } = await supabase.from('variation_requests').insert({
    source_video_id: b.source_video_id,
    title: b.title ?? null,
    niche: b.niche ?? null,
    category: b.category ?? null,
    structure: b.structure ?? {},
    count: Math.min(200, Math.max(1, b.count ?? 50)),
    requested_by: user.email ?? user.id,
  })
  if (error) return NextResponse.json({ error: error.message, code: error.code }, { status: 503 })
  return NextResponse.json({ ok: true })
}
