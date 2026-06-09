import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCanonicalSnapshot } from '@/lib/canonical-tracker'

export const dynamic = 'force-dynamic'

// POST /api/build-tracker/refresh-canonical
// Read/sync-only: leest de huidige canonieke DB-staat (tellingen + conflicts),
// enqueuet een CLI-L re-parse van BUILD_TRACKER.md (de echte parse draait file-based
// op de host), schrijft een sync-log-rij en — optioneel — herberekent de dagprioriteit.
// GEEN build, GEEN deploy.
export async function POST(req: Request) {
  const admin = createAdminClient()

  let recomputePriorities = false
  try {
    const body = await req.json()
    recomputePriorities = body?.recompute_priorities === true
  } catch {
    /* lege body is prima */
  }

  // 1. Huidige canonieke staat + tellingen (cross-project, ongescopet).
  const snap = await getCanonicalSnapshot(admin, [])
  const documents_count = snap.document ? snap.counts.documents_count : 0
  const items_count = snap.counts.items_count
  const conflicts_count = snap.counts.conflicts_count
  const synced_at = snap.document?.synced_at ?? null
  const docId = snap.document?.id ?? null

  // 2. updated_count: huidig document afwijkend t.o.v. laatste log → nieuw doc geïngest.
  let updated_count = 0
  try {
    const { data: lastLog } = await admin
      .schema('hermes')
      .from('tracker_sync_log')
      .select('document_id')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    const lastDocId = (lastLog as { document_id: string | null } | null)?.document_id ?? null
    if (docId && docId !== lastDocId) updated_count = items_count
  } catch {
    /* tabel mist (mig 158 nog niet toegepast) — laat 0 staan */
  }

  // 3. Enqueue CLI-L re-parse (idempotent: hergebruik bestaande queued tracker-sync).
  let dispatch_id: string | null = null
  try {
    const { data: existing } = await admin
      .schema('hermes')
      .from('dispatch_queue')
      .select('id')
      .eq('status', 'queued')
      .eq('workstream', 'tracker-sync')
      .limit(1)
      .maybeSingle()

    if (existing) {
      dispatch_id = (existing as { id: string }).id
    } else {
      const { data: ins, error: insErr } = await admin
        .schema('hermes')
        .from('dispatch_queue')
        .insert({
          title: 'BUILD_TRACKER.md canonieke sync',
          workstream: 'tracker-sync',
          repo: 'orlando-core-os',
          target_host: 'cli-l',
          priority: 4,
          payload: { cmd: 'cd ~/Code/orlando-core-os/local-agent && npm run sync:tracker', reason: 'dashboard refresh-knop' },
        })
        .select('id')
        .single()
      if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 })
      dispatch_id = (ins as { id: string }).id
    }
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'dispatch mislukt' }, { status: 500 })
  }

  // 4. Sync-log-rij (best-effort).
  try {
    await admin.schema('hermes').from('tracker_sync_log').insert({
      trigger: 'manual',
      document_id: docId,
      documents_count,
      items_count,
      updated_count,
      conflicts_count,
      status: 'dispatched',
      detail: { dispatch_id, source_commit: snap.document?.source_commit ?? null },
    })
  } catch {
    /* mig 158 nog niet toegepast — log overslaan */
  }

  // 5. Optioneel: dagprioriteit herberekenen.
  let priorities_count: number | null = null
  if (recomputePriorities) {
    try {
      const { data, error } = await admin.schema('hermes').rpc('generate_daily_priority_order')
      if (!error && typeof data === 'number') priorities_count = data
    } catch {
      /* mig 159 nog niet toegepast — stil */
    }
  }

  return NextResponse.json({
    status: snap.document ? 'ok' : 'no-canonical-document',
    synced_at,
    documents_count,
    items_count,
    updated_count,
    conflicts_count,
    dispatch_id,
    priorities_count,
  })
}
