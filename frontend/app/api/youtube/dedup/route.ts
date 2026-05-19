import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

// Normalize title voor vergelijking: lowercase, verwijder leestekens, meerdere spaties
function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[\[\](){}#@!?.,;:'"\/\\|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// Levenshtein distance voor fuzzy matching
function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)])
  for (let j = 0; j <= n; j++) dp[0][j] = j
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i-1] === b[j-1]
        ? dp[i-1][j-1]
        : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1])
    }
  }
  return dp[m][n]
}

function isSimilar(a: string, b: string, threshold = 0.85): boolean {
  const na = normalizeTitle(a)
  const nb = normalizeTitle(b)
  if (na === nb) return true
  const maxLen = Math.max(na.length, nb.length)
  if (maxLen === 0) return true
  const dist = levenshtein(na, nb)
  return (1 - dist / maxLen) >= threshold
}

type QueueRow = {
  id: string
  channel_id: string
  title: string
  status: string
  youtube_video_id: string | null
  scheduled_publish_at: string | null
  created_at: string
  updated_at: string
}

type DedupResult = {
  channel_id: string
  duplicate_group: string[]   // ids
  kept: string                // id
  archived: string[]          // ids
  titles: string[]
  reason: string
}

export async function POST() {
  const admin = createAdminClient()

  // Haal alle verified_live entries op
  const { data: liveRows, error } = await admin
    .from('youtube_upload_queue')
    .select('id, channel_id, title, status, youtube_video_id, scheduled_publish_at, created_at, updated_at')
    .eq('status', 'verified_live')
    .order('updated_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!liveRows?.length) return NextResponse.json({ ok: true, duplicates: 0, results: [] })

  const rows = liveRows as QueueRow[]
  const results: DedupResult[] = []
  const processedIds = new Set<string>()

  // Groepeer per kanaal
  const byChannel: Record<string, QueueRow[]> = {}
  for (const row of rows) {
    if (!byChannel[row.channel_id]) byChannel[row.channel_id] = []
    byChannel[row.channel_id].push(row)
  }

  for (const [channelId, channelRows] of Object.entries(byChannel)) {
    for (let i = 0; i < channelRows.length; i++) {
      const a = channelRows[i]
      if (processedIds.has(a.id)) continue

      const group: QueueRow[] = [a]

      for (let j = i + 1; j < channelRows.length; j++) {
        const b = channelRows[j]
        if (processedIds.has(b.id)) continue
        if (isSimilar(a.title, b.title)) {
          group.push(b)
        }
      }

      // Ook controleren op zelfde youtube_video_id (harde duplicate)
      if (a.youtube_video_id) {
        for (const b of channelRows) {
          if (b.id === a.id || processedIds.has(b.id)) continue
          if (b.youtube_video_id === a.youtube_video_id && !group.find(g => g.id === b.id)) {
            group.push(b)
          }
        }
      }

      if (group.length < 2) continue // geen duplicaat

      // Kies de te bewaren entry:
      // 1. Voorkeur: heeft youtube_video_id (echte live video)
      // 2. Daarna: meest recente updated_at
      const sorted = [...group].sort((x, y) => {
        const xHasId = x.youtube_video_id ? 1 : 0
        const yHasId = y.youtube_video_id ? 1 : 0
        if (xHasId !== yHasId) return yHasId - xHasId
        return new Date(y.updated_at).getTime() - new Date(x.updated_at).getTime()
      })

      const kept     = sorted[0]
      const archived = sorted.slice(1)

      for (const dup of group) processedIds.add(dup.id)

      // Archiveer duplicaten — zet status op 'duplicate_archived'
      const archiveIds = archived.map(d => d.id)
      await admin
        .from('youtube_upload_queue')
        .update({
          status:     'duplicate_archived',
          last_error: `Duplicaat van ${kept.id} (titel: "${kept.title}")`,
          updated_at: new Date().toISOString(),
        })
        .in('id', archiveIds)

      results.push({
        channel_id:      channelId,
        duplicate_group: group.map(g => g.id),
        kept:            kept.id,
        archived:        archiveIds,
        titles:          group.map(g => g.title),
        reason:          kept.youtube_video_id ? 'heeft youtube_video_id' : 'meest recent',
      })
    }
  }

  // Log dedup run
  await admin.from('youtube_dedup_log').upsert({
    run_at:          new Date().toISOString(),
    live_checked:    rows.length,
    duplicates_found: results.length,
    archived_count:  results.reduce((s, r) => s + r.archived.length, 0),
    details:         results,
  }, { onConflict: 'run_at', ignoreDuplicates: false }) // log tabel optioneel

  return NextResponse.json({
    ok:              true,
    live_checked:    rows.length,
    duplicates_found: results.length,
    archived:        results.reduce((s, r) => s + r.archived.length, 0),
    results,
  })
}

// GET — handmatige check zonder archiveren (preview)
export async function GET() {
  const admin = createAdminClient()

  const { data: liveRows } = await admin
    .from('youtube_upload_queue')
    .select('id, channel_id, title, status, youtube_video_id, updated_at')
    .eq('status', 'verified_live')
    .order('updated_at', { ascending: false })

  if (!liveRows?.length) return NextResponse.json({ duplicates: 0, groups: [] })

  const rows = liveRows as QueueRow[]
  const groups: { ids: string[]; titles: string[]; channel_id: string }[] = []
  const seen = new Set<string>()

  const byChannel: Record<string, QueueRow[]> = {}
  for (const row of rows) {
    if (!byChannel[row.channel_id]) byChannel[row.channel_id] = []
    byChannel[row.channel_id].push(row)
  }

  for (const [channelId, channelRows] of Object.entries(byChannel)) {
    for (let i = 0; i < channelRows.length; i++) {
      const a = channelRows[i]
      if (seen.has(a.id)) continue
      const group: QueueRow[] = [a]
      for (let j = i + 1; j < channelRows.length; j++) {
        const b = channelRows[j]
        if (seen.has(b.id)) continue
        if (isSimilar(a.title, b.title) || (a.youtube_video_id && a.youtube_video_id === b.youtube_video_id)) {
          group.push(b)
        }
      }
      if (group.length >= 2) {
        for (const g of group) seen.add(g.id)
        groups.push({ channel_id: channelId, ids: group.map(g => g.id), titles: group.map(g => g.title) })
      }
    }
  }

  return NextResponse.json({ duplicates: groups.length, live_checked: rows.length, groups })
}
