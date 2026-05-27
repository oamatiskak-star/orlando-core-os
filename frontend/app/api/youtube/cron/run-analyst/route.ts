import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { reportHeartbeat } from '@/lib/watchdog/heartbeat'

export const revalidate = 0
export const maxDuration = 60

// YouTube Channel Analyst — Vercel-cron variant.
// Leest youtube_video_analytics en schrijft channel_analyst_reports.
// Draait cloud-betrouwbaar na sync-video-analytics (geen CLI-R-container nodig).
// Beveiligd via Bearer CRON_SECRET; heartbeat: cron.vercel.run-analyst.

const VIEWS_TARGET = 280_000 // per-kanaal sprint-doel (3×280k = 840k totaal)

interface Row { views: number | null; watch_time_minutes: number | null; ctr: number | null; recorded_at: string }

function sumViewsSince(rows: Row[], hours: number): number {
  const since = Date.now() - hours * 3_600_000
  return rows.filter(r => new Date(r.recorded_at).getTime() >= since)
             .reduce((s, r) => s + (r.views ?? 0), 0)
}

function growth(rows: Row[], hours: number): number {
  // recente periode vs direct daarvoor (zelfde duur)
  const now = Date.now()
  const recent = rows.filter(r => new Date(r.recorded_at).getTime() >= now - hours * 3_600_000)
                     .reduce((s, r) => s + (r.views ?? 0), 0)
  const prior = rows.filter(r => {
    const t = new Date(r.recorded_at).getTime()
    return t < now - hours * 3_600_000 && t >= now - 2 * hours * 3_600_000
  }).reduce((s, r) => s + (r.views ?? 0), 0)
  if (prior <= 0) return recent > 0 ? 100 : 0
  return Math.round(((recent - prior) / prior) * 100)
}

function healthScore(totalViews: number, avgCtr: number, g48: number): number {
  let s = 50
  if (totalViews > 10_000) s += 15; else if (totalViews > 1_000) s += 10; else if (totalViews > 100) s += 5
  if (avgCtr > 0.05) s += 15; else if (avgCtr > 0.03) s += 10; else if (avgCtr > 0.01) s += 5
  if (g48 > 100) s += 15; else if (g48 > 50) s += 10; else if (g48 > 0) s += 5
  return Math.min(s, 100)
}

function recommend(totalViews: number, avgCtr: number, g48: number, onTrack: boolean, perDayNeeded: number): string[] {
  const r: string[] = []
  if (!onTrack) r.push(`🚨 Achterstand: ${Math.round(perDayNeeded).toLocaleString()} views/dag nodig voor ${VIEWS_TARGET.toLocaleString()}`)
  if (avgCtr > 0 && avgCtr < 0.02) r.push('⚡ CTR kritiek laag — thumbnail/titel overhaul')
  else if (avgCtr >= 0.02 && avgCtr < 0.05) r.push('📸 A/B-test thumbnails: 5%+ CTR haalbaar')
  if (g48 > 100) r.push('🚀 Viral momentum — schaal content NU op')
  else if (g48 < 0) r.push('⚠️ Groei daalt laatste 48u — analyseer recente uploads')
  if (totalViews < 100) r.push('📺 Te weinig tractie — verhoog upload-frequentie / herzie format')
  if (onTrack && g48 >= 0) r.push('✅ On track — behoud tempo')
  return r
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const { data: channels } = await admin
    .from('youtube_channels')
    .select('id, naam, created_at')
    .limit(50)

  if (!channels?.length) {
    await reportHeartbeat('cron.vercel.run-analyst').catch(() => {})
    return NextResponse.json({ ok: true, channels: 0 })
  }

  const reports: Record<string, unknown>[] = []
  for (const ch of channels) {
    const { data: rows } = await admin
      .from('youtube_video_analytics')
      .select('views, watch_time_minutes, ctr, recorded_at')
      .eq('channel_id', ch.id)
      .gte('recorded_at', new Date(Date.now() - 30 * 86_400_000).toISOString())

    const list = (rows ?? []) as Row[]
    const totalViews   = list.reduce((s, r) => s + (r.views ?? 0), 0)
    const watchMinutes = list.reduce((s, r) => s + (r.watch_time_minutes ?? 0), 0)
    const avgCtr       = list.length ? list.reduce((s, r) => s + (r.ctr ?? 0), 0) / list.length : 0
    const g48 = growth(list, 48)
    const g7  = growth(list, 7 * 24)
    const g30 = growth(list, 30 * 24)

    const elapsedDays   = Math.max(1, Math.floor((Date.now() - new Date(ch.created_at).getTime()) / 86_400_000))
    const expectedViews = Math.min(elapsedDays / 10, 1) * VIEWS_TARGET
    const onTrack       = totalViews >= expectedViews * 0.95
    const viewsNeeded   = Math.max(VIEWS_TARGET - totalViews, 0)
    const daysRemaining = Math.max(10 - elapsedDays, 1)

    reports.push({
      channel_id:             ch.id,
      health_score:           healthScore(totalViews, avgCtr, g48),
      total_views:            totalViews,
      watch_time_minutes:     Number(watchMinutes.toFixed(2)),
      avg_ctr:                Number(avgCtr.toFixed(4)),
      growth_48h:             g48,
      growth_7d:              g7,
      growth_30d:             g30,
      views_target:           VIEWS_TARGET,
      views_progress_percent: Number(((totalViews / VIEWS_TARGET) * 100).toFixed(2)),
      views_needed:           viewsNeeded,
      on_track:               onTrack,
      recommendations:        recommend(totalViews, avgCtr, g48, onTrack, viewsNeeded / daysRemaining),
      analyzed_at:            new Date().toISOString(),
      updated_at:             new Date().toISOString(),
    })
  }

  const { error } = await admin
    .from('channel_analyst_reports')
    .upsert(reports, { onConflict: 'channel_id' })

  await reportHeartbeat('cron.vercel.run-analyst').catch(() => {})

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, channels: channels.length, reports: reports.length })
}
