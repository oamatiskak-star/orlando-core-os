import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const revalidate = 0
export const maxDuration = 60

// Vercel cron — /api/acquisition/cron/opportunity-scoring
// Schedule: 0 */4 * * * (elke 4 uur)
// Beveiligd via Bearer CRON_SECRET.
//
// Triggert OpportunityScoringScraperWorker op Render acquisition-engine
// Combineert alle verrijkte data in comprehensive investment opportunity rankings
// Genereert risk-adjusted return scores en portfolio aanbevelingen

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const startedAt = Date.now()

  // Trigger Render acquisition-engine
  const engineUrl = process.env.ACQUISITION_ENGINE_URL
  if (!engineUrl) {
    return NextResponse.json(
      { error: 'ACQUISITION_ENGINE_URL not configured' },
      { status: 500 }
    )
  }

  try {
    const response = await fetch(`${engineUrl}/workers/opportunity-scoring/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })

    if (!response.ok) {
      const errorData = await response.text()
      return NextResponse.json(
        { error: `Engine returned ${response.status}: ${errorData}` },
        { status: 500 }
      )
    }

    const result = await response.json()

    // Optional: record scan job for tracking
    const admin = createAdminClient()
    try {
      await admin
        .from('acq_scan_jobs')
        .insert({
          agent_name: 'OpportunityScoringScraperWorker',
          job_type: 'opportunity_scoring_analysis',
          status: result.status === 'ok' ? 'completed' : 'failed',
          result_count: result.itemsInserted || 0,
          error_msg: result.error || null,
          payload: {
            trigger: 'vercel-cron',
            itemsFound: result.itemsFound,
            itemsInserted: result.itemsInserted,
          },
        })
    } catch (e) {
      // Ignore logging errors — scraper ran successfully
    }

    return NextResponse.json({
      ok: true,
      itemsFound: result.itemsFound,
      itemsInserted: result.itemsInserted,
      duration_ms: Date.now() - startedAt,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
