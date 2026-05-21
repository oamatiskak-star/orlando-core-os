import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const channelId = searchParams.get('channelId')
    const status = searchParams.get('status') || 'active'

    let query = supabase
      .from('ab_test_variants')
      .select('*')
      .eq('status', status)
      .order('started_at', { ascending: false })

    if (channelId) {
      // Get videos for this channel first
      const { data: videos } = await supabase
        .from('youtube_videos')
        .select('id')
        .eq('channel_id', channelId)

      const videoIds = videos?.map(v => v.id) || []
      query = query.in('video_id', videoIds)
    }

    const { data, error } = await query

    if (error) throw error

    // Calculate winner stats
    const enriched = (data || []).map(test => {
      const totalA = test.variant_a_views || 0
      const totalB = test.variant_b_views || 0
      const totalViews = totalA + totalB

      const ctrA = test.variant_a_ctr || 0
      const ctrB = test.variant_b_ctr || 0

      const winnerA = ctrA > ctrB ? 'A' : 'B'
      const confidencePercent = (Math.abs(ctrA - ctrB) / Math.max(ctrA, ctrB)) * 100

      return {
        ...test,
        stats: {
          totalViews,
          variantAPercent: totalViews > 0 ? (totalA / totalViews) * 100 : 50,
          variantBPercent: totalViews > 0 ? (totalB / totalViews) * 100 : 50,
          ctrDifference: Math.abs(ctrA - ctrB),
          predictedWinner: winnerA,
          confidence: Math.min(confidencePercent, 100)
        }
      }
    })

    return NextResponse.json(enriched)
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { videoId, variantType, variantA, variantB } = body

    const { data, error } = await supabase
      .from('ab_test_variants')
      .insert({
        video_id: videoId,
        variant_type: variantType,
        variant_a_value: variantA,
        variant_b_value: variantB,
        status: 'active'
      })
      .select()

    if (error) throw error

    return NextResponse.json(data)
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, winner, status } = body

    const { data, error } = await supabase
      .from('ab_test_variants')
      .update({
        winner,
        status: status || 'concluded',
        concluded_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()

    if (error) throw error

    return NextResponse.json(data)
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}
