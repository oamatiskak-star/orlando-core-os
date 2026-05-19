import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const revalidate = 0

// POST /api/media-holding/viral-opportunities/scan
// Maakt een orchestrator_task aan met executor='viral_scanner' zodat de
// ao-executor (Render) de YouTube Data API v3 scanner draait. Output gaat
// naar viral_opportunities en via bridge trigger naar osil_opportunities
// onder category='youtube'.
//
// Body (optioneel):
//   { regions: ["NL","US","GB"], max_per_region: 50 }
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const regions: string[] = Array.isArray(body.regions) ? body.regions : ['NL', 'US', 'GB']
  const maxPerRegion: number = typeof body.max_per_region === 'number' ? body.max_per_region : 50

  const { data, error } = await supabase
    .from('orchestrator_tasks')
    .insert({
      company_id:       'modiwerijo',
      title:            `Viral scan YouTube (${regions.join('/')})`,
      task_type:        'media_holding_scan',
      executor:         'viral_scanner',
      allowed_actions:  ['*'],
      priority:         3,
      status:           'open',
      objective:        [`Scan YouTube mostPopular voor regions ${regions.join(', ')} (max ${maxPerRegion} per region) en push naar viral_opportunities.`],
      payload: {
        scanner_config: {
          regions,
          max_per_region: maxPerRegion,
        },
        persona: 'Vortex',
      },
    })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ task_id: data.id, regions, max_per_region: maxPerRegion }, { status: 202 })
}
