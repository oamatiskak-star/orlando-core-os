import { NextRequest, NextResponse } from 'next/server'
import { getServerSupabaseClient } from '@/lib/supabase/server-client'

interface AbTestVariant {
  id: string
  video_id: string
  variant_type: string
  variant_a_value: string
  variant_b_value: string
  variant_a_views: number
  variant_b_views: number
  variant_a_ctr: number
  variant_b_ctr: number
  winner?: string
  status: string
  started_at: string
  concluded_at?: string
}

export async function GET(request: NextRequest) {
  try {
    const supabase = getServerSupabaseClient()
    const { searchParams } = new URL(request.url)
    const channelId = searchParams.get('channelId')
    const status = searchParams.get('status') || 'active'

    let query: any = (supabase
      .from('ab_test_variants') as any)
      .select('*')
      .eq('status', status)
      .order('started_at', { ascending: false })

    if (channelId) {
      // Get videos for this channel first
      const { data: videos } = await (supabase
        .from('youtube_videos') as any)
        .select('id')
        .eq('channel_id', channelId)

      const videoIds = (videos as { id: string }[] | null)?.map(v => v.id) || []
      query = query.in('video_id', videoIds)
    }

    const { data, error } = await query as { data: AbTestVariant[] | null, error: any }

    if (error) throw error

    // Calculate winner stats
    const enriched = (data || []).map((test: AbTestVariant) => {
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
    const supabase = getServerSupabaseClient()
    const body = await request.json()
    const { videoId, variantType, variantA, variantB } = body

    const result: any = await (supabase
      .from('ab_test_variants') as any)
      .insert({
        video_id: videoId,
        variant_type: variantType,
        variant_a_value: variantA,
        variant_b_value: variantB,
        status: 'active'
      })
      .select()

    const { data, error } = result

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
    const supabase = getServerSupabaseClient()
    const body = await request.json()
    const { id, winner, status } = body

    const result: any = await (supabase
      .from('ab_test_variants') as any)
      .update({
        winner,
        status: status || 'concluded',
        concluded_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()

    const { data, error } = result

    if (error) throw error

    return NextResponse.json(data)
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}
