import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

// GET — huidige canonieke trackerstaat (document + items).
export async function GET() {
  const admin = createAdminClient()

  const { data: doc, error: docErr } = await admin
    .from('build_tracker_documents')
    .select('id, source_file, source_repo, source_branch, source_commit, checksum, synced_by, synced_at')
    .eq('is_current', true)
    .eq('scope', 'cross-project')
    .order('synced_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (docErr) return NextResponse.json({ error: docErr.message }, { status: 500 })
  if (!doc) return NextResponse.json({ document: null, items: [] })

  const { data: items, error: itErr } = await admin
    .from('build_tracker_items')
    .select('id, section, item_rank, title, detail, status_tag, blocker_code, owner, repo, route, evidence, deploy_allowed')
    .eq('document_id', doc.id)
    .order('section', { ascending: true })
    .order('item_rank', { ascending: true })

  if (itErr) return NextResponse.json({ error: itErr.message }, { status: 500 })
  return NextResponse.json({ document: doc, items: items ?? [] })
}

// POST — "sync aanvragen": enqueue een dispatch-taak voor de host (CLI draait `npm run sync:tracker`).
// De parse zelf draait op de host (Vercel kan de repo-checkout niet lezen).
export async function POST() {
  const admin = createAdminClient()
  const { data, error } = await admin
    .schema('hermes')
    .from('dispatch_queue')
    .insert({
      title: 'BUILD_TRACKER.md sync',
      workstream: 'tracker-sync',
      repo: 'orlando-core-os',
      target_host: 'cli-l',
      priority: 4,
      payload: { cmd: 'cd ~/Code/orlando-core-os/local-agent && npm run sync:tracker', reason: 'dashboard sync-aanvraag' },
    })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, dispatch_id: data.id })
}
