import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

/**
 * CONTENT QUALITY CENTER — read-only data (Content Factory 2.0 — FASE D).
 * Leest uitsluitend de view v_video_cqi. GEEN schrijfacties, GEEN approve.
 */
export async function GET() {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('v_video_cqi')
    .select('project_id, channel_id, niche, title, status, approved, quality_enforced, quality_passed, ' +
            'hook_score, thumbnail_score, retention_prediction, voice_score, visual_score, music_score, ' +
            'cta_score, content_quality_index, gate_passed, gate_reason, revenue_attributed, updated_at')
    .order('updated_at', { ascending: false })
    .limit(100)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // v_video_cqi staat niet in de gegenereerde Supabase-types → cast naar any[].
  const rows = ((data ?? []) as any[]).map((r) => ({
    ...r,
    // upload_eligible = puur afgeleid (read-only): approval + gate. Geen actie hier.
    upload_eligible: r.approved === true && r.gate_passed === true,
  }))
  return NextResponse.json({ ok: true, rows })
}
