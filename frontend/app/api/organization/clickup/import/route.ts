import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClickUpClient, syncClickUpTasks } from '@/lib/clickup'

export const revalidate = 0

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()
    const { api_token, team_id } = body

    // Create ClickUp client
    const clickupClient = createClickUpClient(api_token, team_id)
    if (!clickupClient) {
      return NextResponse.json(
        { error: 'ClickUp credentials not provided' },
        { status: 400 }
      )
    }

    // Test connection
    const connected = await clickupClient.testConnection()
    if (!connected) {
      return NextResponse.json(
        { error: 'Failed to connect to ClickUp API. Check credentials.' },
        { status: 401 }
      )
    }

    // Start sync
    const result = await syncClickUpTasks(supabase, clickupClient)

    return NextResponse.json({
      success: result.success,
      imported: result.imported_count,
      skipped: result.skipped_count,
      errors: result.error_count,
      error_details: result.errors.length > 0 ? result.errors : undefined,
    })
  } catch (error) {
    console.error('ClickUp import error:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Import failed',
      },
      { status: 500 }
    )
  }
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    // Get import status stats
    const { data: synced } = await supabase
      .from('organization_clickup_imports')
      .select('count', { count: 'exact', head: true })
      .eq('sync_status', 'synced')

    const { data: pending } = await supabase
      .from('organization_clickup_imports')
      .select('count', { count: 'exact', head: true })
      .eq('sync_status', 'pending')

    const { data: errors } = await supabase
      .from('organization_clickup_imports')
      .select('count', { count: 'exact', head: true })
      .eq('sync_status', 'error')

    return NextResponse.json({
      synced_count: synced?.[0]?.count || 0,
      pending_count: pending?.[0]?.count || 0,
      error_count: errors?.[0]?.count || 0,
      configured: !!process.env.CLICKUP_API_TOKEN && !!process.env.CLICKUP_TEAM_ID,
    })
  } catch (error) {
    console.error('Error getting ClickUp import status:', error)
    return NextResponse.json(
      { error: 'Failed to get status' },
      { status: 500 }
    )
  }
}
