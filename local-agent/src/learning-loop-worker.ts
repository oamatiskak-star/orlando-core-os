import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

/**
 * LEARNING-LOOP WORKER (Content Factory 2.0 — FASE 5, STRUCTUUR).
 *
 * Omzet-gestuurde feedback: per gepubliceerd video_project meetpunten op
 * 1h/6h/24h/72u → echte metrics (YouTube-analytics + Aquier-attributie via
 * intent_events) → update viral_patterns + video_learning_summary.
 *
 * HARDE regels:
 * - ALLEEN echte data. Geen fake, geen backfill, geen schatting, geen interpolatie,
 *   geen default-success. Ontbrekende bron → expliciete blocked/pending-status.
 * - Raakt NOOIT approved/upload_ready/uploaded/verified_live of youtube_upload_queue.
 * - Geen externe API-call zonder key: ontbreekt de key → markeer, doe niets.
 * - Handmatig/controlled (geen loop, geen planner-activatie).
 */

const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })

const HAS_YT_ANALYTICS = !!(process.env.YOUTUBE_ANALYTICS_KEY || process.env.YOUTUBE_API_KEY)
const HAS_GA4 = !!(process.env.GA4_PROPERTY_ID || process.env.NEXT_PUBLIC_GA_ID)

type Checkpoint = '1h' | '6h' | '24h' | '72h'
const CHECKPOINTS: { key: Checkpoint; hours: number }[] = [
  { key: '1h', hours: 1 }, { key: '6h', hours: 6 }, { key: '24h', hours: 24 }, { key: '72h', hours: 72 },
]
type SourceStatus = 'collected' | 'pending' | 'blocked_missing_youtube_analytics_key' | 'tracking_gap_pending' | 'revenue_pending'

interface Metrics {
  views: number | null; ctr: number | null; avg_view_duration: number | null; retention: number | null
  watchtime_min: number | null; likes: number | null; comments: number | null; shares: number | null
  saves: number | null; subscribers_gained: number | null
  website_clicks: number | null; leads: number | null; revenue: number | null
}
const EMPTY: Metrics = { views: null, ctr: null, avg_view_duration: null, retention: null, watchtime_min: null, likes: null, comments: null, shares: null, saves: null, subscribers_gained: null, website_clicks: null, leads: null, revenue: null }

/** Echte YouTube-metrics uit youtube_video_analytics (gevuld door youtube-engine). Geen key → niets. */
async function youtubeMetrics(youtubeVideoId: string | null): Promise<Partial<Metrics> | null> {
  if (!HAS_YT_ANALYTICS || !youtubeVideoId) return null
  const { data } = await db.from('youtube_video_analytics')
    .select('views, ctr, watch_time_minutes, avg_view_percentage, likes, comments')
    .eq('youtube_video_id', youtubeVideoId).order('recorded_at', { ascending: false }).limit(1).maybeSingle()
  if (!data) return null   // key aanwezig maar nog geen data → pending (geen fake)
  return {
    views: data.views ?? null, ctr: data.ctr ?? null,
    avg_view_duration: null, retention: data.avg_view_percentage ?? null,
    watchtime_min: data.watch_time_minutes ?? null, likes: data.likes ?? null, comments: data.comments ?? null,
  }
}

/** Echte Aquier-attributie via intent_events (utm_content=video:{id}) + leads. Geen fake. */
async function aquierAttribution(projectId: string): Promise<{ website_clicks: number | null; leads: number | null; revenue: number | null }> {
  const utmContent = `video:${projectId}`
  // website-klikken: intent_events met deze utm_content
  const { count: clicks } = await db.schema('vastgoed_core').from('intent_events')
    .select('id', { count: 'exact', head: true }).contains('utm', { utm_content: utmContent })
  // leads: newsletter_leads via dezelfde utm (indien gekoppeld) — alleen echte rijen
  const { count: leads } = await db.schema('vastgoed_core').from('newsletter_leads')
    .select('id', { count: 'exact', head: true }).contains('utm', { utm_content: utmContent })
  // revenue: gekoppelde omzet — bij ontbrekende koppeling NULL (geen schatting)
  return { website_clicks: clicks ?? null, leads: leads ?? null, revenue: null }
}

function dueCheckpoints(publishedAt: string, nowMs: number): Checkpoint[] {
  const pub = new Date(publishedAt).getTime()
  const elapsedH = (nowMs - pub) / 3_600_000
  return CHECKPOINTS.filter((c) => elapsedH >= c.hours).map((c) => c.key)
}

export interface LearningRunResult {
  projects: number
  checkpointsWritten: number
  blocked: number
  pending: number
}

/**
 * @param nowMs  expliciete tijd (Date.now van de caller) — de worker zelf
 *               verzint geen tijd; wordt door de CLI meegegeven.
 */
export async function runLearningLoop(nowMs: number): Promise<LearningRunResult> {
  // Alleen ECHT gepubliceerde projecten. In shadow-fase = 0 → worker doet niets.
  const { data: projects } = await db.from('video_projects')
    .select('id, status, format, channel_id, niche, utm_campaign, utm_content')
    .in('status', ['uploaded', 'verified_live'])
  const list = projects ?? []

  let written = 0, blocked = 0, pending = 0
  for (const p of list) {
    // youtube_video_id ophalen (gekoppeld via queue) — alleen lezen
    const { data: q } = await db.from('youtube_upload_queue').select('youtube_video_id, scheduled_publish_at, upload_finished_at').eq('id', (p as any).queue_id ?? '00000000-0000-0000-0000-000000000000').maybeSingle()
    const publishedAt: string | null = (q?.upload_finished_at as string) ?? (q?.scheduled_publish_at as string) ?? null
    const ytId: string | null = (q?.youtube_video_id as string) ?? null
    if (!publishedAt) { pending++; continue }

    const due = dueCheckpoints(publishedAt, nowMs)
    let lastStatus: SourceStatus = 'pending'
    for (const cp of due) {
      const yt = await youtubeMetrics(ytId)
      const attr = await aquierAttribution(p.id)

      let status: SourceStatus
      if (!HAS_YT_ANALYTICS) status = 'blocked_missing_youtube_analytics_key'
      else if (!yt) status = 'pending'                                  // key er, data nog niet
      else if (!HAS_GA4) status = 'tracking_gap_pending'
      else if (attr.revenue == null) status = 'revenue_pending'
      else status = 'collected'
      lastStatus = status
      if (status === 'blocked_missing_youtube_analytics_key') blocked++
      else if (status !== 'collected') pending++

      const m: Metrics = { ...EMPTY, ...(yt ?? {}), website_clicks: attr.website_clicks, leads: attr.leads, revenue: attr.revenue }
      await db.from('video_performance_checkpoints').upsert({
        video_project_id: p.id, checkpoint: cp, source_status: status,
        views: m.views, ctr: m.ctr, avg_view_duration: m.avg_view_duration, retention: m.retention,
        watchtime_min: m.watchtime_min, likes: m.likes, comments: m.comments, shares: m.shares, saves: m.saves,
        subscribers_gained: m.subscribers_gained, website_clicks: m.website_clicks, leads: m.leads,
        revenue: m.revenue, currency: 'EUR',
        utm_campaign: p.utm_campaign ?? null, utm_content: p.utm_content ?? null,
        platform: 'youtube', content_category: p.niche ?? null,
        captured_at: status === 'collected' ? new Date(nowMs).toISOString() : null,
      }, { onConflict: 'video_project_id,checkpoint' })
      written++
    }

    // Learning-summary: alleen leerbare subscores uit ECHT verzamelde checkpoints.
    const { data: cps } = await db.from('video_performance_checkpoints')
      .select('source_status, ctr, retention, website_clicks, leads, revenue, views, subscribers_gained')
      .eq('video_project_id', p.id)
    const collected = (cps ?? []).filter((c) => c.source_status === 'collected')

    const blockers: string[] = []
    if (!HAS_YT_ANALYTICS) blockers.push('blocked_missing_youtube_analytics_key')
    if (!HAS_GA4) blockers.push('tracking_gap_pending')

    let learning_status: string
    if (blockers.includes('blocked_missing_youtube_analytics_key')) learning_status = 'blocked_missing_keys'
    else if (collected.length === 0) {
      const maxDue = due[due.length - 1]
      learning_status = maxDue ? `awaiting_${maxDue}` : 'pending'
    } else if (due.includes('72h')) learning_status = 'completed'
    else { const maxDue = due[due.length - 1]; learning_status = maxDue ? `awaiting_${maxDue}` : 'pending' }

    // subscores ALLEEN uit echte data; anders NULL (geen default-success)
    const avg = (vals: (number | null | undefined)[]) => { const n = vals.filter((v): v is number => typeof v === 'number'); return n.length ? n.reduce((s, v) => s + v, 0) / n.length : null }
    const thumbnail_perf = avg(collected.map((c) => c.ctr))
    const hook_perf = avg(collected.map((c) => c.retention))
    const totalRevenue = avg(collected.map((c) => c.revenue)) != null ? collected.reduce((s, c) => s + (c.revenue ?? 0), 0) : null
    const totalLeads = collected.some((c) => c.leads != null) ? collected.reduce((s, c) => s + (c.leads ?? 0), 0) : null
    const totalClicks = collected.some((c) => c.website_clicks != null) ? collected.reduce((s, c) => s + (c.website_clicks ?? 0), 0) : null
    const totalViews = collected.some((c) => c.views != null) ? collected.reduce((s, c) => s + (c.views ?? 0), 0) : null
    // Content Impact Score = echte conversie-gewogen, alleen als er data is
    const content_impact = (totalViews && totalClicks != null) ? Math.round((totalClicks / Math.max(1, totalViews)) * 1000) / 10 : null

    await db.from('video_learning_summary').upsert({
      video_project_id: p.id, learning_status,
      content_impact_score: content_impact,
      thumbnail_perf, hook_perf,
      voice_perf: null, visual_perf: null, music_perf: null, cta_perf: null, format_perf: null, channel_perf: null,
      revenue_subscore: totalRevenue, lead_subscore: totalLeads, authority_subscore: null,
      viral_subscore: null, blockers,
    }, { onConflict: 'video_project_id' })

    // viral_patterns: alleen echte omzet terugkoppelen (geen fake)
    if (totalRevenue != null && totalRevenue > 0) {
      await db.from('viral_patterns').update({ revenue_attributed: totalRevenue }).eq('niche', p.niche ?? '').eq('platform', 'youtube')
    }
  }

  return { projects: list.length, checkpointsWritten: written, blocked, pending }
}

// ── CLI: handmatig/controlled, geen loop ─────────────────────────────────────
if (require.main === module) {
  runLearningLoop(Date.now())
    .then((r) => { console.log('LEARNING-LOOP:', JSON.stringify(r, null, 2)); process.exit(0) })
    .catch((e) => { console.error('LEARNING-LOOP-FOUT:', e?.message ?? e); process.exit(1) })
}
