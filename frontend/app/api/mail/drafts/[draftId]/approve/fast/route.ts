import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(
  request: NextRequest,
  { params }: { params: { draftId: string } }
) {
  const supabase = await createClient()

  try {
    // Get the draft
    const { data: draft, error: draftError } = await supabase
      .from('mail_drafts')
      .select('*')
      .eq('id', params.draftId)
      .single()

    if (draftError || !draft) {
      return NextResponse.json({ error: 'Draft not found' }, { status: 404 })
    }

    if (draft.status !== 'pending') {
      return NextResponse.json(
        { error: `Cannot approve draft with status: ${draft.status}` },
        { status: 400 }
      )
    }

    // Get the mail account for this draft's message
    const { data: message } = await supabase
      .from('mail_messages')
      .select('account_id, to_email')
      .eq('id', draft.message_id)
      .single()

    if (!message) {
      return NextResponse.json({ error: 'Source message not found' }, { status: 404 })
    }

    // Update draft to approved
    const { error: updateError } = await supabase
      .from('mail_drafts')
      .update({
        status: 'approved',
        approved_at: new Date().toISOString(),
      })
      .eq('id', params.draftId)

    if (updateError) {
      return NextResponse.json({ error: 'Failed to approve draft' }, { status: 500 })
    }

    // Log to audit trail
    await supabase.from('mail_audit_log').insert({
      message_id: draft.message_id,
      action: 'draft_fast_approved',
      actor: 'orlando',
      detail: {
        draft_id: params.draftId,
        to_email: draft.to_email,
        subject: draft.subject,
        approved_via: 'dashboard_widget',
      },
      ai_confidence: draft.ai_confidence,
    })

    return NextResponse.json(
      {
        success: true,
        message: 'Draft approved successfully',
        draft_id: params.draftId,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('Error approving draft:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
