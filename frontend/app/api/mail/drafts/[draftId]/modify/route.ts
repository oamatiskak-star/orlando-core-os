import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ draftId: string }> }
) {
  const { draftId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as { body?: string }
  if (!body.body) return NextResponse.json({ error: 'body required' }, { status: 400 })

  const { data: current } = await supabase
    .from('mail_drafts')
    .select('version, message_id')
    .eq('id', draftId)
    .single()

  const currentVersion = (current as { version: number; message_id: string | null } | null)?.version ?? 1

  const { error } = await supabase
    .from('mail_drafts')
    .update({
      body: body.body,
      version: currentVersion + 1,
      status: 'modified',
      updated_at: new Date().toISOString(),
    })
    .eq('id', draftId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await supabase.from('mail_audit_log').insert({
    message_id: (current as { version: number; message_id: string | null } | null)?.message_id ?? null,
    action: 'draft_modified',
    actor: 'user',
    detail: { draft_id: draftId, new_version: currentVersion + 1 },
    ai_confidence: 0,
  })

  return NextResponse.json({ status: 'modified', version: currentVersion + 1 })
}
