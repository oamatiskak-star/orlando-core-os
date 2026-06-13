import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { reportHeartbeat } from '@/lib/watchdog/heartbeat'

/**
 * Autonome Affiliate revenue-sync scheduler (S14, Engine Planner: media:affiliate-revenue-sync).
 *
 * Sluit het laatste software-gat in revenue-ingest: er was geen autonome trigger voor
 * `revenue_sync`-runs. Deze Vercel-cron (zie vercel.json, 06:15 UTC binnen het 'youtube'-blok):
 *  1. Enqueued per affiliate_program met een ACTIEVE connector een `revenue_sync`-run
 *     (de local-agent handleRevenueSync haalt vervolgens de omzet op via de connector).
 *     Idempotent: slaat over als er al een open/lopende revenue_sync-run voor dat programma is.
 *  2. Maakt actieve (omzetdragende) programma's ZONDER actieve connector zichtbaar als MANUAL
 *     (account_setup_human_actions) — de extern-geblokkeerde stap (connector + credentials).
 *
 * VEILIG/ADDITIEF: raakt monetization_streams, de revenue->allocatie-keten (211_s13) of
 * bestaande triggers NIET. Engine-Planner-conform (geen losse interval-job).
 */
export const revalidate = 0
export const maxDuration = 60

const ENGINE_KEY = 'media:affiliate-revenue-sync'
const REVENUE_STATUSES = ['active', 'payout_active']
const MANUAL_SOURCE = 'revenue_sync_connector_missing'

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const isDev = process.env.NODE_ENV === 'development'
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && !isDev) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const force = req.nextUrl.searchParams.get('force') === '1'

  let enqueued = 0
  let manualFlagged = 0
  let connectors = 0

  try {
    // Engine-Planner-venster: buiten het blok niet draaien (tenzij dev of ?force=1).
    if (!isDev && !force) {
      const { data: open } = await admin.rpc('engine_window_open', { p_engine_key: ENGINE_KEY })
      if (open === false) {
        await reportHeartbeat('affiliate-revenue-sync', { skipped: 'window_closed' }, 'ok')
        return NextResponse.json({ ok: true, skipped: 'window_closed', enqueued, manualFlagged })
      }
    }

    // Bronnen in één keer ophalen.
    const [enabledConns, activeRuns, openActions, activePrograms] = await Promise.all([
      admin.from('affiliate_api_connectors').select('program_id').eq('enabled', true),
      admin.from('account_setup_runs').select('program_id').eq('run_kind', 'revenue_sync').in('status', ['queued', 'running']),
      admin.from('account_setup_human_actions').select('program_id, metadata').in('status', ['open', 'in_progress']),
      admin.from('affiliate_programs').select('id, name').in('account_status', REVENUE_STATUSES),
    ])

    const connectorProgramIds = new Set((enabledConns.data ?? []).map(c => c.program_id as string).filter(Boolean))
    connectors = connectorProgramIds.size
    const runningFor = new Set((activeRuns.data ?? []).map(r => r.program_id as string).filter(Boolean))
    const manualOpenFor = new Set(
      (openActions.data ?? [])
        .filter(a => (a.metadata as Record<string, unknown> | null)?.['source'] === MANUAL_SOURCE)
        .map(a => a.program_id as string),
    )

    // 1) Per programma met actieve connector: enqueue revenue_sync (idempotent).
    for (const programId of connectorProgramIds) {
      if (runningFor.has(programId)) continue
      const { data: run } = await admin
        .from('account_setup_runs')
        .insert({ program_id: programId, run_kind: 'revenue_sync', status: 'queued', trigger_kind: 'cron', payload: { stage: 'scheduled' } })
        .select('id')
        .single()
      enqueued++
      await admin.from('account_setup_audit_log').insert({
        program_id: programId, run_id: run?.id ?? null, action: 'revenue_sync.scheduled', actor: 'system', detail: { engine: ENGINE_KEY },
      })
    }

    // 2) Actieve programma's zonder actieve connector → MANUAL (connector/credentials ontbreken).
    for (const p of (activePrograms.data ?? []) as { id: string; name: string }[]) {
      if (connectorProgramIds.has(p.id)) continue
      if (manualOpenFor.has(p.id)) continue
      await admin.from('account_setup_human_actions').insert({
        program_id: p.id, action_kind: 'manual_review',
        title: `Revenue-connector ontbreekt: ${p.name}`,
        description: 'Programma is actief maar heeft geen actieve API-connector. Voeg endpoint + credentials toe (payouts-tab) zodat omzet automatisch wordt opgehaald.',
        status: 'open', metadata: { source: MANUAL_SOURCE, program: p.name },
      })
      manualFlagged++
      await admin.from('account_setup_audit_log').insert({
        program_id: p.id, action: 'revenue_sync.connector_missing', actor: 'system', detail: { source: MANUAL_SOURCE },
      })
    }

    await reportHeartbeat('affiliate-revenue-sync', { enqueued, manualFlagged, connectors }, 'ok')
    return NextResponse.json({ ok: true, enqueued, manualFlagged, connectors })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    await reportHeartbeat('affiliate-revenue-sync', { error: msg }, 'error')
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
