import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ draftId: string }> }
) {
  const { draftId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await supabase
    .from('mail_drafts')
    .update({ status: 'approved', approved_at: new Date().toISOString() })
    .eq('id', draftId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await supabase.from('mail_audit_log').insert({
    message_id: null,
    action: 'draft_approved',
    actor: 'user',
    detail: { draft_id: draftId },
    ai_confidence: 0,
  })

  const mailEngineUrl = process.env.MAIL_ENGINE_URL ?? 'http://localhost:3003'
  try {
    await fetch(`${mailEngineUrl}/approve-draft/${draftId}`, { method: 'POST' })
  } catch {
    // Non-fatal — mail engine handles async
  }

  return NextResponse.json({ status: 'approved' })
}
