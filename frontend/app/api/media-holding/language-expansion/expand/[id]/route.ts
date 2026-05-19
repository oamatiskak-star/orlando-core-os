import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const revalidate = 0

const ALL_LANGS = ['en','es','de','fr','pt','ar'] as const
type Lang = typeof ALL_LANGS[number]

// POST /api/media-holding/language-expansion/expand/[id]
// [id] = source media_holding_content_items.id
// Body: { target_langs?: Lang[], channel_id?: string }
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: sourceId } = await ctx.params
  const body = await req.json().catch(() => ({}))

  const targetLangs: Lang[] = Array.isArray(body.target_langs) && body.target_langs.length > 0
    ? (body.target_langs as string[]).filter((l): l is Lang => (ALL_LANGS as readonly string[]).includes(l))
    : [...ALL_LANGS]

  if (targetLangs.length === 0) {
    return NextResponse.json({ error: 'geen geldige target_langs' }, { status: 400 })
  }

  const { data: source, error: sourceErr } = await supabase
    .from('media_holding_content_items')
    .select('id, title, channel_id')
    .eq('id', sourceId)
    .single()
  if (sourceErr || !source) {
    return NextResponse.json({ error: `content_item niet gevonden: ${sourceErr?.message ?? 'no row'}` }, { status: 404 })
  }

  const { data, error } = await supabase
    .from('orchestrator_tasks')
    .insert({
      company_id: 'modiwerijo',
      title: `Language Expansion — ${targetLangs.length} talen — ${source.title?.slice(0, 40) ?? ''}`,
      task_type: 'language_expand',
      executor: 'language_expander',
      allowed_actions: ['*'],
      priority: 4,
      status: 'open',
      objective: [`Fan-out viral winnaar naar ${targetLangs.length} talen: ${targetLangs.join(', ')}.`],
      payload: {
        source_content_item_id: sourceId,
        target_langs: targetLangs,
        channel_id: body.channel_id ?? source.channel_id ?? null,
        persona: 'Atlas',
      },
    })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({
    task_id: data.id,
    source_content_item_id: sourceId,
    target_langs: targetLangs,
  }, { status: 202 })
}
