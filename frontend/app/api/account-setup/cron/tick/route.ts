import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { reportHeartbeat } from '@/lib/watchdog/heartbeat'

/**
 * Account Setup Agent — Auto Reminder + Verlopen-verificatie engine (Fase 3).
 *
 * Vercel cron (zie vercel.json). Deterministisch, geen LLM:
 *  1. Reminder-engine: programma's met next_action_at <= now → open human-action
 *     (manual_review) aanmaken indien nog geen open actie; next_action_at wissen.
 *  2. Verlopen-verificatie: programma's in 'applied'/'pending' waarvan de
 *     statuscheck > 14 dagen oud is → human-action 'manual_review' aanmaken.
 *
 * LLM-zwaar werk (terms_analysis) draait in de local-agent runner, niet hier.
 */

export const revalidate = 0
export const maxDuration = 60

const STALE_DAYS = 14

type Prog = { id: string; name: string; next_action_at: string | null; account_status: string; last_status_check_at: string | null; created_at: string }

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const now = new Date()
  const nowIso = now.toISOString()
  const staleIso = new Date(now.getTime() - STALE_DAYS * 86_400_000).toISOString()

  let remindersCreated = 0
  let verificationsFlagged = 0

  try {
    // Programma's met open human-actions (om duplicaten te vermijden)
    const { data: openActions } = await admin
      .from('account_setup_human_actions')
      .select('program_id')
      .in('status', ['open', 'in_progress'])
    const hasOpen = new Set((openActions ?? []).map(a => a.program_id as string))

    // 1) Reminder-engine — next_action_at due
    const { data: dueRows } = await admin
      .from('affiliate_programs')
      .select('id, name, next_action_at, account_status, last_status_check_at, created_at')
      .not('next_action_at', 'is', null)
      .lte('next_action_at', nowIso)
      .limit(200)

    for (const p of (dueRows ?? []) as Prog[]) {
      if (!hasOpen.has(p.id)) {
        await admin.from('account_setup_human_actions').insert({
          program_id: p.id, action_kind: 'manual_review',
          title: `Follow-up: ${p.name}`,
          description: 'Reminder-engine: geplande vervolgactie is verlopen.',
          status: 'open',
        })
        hasOpen.add(p.id)
        remindersCreated++
        await admin.from('account_setup_audit_log').insert({
          program_id: p.id, action: 'reminder.created', actor: 'system', detail: { due_at: p.next_action_at },
        })
      }
      // next_action_at wissen zodat hij niet opnieuw vuurt (actie is nu de tracker)
      await admin.from('affiliate_programs').update({ next_action_at: null }).eq('id', p.id)
    }

    // 2) Verlopen-verificatie — applied/pending zonder recente statuscheck
    const { data: staleRows } = await admin
      .from('affiliate_programs')
      .select('id, name, next_action_at, account_status, last_status_check_at, created_at')
      .in('account_status', ['applied', 'pending'])
      .limit(500)

    for (const p of (staleRows ?? []) as Prog[]) {
      const ref = p.last_status_check_at ?? p.created_at
      if (ref >= staleIso) continue
      if (hasOpen.has(p.id)) continue
      await admin.from('account_setup_human_actions').insert({
        program_id: p.id, action_kind: 'manual_review',
        title: `Verificatie controleren: ${p.name}`,
        description: `Status '${p.account_status}' al >${STALE_DAYS} dagen zonder update — controleer of verificatie/aanmelding is verlopen.`,
        status: 'open',
      })
      hasOpen.add(p.id)
      verificationsFlagged++
      await admin.from('account_setup_audit_log').insert({
        program_id: p.id, action: 'verification.flagged_stale', actor: 'system',
        detail: { account_status: p.account_status, last_ref: ref },
      })
    }

    await reportHeartbeat('account-setup-cron-tick', { remindersCreated, verificationsFlagged }, 'ok')
    return NextResponse.json({ ok: true, remindersCreated, verificationsFlagged })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    await reportHeartbeat('account-setup-cron-tick', { error: msg }, 'error')
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
