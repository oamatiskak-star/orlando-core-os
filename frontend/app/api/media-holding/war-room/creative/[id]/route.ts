import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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
  if (!ci) return NextResponse.json({ error: 'Niet gevonden' }, { status: 404 })

  const [metricRes, uploadsRes, channelRes, convRes] = await Promise.all([
    supabase.from('media_holding_metrics').select('views, ctr_pct, retention_pct, revenue, likes, comments, shares, saves, snapshot_at')
      .eq('content_item_id', id).order('snapshot_at', { ascending: false }).limit(1),
    supabase.from('media_holding_uploads').select('platform, status').eq('content_item_id', id),
    ci.channel_id ? supabase.from('media_holding_channels').select('name, niche').eq('id', ci.channel_id).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from('affiliate_conversions').select('commission_eur, status').eq('content_item_id', id),
  ])

  const m = (metricRes.data ?? [])[0] ?? null
  const cb = (ci.content_brief ?? {}) as Record<string, unknown>
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
