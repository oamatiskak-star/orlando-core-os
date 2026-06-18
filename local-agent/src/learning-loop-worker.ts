import './ws-shim'   // MOET eerst — zet global WebSocket vóór elke @supabase-import
import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import { storeTrajectory, storeVerdictPattern, deriveVerdict } from './lib/reasoning-bank'

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

const db = createClient((process.env.SUPABASE_URL ?? 'http://preflight.invalid'), (process.env.SUPABASE_SERVICE_ROLE_KEY ?? 'preflight'), { auth: { persistSession: false } })

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

/**
 * CANONIEKE attributie uit main's `public.video_attribution` (event-grained).
 * Single source of truth — GEEN parallelle intent_events-berekening meer.
 * Alleen echte rijen; geen rijen → alles NULL (geen fake/schatting).
 */
async function canonicalAttribution(projectId: string): Promise<{ website_clicks: number | null; leads: number | null; revenue: number | null }> {
  const { data: rows } = await db.from('video_attribution').select('stage, revenue').eq('project_id', projectId)
  if (!rows || rows.length === 0) return { website_clicks: null, leads: null, revenue: null }
  let clicks = 0, leads = 0, revenue = 0
  for (const r of rows as any[]) {
    if (r.stage === 'click') clicks++
    else if (r.stage === 'lead') leads++
    if (r.stage === 'sale' || r.stage === 'upsell' || r.stage === 'subscription_started') revenue += Number(r.revenue ?? 0)
  }
  return { website_clicks: clicks, leads, revenue }   // echte tellingen (0 = echt 0)
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
      const attr = await canonicalAttribution(p.id)

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

    // OPERATIONELE learning-state (GEEN CIS hier — canon = v_video_impact).
    const { data: cps } = await db.from('video_performance_checkpoints')
      .select('source_status, ctr, retention').eq('video_project_id', p.id)
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

    // dimensie-performance ALLEEN uit echte data; anders NULL (geen default-success).
    // Dit zijn LEER-signalen, GEEN impact/omzet-score (die is canoniek v_video_impact).
    const avg = (vals: (number | null | undefined)[]) => { const n = vals.filter((v): v is number => typeof v === 'number'); return n.length ? n.reduce((s, v) => s + v, 0) / n.length : null }
    const thumbnail_perf = avg(collected.map((c) => c.ctr))
    const hook_perf = avg(collected.map((c) => c.retention))

    await db.from('video_learning_summary').upsert({
      video_project_id: p.id, channel_id: p.channel_id ?? null, learning_status,
      thumbnail_perf, hook_perf,
      voice_perf: null, visual_perf: null, music_perf: null, cta_perf: null, format_perf: null, channel_perf: null,
      blockers,
    }, { onConflict: 'video_project_id' })

    // ReasoningBank: sla trajectory + verdict op in AgentDB (fire-and-forget via ruflo CLI).
    // Ruflo niet beschikbaar → silent skip, learning loop stopt hier niet.
    const verdict = deriveVerdict(learning_status, thumbnail_perf, null)
    storeTrajectory({
      project_id: p.id, niche: p.niche ?? null, format: p.format ?? null,
      channel_id: p.channel_id ?? null, learning_status, verdict,
      metrics: { avg_ctr: thumbnail_perf, avg_retention: hook_perf, revenue: null },
      checkpoints_collected: collected.length, recorded_at: new Date(nowMs).toISOString(),
    })
    storeVerdictPattern(p.niche ?? null, p.format ?? null, verdict, thumbnail_perf, null)

    // OMZET-terugkoppeling: lees canoniek uit video_attribution (niet zelf herberekenen).
    // viral_patterns.revenue_attributed alleen bijwerken met ECHTE canon-omzet, en
    // GESCOPED op kanaal (channel→topic) zodat kanalen elkaars patterns niet vervuilen.
    const canon = await canonicalAttribution(p.id)
    if (canon.revenue != null && canon.revenue > 0) {
      let vp = db.from('viral_patterns').update({ revenue_attributed: canon.revenue }).eq('niche', p.niche ?? '').eq('platform', 'youtube')
      if (p.channel_id) vp = vp.eq('channel_id', p.channel_id)   // kanaal-scoping = geen kruisbestuiving
      await vp
      await db.from('video_projects').update({ revenue_attributed: canon.revenue, leads_attributed: canon.leads ?? 0 }).eq('id', p.id)

      // Herbereken verdict met echte omzet en update ReasoningBank (overschrijft eerder fire-and-forget).
      const verdictWithRevenue = deriveVerdict(learning_status, thumbnail_perf, canon.revenue)
      storeVerdictPattern(p.niche ?? null, p.format ?? null, verdictWithRevenue, thumbnail_perf, canon.revenue)
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
