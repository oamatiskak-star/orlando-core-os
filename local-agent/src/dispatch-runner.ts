/**
 * Dispatch Runner — Hermes CLI-L/CLI-R werkverdeling (P5.1).
 *
 * Per host (cli-l / cli-r) een PM2-service die de hermes.dispatch_queue gezond houdt:
 *   1. Host-heartbeat   → hermes.hosts.last_seen_at (liveness op het dashboard).
 *   2. Stale-reaper     → claimed/running zonder heartbeat > STALE_MS → terug naar 'queued'
 *                          (werk dat vastloopt keert terug in de pool).
 *   3. Run-heartbeat    → heartbeat_at op 'running'-taken van deze host.
 *   4. Surface          → logt hoeveel werk er voor deze host klaarstaat (queued / claimed).
 *
 * BELANGRIJK (no-mock, eerlijk): deze runner voert GEEN Claude-werk autonoom uit.
 * Het uitvoeren van een taak is een Claude Code-sessie op die host; de runner
 * verdeelt/bewaakt alleen. Claimen gebeurt via het /operations/dispatch-bord of
 * via hermes.dispatch_claim() wanneer een sessie werk oppakt.
 *
 * Degradeert netjes: bestaat hermes.dispatch_queue niet (migratie 110 niet toegepast),
 * dan logt het dat één keer en blijft idle pollen zonder te crashen.
 */

import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL              = process.env.SUPABASE_URL!
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const HOST_ID                   = process.env.DISPATCH_HOST_ID ?? process.env.WATCHDOG_HOST_ID ?? 'cli-l'
const POLL_INTERVAL_MS          = parseInt(process.env.DISPATCH_POLL_INTERVAL_MS ?? '15000')
const STALE_MS                  = parseInt(process.env.DISPATCH_STALE_MS ?? '900000') // 15 min

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Dispatch runner: SUPABASE_URL en SUPABASE_SERVICE_ROLE_KEY zijn verplicht.')
  process.exit(1)
}

const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const hermes = () => db.schema('hermes')

function log(msg: string, ...args: unknown[]) {
  console.log(`[${new Date().toISOString()}] [dispatch:${HOST_ID}] ${msg}`, ...args)
}

let warnedMissing = false
let warnedNoConflictFn = false

type ConflictRow = { item_id: string; title: string; detail: string | null; match_pattern: string | null; source_commit: string | null }

/**
 * BUILD_TRACKER sectie-D gate (flag-and-confirm). Voor queued taken van deze host:
 * check tegen hermes.tracker_conflict_check(); bij een match → taak NIET stil laten
 * lopen maar op 'blocked' zetten + loggen in hermes.decisions. Mens heft op na review.
 * Standaard 0 hits (sectie-D items hebben pas een match_pattern na curatie) → veilig.
 */
async function checkTrackerConflicts(): Promise<void> {
  const { data: tasks, error } = await hermes()
    .from('dispatch_queue')
    .select('id, title, workstream, repo')
    .in('target_host', [HOST_ID, 'any'])
    .eq('status', 'queued')
    .limit(25)
  if (error || !tasks?.length) return

  for (const t of tasks as Array<{ id: string; title: string; workstream: string | null; repo: string | null }>) {
    const res = await hermes().rpc('tracker_conflict_check', {
      p_title: t.title, p_workstream: t.workstream, p_repo: t.repo,
    })
    if (res.error) {
      if (!warnedNoConflictFn) {
        warnedNoConflictFn = true
        log('hermes.tracker_conflict_check niet beschikbaar — migratie 155 nog niet toegepast? Gate uit tot dan.', res.error.message)
      }
      return
    }
    const conflicts = (res.data ?? []) as ConflictRow[]
    if (!conflicts.length) continue

    const reason = `BUILD_TRACKER sectie D (niet-opnieuw-doen): ${conflicts.map((c) => c.title).join('; ')}`
    await hermes().from('dispatch_queue').update({
      status: 'blocked',
      result: { tracker_conflict: conflicts, blocked_by: 'build_tracker_section_d' },
    }).eq('id', t.id).eq('status', 'queued')

    await hermes().from('decisions').insert({
      kind: 'tracker_conflict',
      subject: t.title,
      decision: 'blocked-pending-review',
      reason,
      alternatives: conflicts,
      outcome: 'pending',
    })
    log(`tracker-gate: taak "${t.title}" geblokkeerd (sectie D) — ${conflicts.length} match(es), wacht op review`)
  }
}

async function tick(): Promise<void> {
  const nowIso = new Date().toISOString()
  const staleIso = new Date(Date.now() - STALE_MS).toISOString()

  // 1. Host-heartbeat
  const hb = await hermes().from('hosts').update({ last_seen_at: nowIso }).eq('host_id', HOST_ID)
  if (hb.error) {
    if (!warnedMissing) {
      warnedMissing = true
      log('hermes.hosts niet bereikbaar — migratie 110 nog niet toegepast? Idle tot dan.', hb.error.message)
    }
    return
  }
  warnedMissing = false

  // 2. Stale-reaper: vastgelopen claimed/running van deze host terug naar de pool
  const reaped = await hermes()
    .from('dispatch_queue')
    .update({ status: 'queued', claimed_by: null, claimed_at: null })
    .eq('claimed_by', HOST_ID)
    .in('status', ['claimed', 'running'])
    .lt('heartbeat_at', staleIso)
    .select('id')
  if (reaped.data && reaped.data.length > 0) {
    log(`stale-reaper: ${reaped.data.length} taak(en) teruggezet naar queued`)
  }

  // 3. Run-heartbeat op actieve taken van deze host
  await hermes()
    .from('dispatch_queue')
    .update({ heartbeat_at: nowIso })
    .eq('claimed_by', HOST_ID)
    .eq('status', 'running')

  // 4. Surface: wat staat er klaar voor deze host?
  const queued = await hermes()
    .from('dispatch_queue')
    .select('id', { count: 'exact', head: true })
    .in('target_host', [HOST_ID, 'any'])
    .eq('status', 'queued')
  const claimed = await hermes()
    .from('dispatch_queue')
    .select('id', { count: 'exact', head: true })
    .eq('claimed_by', HOST_ID)
    .in('status', ['claimed', 'running'])

  const q = queued.count ?? 0
  const c = claimed.count ?? 0
  if (q > 0 || c > 0) log(`werk voor ${HOST_ID}: ${q} queued · ${c} in behandeling`)

  // 5. BUILD_TRACKER sectie-D gate (flag-and-confirm)
  await checkTrackerConflicts()
}

async function main(): Promise<void> {
  log(`gestart — poll elke ${POLL_INTERVAL_MS}ms, stale na ${STALE_MS}ms`)
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      await tick()
    } catch (err) {
      log('tick-fout:', err instanceof Error ? err.message : err)
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS))
  }
}

void main()
