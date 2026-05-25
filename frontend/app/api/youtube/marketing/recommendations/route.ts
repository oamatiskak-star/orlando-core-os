import { NextRequest, NextResponse } from 'next/server'
import { getServerSupabaseClient } from '@/lib/supabase/server-client'


export async function GET(request: NextRequest) {
  try {
    const supabase = getServerSupabaseClient()
    const { searchParams } = new URL(request.url)
    const channelId = searchParams.get('channelId')
    const status = searchParams.get('status')
    const limit = parseInt(searchParams.get('limit') || '50', 10)

    let query = (supabase
      .from('marketing_recommendations') as any)
      .select('*')
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(limit)

    if (channelId) {
      query = query.eq('channel_id', channelId)
    }

    if (status) {
      query = query.eq('status', status)
    }

    const { data, error } = await query as { data: any[], error: any }

    if (error) throw error

    return NextResponse.json(data)
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = getServerSupabaseClient()
    const body = await request.json()
    const { id, status, executed_at, actual_impact_views, roi_percent } = body

    const { data, error } = await (supabase
      .from('marketing_recommendations') as any)
      .update({
        status,
        executed_at: executed_at || null,
        actual_impact_views: actual_impact_views || null,
        roi_percent: roi_percent || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
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
