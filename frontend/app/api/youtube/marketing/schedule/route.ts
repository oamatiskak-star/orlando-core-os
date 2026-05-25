import { NextRequest, NextResponse } from 'next/server'
import { getServerSupabaseClient } from '@/lib/supabase/server-client'


export async function GET(request: NextRequest) {
  try {
    const supabase = getServerSupabaseClient()
    const { searchParams } = new URL(request.url)
    const channelId = searchParams.get('channelId')

    if (!channelId) {
      return NextResponse.json(
        { error: 'channelId required' },
        { status: 400 }
      )
    }

    const { data, error } = await (supabase
      .from('marketing_schedule') as any)
      .select('*')
      .eq('channel_id', channelId)
      .order('optimal_score', { ascending: false }) as { data: { day_of_week: number; hour_utc: number; optimal_score: number; audience_size_expected: number; ctr_projection: number; viral_probability: number }[] | null, error: any }

    if (error) throw error

    // Transform into heatmap format
    const heatmap: Record<number, Record<number, any>> = {}

    for (let day = 0; day < 7; day++) {
      heatmap[day] = {}
      for (let hour = 0; hour < 24; hour++) {
        heatmap[day][hour] = {
          score: 0,
          audience: 0,
          ctr: 0,
          viral: 0
        }
      }
    }

    for (const slot of data || []) {
      heatmap[slot.day_of_week][slot.hour_utc] = {
        score: slot.optimal_score,
        audience: slot.audience_size_expected,
        ctr: slot.ctr_projection,
        viral: slot.viral_probability
      }
    }

    return NextResponse.json({
      heatmap,
      bestSlots: (data || []).slice(0, 5),
      summary: {
        optimalDay: Math.max(...Object.keys(heatmap).map(d => {
          const maxHour = Math.max(...Object.values(heatmap[parseInt(d)]).map(h => h.score))
          return maxHour
        })),
        optimalHour: 14 // Default afternoon
      }
    })
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
    const { channelId, dayOfWeek, hourUTC } = body

    // Reserve slot by updating schedule
    const { data: existingSlot } = await (supabase
      .from('marketing_schedule') as any)
      .select('competitor_conflicts')
      .eq('channel_id', channelId)
      .eq('day_of_week', dayOfWeek)
      .eq('hour_utc', hourUTC)
      .single() as { data: { competitor_conflicts?: number } | null }

    const { data, error } = await (supabase
      .from('marketing_schedule') as any)
      .update({ competitor_conflicts: (existingSlot?.competitor_conflicts || 0) + 1 })
      .eq('channel_id', channelId)
      .eq('day_of_week', dayOfWeek)
      .eq('hour_utc', hourUTC)
      .select() as { data: any, error: any }

    if (error) throw error

    return NextResponse.json(data)
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}
