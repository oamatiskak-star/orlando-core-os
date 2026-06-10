import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const revalidate = 0

type Upload = { content_item_id: string; platform: string | null; status: string | null }

// pipeline-stage afleiden (observatie, geen blokkade)
function stageOf(contentStatus: string | null, scheduledAt: string | null, ups: Upload[]): string {
  const us = ups.map((u) => (u.status ?? '').toLowerCase())
  if (us.some((s) => s === 'verified_live')) return 'Verified Live'
  if (us.some((s) => ['uploaded', 'published', 'live'].includes(s))) return 'Uploaded'
  if (us.some((s) => ['uploading', 'processing', 'queued'].includes(s))) return 'Uploading'
  if (scheduledAt) return 'Scheduled'
  if ((contentStatus ?? '').toLowerCase() === 'ready') return 'Review Available'
  return 'Generated'
}

export async function GET(_req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [ciRes, upRes, chRes] = await Promise.all([
    supabase.from('media_holding_content_items')
      .select('id, title, hook, status, channel_id, scheduled_at, output_url, content_brief, created_at')
      .order('created_at', { ascending: false }).limit(200),
    supabase.from('media_holding_uploads').select('content_item_id, platform, status'),
    supabase.from('media_holding_channels').select('id, name'),
  ])

  const chName = new Map<string, string>()
  for (const c of chRes.data ?? []) chName.set(c.id, c.name)
  const upByItem = new Map<string, Upload[]>()
  for (const u of (upRes.data ?? []) as Upload[]) {
    if (!upByItem.has(u.content_item_id)) upByItem.set(u.content_item_id, [])
    upByItem.get(u.content_item_id)!.push(u)
  }

  // notities ophalen — degradeert als tabel 163 nog niet is toegepast
  let notesEnabled = true
  const notesByItem = new Map<string, { kind: string; note: string | null; created_at: string }[]>()
  const notesRes = await supabase.from('war_room_review_notes')
    .select('content_item_id, kind, note, created_at').order('created_at', { ascending: false }).limit(500)
  if (notesRes.error) {
    notesEnabled = false
  } else {
    for (const n of notesRes.data ?? []) {
      const k = n.content_item_id as string
      if (!k) continue
      if (!notesByItem.has(k)) notesByItem.set(k, [])
      notesByItem.get(k)!.push({ kind: n.kind, note: n.note, created_at: n.created_at })
    }
  }

  const items = (ciRes.data ?? []).map((c) => {
    const ups = upByItem.get(c.id) ?? []
    const cb = (c.content_brief ?? {}) as Record<string, unknown>
    return {
      id: c.id,
      title: c.title || (cb.titel as string) || c.hook || c.id.slice(0, 8),
      channel: c.channel_id ? (chName.get(c.channel_id) ?? null) : null,
      stage: stageOf(c.status, c.scheduled_at, ups),
      status: c.status,
      platforms: ups.map((u) => u.platform).filter(Boolean),
      thumbnail_concept: (cb.visual_prompt as string) ?? null,
      notes: notesByItem.get(c.id) ?? [],
    }
  })

  return NextResponse.json({ items, notesEnabled })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({})) as { content_item_id?: string; kind?: string; note?: string }
  if (!body.content_item_id) return NextResponse.json({ error: 'content_item_id ontbreekt' }, { status: 400 })
  const kind = ['comment', 'interesting', 'analyze'].includes(body.kind ?? '') ? body.kind! : 'comment'

  const { error } = await supabase.from('war_room_review_notes').insert({
    content_item_id: body.content_item_id,
    kind,
    note: body.note ?? null,
    created_by: user.email ?? user.id,
  })
  if (error) {
    // tabel nog niet toegepast (migratie 163) of andere fout
    return NextResponse.json({ error: error.message, code: error.code }, { status: 503 })
  }
  return NextResponse.json({ ok: true })
}
