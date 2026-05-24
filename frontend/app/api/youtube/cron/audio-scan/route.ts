import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { fetchMostPopular, viewVelocity } from '@/lib/youtube-public'
import { reportHeartbeat } from '@/lib/watchdog/heartbeat'

export const revalidate = 0
export const maxDuration = 60

// Vercel cron — /api/youtube/cron/audio-scan
// Schedule: zie vercel.json.
// Beveiligd via Bearer CRON_SECRET.
//
// YT mostPopular Music chart (videoCategoryId=10) NL/US/GB.
// Upsert in audio_library — trending sounds bron voor content factory.
//
// Quota: 1 unit × 3 regions = 3 units/run.

// Splitst YT music title "Artist - Track (Official Video)" → { artist, track }.
function parseTitle(rawTitle: string, channelTitle: string): { name: string; artist: string } {
  const title = rawTitle.replace(/\s*\((official|music|lyrics?|audio|video|hd|4k|visualizer|live).*?\)\s*$/i, '').trim()
  const dashSplit = title.split(/\s+[-–—]\s+/, 2)
  if (dashSplit.length === 2 && dashSplit[0].length > 0 && dashSplit[1].length > 0) {
    return { artist: dashSplit[0].trim(), name: dashSplit[1].trim() }
  }
  // Fallback: channel name → artist, full title → name (strip VEVO)
  const artist = channelTitle.replace(/\s*VEVO\s*$/i, '').trim() || channelTitle
  return { artist, name: title }
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const regions = (process.env.CRON_AUDIO_SCAN_REGIONS ?? 'NL,US,GB')
    .split(',').map((s) => s.trim()).filter(Boolean)
  const maxPerRegion = Number(process.env.CRON_AUDIO_SCAN_MAX_PER_REGION ?? '50')

  const startedAt = Date.now()
  const admin = createAdminClient()
  const errors: Record<string, string> = {}
  const allRows: Record<string, unknown>[] = []

  for (const region of regions) {
    try {
      const videos = await fetchMostPopular(region, maxPerRegion, '10') // 10 = Music
      for (const v of videos) {
        const { name, artist } = parseTitle(v.title, v.channelTitle)
        allRows.push({
          platform:          'youtube',
          external_audio_id: v.id,
          name,
          artist,
          trend_velocity:    viewVelocity(v),
          use_count:         v.views,
          captured_at:       new Date().toISOString(),
        })
      }
    } catch (err) {
      errors[region] = (err as Error).message
    }
  }

  // Dedup binnen deze run op external_audio_id (zelfde track in meerdere regions)
  const dedupMap = new Map<string, Record<string, unknown>>()
  for (const row of allRows) {
    const key = `${row.platform}:${row.external_audio_id}`
    const existing = dedupMap.get(key)
    if (!existing || Number(row.trend_velocity) > Number(existing.trend_velocity)) {
      dedupMap.set(key, row)
    }
  }
  const deduped = [...dedupMap.values()]

  let upserted = 0
  if (deduped.length > 0) {
    const chunkSize = 100
    for (let i = 0; i < deduped.length; i += chunkSize) {
      const chunk = deduped.slice(i, i + chunkSize)
      const { error } = await admin
        .from('audio_library')
        .upsert(chunk, { onConflict: 'platform,external_audio_id' })
      if (error) errors[`upsert_chunk_${i}`] = error.message
      else upserted += chunk.length
    }
  }

  await reportHeartbeat('cron.vercel.audio-scan').catch(() => {}) /* watchdog-heartbeat */

  return NextResponse.json({
    ok: Object.keys(errors).length === 0,
    regions,
    fetched: allRows.length,
    deduped: deduped.length,
    upserted,
    errors: Object.keys(errors).length > 0 ? errors : undefined,
    duration_ms: Date.now() - startedAt,
  })
}
