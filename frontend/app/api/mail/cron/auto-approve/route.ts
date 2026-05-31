import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { engineWindowOpen } from '@/lib/engine/window'

export const revalidate = 0
export const maxDuration = 60

// Vercel cron — /api/mail/cron/auto-approve
// Zet openstaande mail-drafts automatisch op 'approved' (alles auto-goedkeuren,
// per beslissing Orlando). De mail-engine verstuurt approved drafts daarna.
// Planner-gestuurd: alleen binnen het 'mail_ops'-venster (/dashboard/planner) →
// daar uit te zetten. Beveiligd via Bearer CRON_SECRET.
const ENGINE_KEY = 'mail_ops:auto-approve'
const BATCH = 200

export async function GET(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!(await engineWindowOpen(ENGINE_KEY))) {
    return NextResponse.json({ ok: true, skipped: true, reason: 'buiten_planner_venster' })
  }

  const admin = createAdminClient()
  const nowIso = new Date().toISOString()

  const { data: pending, error } = await admin
    .from('mail_drafts')
    .select('id, message_id, to_email, subject, ai_confidence')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(BATCH)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!pending || pending.length === 0) {
    return NextResponse.json({ ok: true, approved: 0 })
  }

  const ids = pending.map((d) => d.id)
  const { error: upErr } = await admin
    .from('mail_drafts')
    .update({ status: 'approved', approved_at: nowIso })
    .in('id', ids)
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })

  // Audit per draft (actor = automation) zodat de herkomst traceerbaar blijft.
  await admin.from('mail_audit_log').insert(
    pending.map((d) => ({
      message_id: d.message_id,
      action: 'draft_auto_approved',
      actor: 'auto-approve-cron',
      detail: { draft_id: d.id, to_email: d.to_email, subject: d.subject, approved_via: 'planner_cron' },
      ai_confidence: d.ai_confidence,
    })),
  ).then(() => {}, () => {})

  await admin.rpc('log_to_hermes', {
    source: 'mail-auto-approve',
    level: 'info',
    event: 'mail.auto_approved',
    message: `${ids.length} mail-drafts automatisch goedgekeurd`,
    context: { count: ids.length },
  }).then(() => {}, () => {})

  return NextResponse.json({ ok: true, approved: ids.length })
}
