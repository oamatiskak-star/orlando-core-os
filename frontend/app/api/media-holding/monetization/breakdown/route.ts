import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const revalidate = 0
export const dynamic = 'force-dynamic'

// Revenue-breakdown — wired bestaande attributie-views (per niche / per video / winners)
// + CEO-OS media-omzet-rollup. Read-only.
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [niche, video, topVideos, winners, mediaRev] = await Promise.all([
    supabase.from('v_attribution_niche').select('*').order('revenue', { ascending: false }),
    supabase.from('v_attribution_video').select('*').order('revenue', { ascending: false }).limit(50),
    supabase.from('v_top_videos_revenue').select('*').order('revenue_30d', { ascending: false }).limit(50),
    supabase.from('v_winner_economics').select('id,youtube_video_id,title,channel,niche,winner_status,revenue,rpm_equiv,revenue_per_video,revenue_per_1k,economic_winner_score,positive_economic,views,ctr').order('economic_winner_score', { ascending: false }).limit(50),
    supabase.from('v_ceo_media_revenue').select('*').maybeSingle(),
  ])

  return NextResponse.json({
    niche: niche.data ?? [],
    video: video.data ?? [],
    topVideos: topVideos.data ?? [],
    winners: winners.data ?? [],
    mediaRevenue: mediaRev.data ?? null,
  })
}
