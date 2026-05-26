import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * POST /api/routines/webhook/[secret]
 *
 * Externe triggers (n8n, GitHub Actions, Stripe, etc.) kunnen via deze endpoint
 * een routine_run enqueuen. De `secret` in de URL wordt SHA-256-gehashed en
 * vergeleken met `routine_triggers.config.secret_hash` voor enabled webhook-triggers.
 *
 * Body wordt als-is opgeslagen in routine_runs.trigger_payload.
 */
export const revalidate = 0

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ secret: string }> }) {
  const { secret } = await ctx.params
  if (!secret) {
    return NextResponse.json({ error: 'secret ontbreekt in URL' }, { status: 400 })
  }

  const secretHash = sha256(secret)
  const db = createAdminClient()

  const { data: trigger } = await db
    .from('routine_triggers')
    .select('id, routine_id, enabled, config, routines:routine_id(status)')
    .eq('kind', 'webhook')
    .eq('enabled', true)
    .eq('config->>secret_hash', secretHash)
    .maybeSingle()

  if (!trigger) {
    // Voorkom timing-attacks: dummy delay
    await new Promise(r => setTimeout(r, 200))
    return NextResponse.json({ error: 'Unknown or disabled webhook' }, { status: 404 })
  }

  const routineStatus = (trigger as { routines?: { status?: string } | null }).routines?.status
  if (routineStatus !== 'active') {
    return NextResponse.json({ error: `Routine status='${routineStatus}', cannot trigger` }, { status: 409 })
  }

  const payload = await req.json().catch(() => ({}))

  const { data: run, error } = await db
    .from('routine_runs')
    .insert({
      routine_id:      trigger.routine_id,
      status:          'queued',
      trigger_kind:    'webhook',
      trigger_payload: {
        trigger_id: trigger.id,
        source:     'http_webhook',
        ip:         req.headers.get('x-forwarded-for') ?? null,
        body:       payload,
      },
    })
    .select('id')
    .single()

  if (error || !run) {
    return NextResponse.json({ error: error?.message ?? 'Enqueue mislukt' }, { status: 500 })
  }

  await db.from('routine_triggers').update({ last_run_at: new Date().toISOString() }).eq('id', trigger.id)
  await db.from('routine_audit_log').insert({
    routine_id: trigger.routine_id,
    run_id:     run.id,
    action:     'run.enqueued_webhook',
    actor:      'system',
    detail:     { trigger_id: trigger.id, ip: req.headers.get('x-forwarded-for') ?? null },
  })

  return NextResponse.json({ ok: true, run_id: run.id, routine_id: trigger.routine_id })
}
