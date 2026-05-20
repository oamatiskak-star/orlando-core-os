import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  fetchMostPopular, viewVelocity, virailityScore, automationScore,
} from '@/lib/youtube-public'

export const revalidate = 0
export const maxDuration = 60

// Vercel cron — /api/youtube/cron/viral-scan
// Schedule: zie vercel.json (elke 4 uur).
// Beveiligd via Bearer CRON_SECRET.
//
// Voert DIRECT de YT Data API call uit (geen orchestrator_task tussenstap).
// Upsert in viral_opportunities — Vortex' kandidaten-feed.
//
// Quota: 1 unit per region × 3 regions = 3 units/run × 6 runs/dag = 18 units/dag.
// Ruim binnen 10k/dag quota.
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const regions = (process.env.CRON_VIRAL_SCAN_REGIONS ?? 'NL,US,GB')
    .split(',').map((s) => s.trim()).filter(Boolean)
  const maxPerRegion = Number(process.env.CRON_VIRAL_SCAN_MAX_PER_REGION ?? '50')

  const startedAt = Date.now()
  const admin = createAdminClient()

  const allRows: Record<string, unknown>[] = []
  const errors: Record<string, string> = {}

  for (const region of regions) {
    try {
      const videos = await fetchMostPopular(region, maxPerRegion)
      for (const v of videos) {
        const velocity = viewVelocity(v)
        allRows.push({
          source_platform:     'youtube',
          external_id:         v.id,
          title:               v.title.slice(0, 1000),
          url:                 `https://www.youtube.com/watch?v=${v.id}`,
          thumbnail_url:       v.thumbnailUrl,
          channel_name:        v.channelTitle,
          channel_external_id: v.channelId,
          niche:               v.categoryId ? `youtube_cat_${v.categoryId}` : null,
          language:            v.defaultAudioLanguage ?? v.defaultLanguage ?? null,
          duration_seconds:    v.durationSeconds,
          published_at:        v.publishedAt,
          views:               v.views,
          likes:               v.likes,
          comments:            v.comments,
          view_velocity:       velocity,
          retention_score:     0,
          saturation_score:    50,
          automation_score:    automationScore(v.durationSeconds, v.categoryId),
          virality_score:      virailityScore(velocity),
          revenue_potential:   0,
          raw_payload:         { region, fetched_at: new Date().toISOString() },
          updated_at:          new Date().toISOString(),
        })
      }
    } catch (err) {
      errors[region] = (err as Error).message
    }
  }

  let upserted = 0
  if (allRows.length > 0) {
    // Upsert in chunks van 100 om body-grootte te beperken
    const chunkSize = 100
    for (let i = 0; i < allRows.length; i += chunkSize) {
      const chunk = allRows.slice(i, i + chunkSize)
      const { error } = await admin
        .from('viral_opportunities')
        .upsert(chunk, { onConflict: 'source_platform,external_id' })
      if (error) {
        errors[`upsert_chunk_${i}`] = error.message
      } else {
        upserted += chunk.length
      }
    }
  }

  const durationMs = Date.now() - startedAt
  return NextResponse.json({
    ok: Object.keys(errors).length === 0,
    regions,
    videos_fetched: allRows.length,
    upserted,
    errors: Object.keys(errors).length > 0 ? errors : undefined,
    duration_ms: durationMs,
  }, { status: 200 })
}
