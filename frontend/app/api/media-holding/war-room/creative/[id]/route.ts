import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { resolvePreview } from '@/lib/war-room/preview'

export const revalidate = 0

// Read-only creative-detail voor het Creative Detail Panel (Creative Library).
// Uitsluitend echte velden uit media_holding_*; ontbrekend → null → UI toont "Geen data".
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: ci, error } = await supabase
    .from('media_holding_content_items')
    .select('id, channel_id, kind, title, hook, status, output_url, content_brief, render_cost_eur, revenue_attributed, duration_seconds, language, published_at, scheduled_at, failure_reason, prompt, retention_analysis')
    .eq('id', id)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  // Fallback: id is een youtube_videos.id (levende bron, migratie 164)
  if (!ci) return youtubeDetail(supabase, id)

  const [metricRes, uploadsRes, channelRes, convRes] = await Promise.all([
    supabase.from('media_holding_metrics').select('views, ctr_pct, retention_pct, revenue, likes, comments, shares, saves, snapshot_at')
      .eq('content_item_id', id).order('snapshot_at', { ascending: false }).limit(1),
    supabase.from('media_holding_uploads').select('platform, status, platform_video_id').eq('content_item_id', id),
    ci.channel_id ? supabase.from('media_holding_channels').select('name, niche').eq('id', ci.channel_id).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from('affiliate_conversions').select('commission_eur, status').eq('content_item_id', id),
  ])

  const m = (metricRes.data ?? [])[0] ?? null
  const cb = (ci.content_brief ?? {}) as Record<string, unknown>
  const ytUpload = (uploadsRes.data ?? []).find((u) => (u.platform ?? '').toLowerCase() === 'youtube' && u.platform_video_id)
  const preview = resolvePreview(ci.output_url, (ytUpload?.platform_video_id as string | undefined) ?? null)
  const cost = ci.render_cost_eur != null ? Number(ci.render_cost_eur) : null
  const revenue = m?.revenue != null ? Number(m.revenue) : (ci.revenue_attributed != null ? Number(ci.revenue_attributed) : null)
  const confirmedConv = (convRes.data ?? []).filter((c) => (c.status ?? '').toLowerCase() === 'confirmed')
  const commission = confirmedConv.reduce((s, c) => s + (Number(c.commission_eur) || 0), 0)
  const roas = cost && cost > 0 && revenue != null ? Math.round((revenue / cost) * 100) / 100 : null
  const eng = m && Number(m.views) > 0
    ? Math.round(((Number(m.likes || 0) + Number(m.comments || 0) + Number(m.shares || 0) + Number(m.saves || 0)) / Number(m.views)) * 10000) / 100
    : null

  return NextResponse.json({
    id: ci.id,
    title: ci.title || (cb.titel as string) || ci.hook || 'Creative',
    kind: ci.kind,
    status: ci.status,
    output_url: ci.output_url,
    channel: channelRes.data ? { name: (channelRes.data as { name: string }).name, niche: (channelRes.data as { niche: string | null }).niche } : null,
    platforms: (uploadsRes.data ?? []).map((u) => ({ platform: u.platform, status: u.status })),
    preview,
    language: ci.language,
    duration_seconds: ci.duration_seconds,
    failure_reason: ci.failure_reason,
    // brief-velden (echt aanwezig in content_brief)
    hook: ci.hook || (cb.hook as string) || null,
    description: (cb.beschrijving as string) || null,
    thumbnail_concept: (cb.visual_prompt as string) || null,
    hook_pattern: (cb.hook_pattern as string) || null,
    retention_strategy: (cb.retention_strategy as string) || null,
    generated_by: (cb.generated_by as string) || null,
    source_score: cb.source_score ?? null,
    // Video Studio velden
    script: (ci.prompt as string) || (cb.beschrijving as string) || null,
    voice_music: (cb.audio_prompt as string) || null,
    retention_analysis: ci.retention_analysis ?? null,
    // niet aanwezig in de bron → expliciet null (UI: "Geen data")
    cta: (cb.cta as string) ?? null,
    audience: (cb.target_audience as string) ?? null,
    funnel_phase: (cb.funnel_phase as string) ?? null,
    // performance
    performance: {
      views: m?.views != null ? Number(m.views) : null,
      ctr_pct: m?.ctr_pct != null ? Number(m.ctr_pct) : null,
      retention_pct: m?.retention_pct != null ? Number(m.retention_pct) : null,
      watchtime_min: null, // geen watchtime-bron gekoppeld
      engagement_pct: eng,
      revenue,
      cost,
      roas,
      commission,
      metric_at: m?.snapshot_at ?? null,
    },
  })
}

type SB = Awaited<ReturnType<typeof createClient>>

// Detail voor een LEVENDE youtube_videos creative (migratie 164). Echte velden, geen mock.
async function youtubeDetail(supabase: SB, id: string) {
  const { data: yv } = await supabase
    .from('youtube_videos')
    .select('id, channel_id, title, description, youtube_video_id, thumbnail_url, status, upload_status, is_short, views, ctr, retention, revenue, estimated_revenue, watch_time, duration_seconds, published_at, scheduled_at')
    .eq('id', id)
    .maybeSingle()

  if (!yv) return NextResponse.json({ error: 'Niet gevonden' }, { status: 404 })

  const [anRes, chRes] = await Promise.all([
    supabase.from('youtube_video_analytics').select('views, ctr, avg_view_percentage, estimated_revenue, watch_time_minutes, recorded_at')
      .eq('video_id', id).order('recorded_at', { ascending: false }).limit(1),
    yv.channel_id ? supabase.from('youtube_channels').select('name').eq('id', yv.channel_id).maybeSingle() : Promise.resolve({ data: null }),
  ])
  const an = (anRes.data ?? [])[0] ?? null
  const preview = resolvePreview(null, (yv.youtube_video_id as string | null) ?? null, (yv.thumbnail_url as string | null) ?? null)
  const num = (v: unknown) => (v == null ? null : Number(v))

  return NextResponse.json({
    id: yv.id,
    title: yv.title || 'YouTube video',
    kind: yv.is_short ? 'short' : 'long',
    status: yv.upload_status || yv.status,
    output_url: null,
    channel: chRes.data ? { name: (chRes.data as { name: string }).name, niche: null } : null,
    platforms: [{ platform: 'youtube', status: yv.upload_status || yv.status }],
    preview,
    language: null,
    duration_seconds: yv.duration_seconds ?? null,
    failure_reason: null,
    hook: null,
    description: (yv.description as string) || null,
    thumbnail_concept: null,
    hook_pattern: null,
    retention_strategy: null,
    generated_by: 'youtube-engine',
    source_score: null,
    script: (yv.description as string) || null,
    voice_music: null,
    retention_analysis: null,
    cta: null,
    audience: null,
    funnel_phase: null,
    performance: {
      views: num(an?.views ?? yv.views),
      ctr_pct: num(an?.ctr ?? yv.ctr),
      retention_pct: num(an?.avg_view_percentage ?? yv.retention),
      watchtime_min: num(an?.watch_time_minutes ?? yv.watch_time),
      engagement_pct: null,
      revenue: num(an?.estimated_revenue ?? yv.estimated_revenue ?? yv.revenue),
      cost: null,
      roas: null,
      commission: 0,
      metric_at: an?.recorded_at ?? null,
    },
  })
}
