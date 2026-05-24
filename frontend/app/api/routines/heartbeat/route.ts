import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * POST /api/routines/heartbeat
 *
 * Externe runners (planning-engine, executive-engine, custom workers) kunnen via
 * deze endpoint heartbeats sturen + step-completion melden. De Mac mini routines-runner
 * gebruikt deze NIET (die schrijft direct via service-role) — dit is voor remote services.
 *
 * Auth: X-Routines-Token header moet match met env ROUTINES_TOKEN.
 *
 * Body:
 *   {
 *     run_id:    string (uuid)        — verplicht
 *     status:    'started'|'progress'|'completed'|'failed'|'heartbeat'
 *     step_id?:  string (uuid)        — optional, voor step-specifieke update
 *     output?:   jsonb                — bij completed
 *     error?:    jsonb                — bij failed
 *     service_id?: string             — override; default: derived from token
 *   }
 */
export const revalidate = 0

export async function POST(req: NextRequest) {
  const token = req.headers.get('x-routines-token') ?? ''
  if (!process.env.ROUTINES_TOKEN || token !== process.env.ROUTINES_TOKEN) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => null) as null | {
    run_id?: string
    step_id?: string
    status?: 'started' | 'progress' | 'completed' | 'failed' | 'heartbeat'
    output?: Record<string, unknown>
    error?: Record<string, unknown>
    service_id?: string
  }

  if (!body || !body.run_id || !body.status) {
    return NextResponse.json({ error: 'run_id en status zijn verplicht' }, { status: 400 })
  }

  const db = createAdminClient()
  const now = new Date().toISOString()
  const serviceId = body.service_id ?? 'remote-runner'

  // Update routine_run heartbeat altijd
  await db.from('routine_runs').update({
    heartbeat_at: now,
    service_id:   serviceId,
  }).eq('id', body.run_id)

  // Step-specifieke logica
  if (body.step_id) {
    if (body.status === 'started' || body.status === 'progress') {
      // Insert nieuwe step-row als er nog geen open is, anders update
      const { data: existing } = await db
        .from('routine_run_steps')
        .select('id')
        .eq('run_id', body.run_id)
        .eq('step_id', body.step_id)
        .is('ended_at', null)
        .maybeSingle()

      if (existing?.id) {
        await db.from('routine_run_steps').update({
          status: body.status,
          output: body.output ?? null,
        }).eq('id', existing.id)
      } else {
        await db.from('routine_run_steps').insert({
          run_id:  body.run_id,
          step_id: body.step_id,
          status:  body.status,
          output:  body.output ?? null,
        })
      }
    } else if (body.status === 'completed' || body.status === 'failed') {
      const { data: existing } = await db
        .from('routine_run_steps')
        .select('id')
        .eq('run_id', body.run_id)
        .eq('step_id', body.step_id)
        .is('ended_at', null)
        .maybeSingle()

      if (existing?.id) {
        await db.from('routine_run_steps').update({
          status:   body.status,
          ended_at: now,
          output:   body.output ?? null,
          error:    body.error ?? null,
        }).eq('id', existing.id)
      } else {
        await db.from('routine_run_steps').insert({
          run_id:   body.run_id,
          step_id:  body.step_id,
          status:   body.status,
          ended_at: now,
          output:   body.output ?? null,
          error:    body.error ?? null,
        })
      }
    }
  }

  // Run-level finalisatie
  if (body.status === 'completed' || body.status === 'failed') {
    await db.from('routine_runs').update({
      status:   body.status,
      ended_at: now,
      error:    body.status === 'failed' ? (body.error ?? null) : null,
    }).eq('id', body.run_id)

    await db.from('routine_audit_log').insert({
      run_id: body.run_id,
      action: body.status === 'completed' ? 'run.completed_remote' : 'run.failed_remote',
      actor:  'system',
      detail: { service_id: serviceId, step_id: body.step_id ?? null },
    })
  }

  return NextResponse.json({ ok: true, run_id: body.run_id, at: now })
}
