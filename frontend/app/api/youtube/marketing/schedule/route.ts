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

    if (!channelId) {
      return NextResponse.json(
        { error: 'channelId required' },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('marketing_schedule')
      .select('*')
      .eq('channel_id', channelId)
      .order('optimal_score', { ascending: false })

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
    const body = await request.json()
    const { channelId, dayOfWeek, hourUTC } = body

    // Reserve slot by updating schedule
    const { data, error } = await supabase
      .from('marketing_schedule')
      .update({ competitor_conflicts: (await supabase
        .from('marketing_schedule')
        .select('competitor_conflicts')
        .eq('channel_id', channelId)
        .eq('day_of_week', dayOfWeek)
        .eq('hour_utc', hourUTC)
        .single()).data?.competitor_conflicts + 1 || 1 })
      .eq('channel_id', channelId)
      .eq('day_of_week', dayOfWeek)
      .eq('hour_utc', hourUTC)
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
