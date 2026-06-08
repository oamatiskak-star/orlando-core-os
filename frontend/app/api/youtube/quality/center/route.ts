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
  const base = (data ?? []) as any[]
  const ids = base.map((r) => r.project_id)

  // Verrijking (FASE H): thumbnail-varianten, gekozen thumbnail, muziek, rework_reason.
  const reworkMap: Record<string, string | null> = {}
  const thumbMap: Record<string, { count: number; chosen: string | null }> = {}
  const musicMap: Record<string, { score: number | null; provider: string | null }> = {}
  const learnMap: Record<string, string> = {}
  if (ids.length > 0) {
    const { data: projs } = await admin.from('video_projects').select('id, rework_reason').in('id', ids)
    for (const p of (projs ?? []) as any[]) reworkMap[p.id] = p.rework_reason ?? null
    const { data: tvs } = await admin.from('thumbnail_variants').select('project_id, variant, chosen').in('project_id', ids)
    for (const t of (tvs ?? []) as any[]) {
      const e = thumbMap[t.project_id] ?? { count: 0, chosen: null }
      e.count += 1; if (t.chosen) e.chosen = t.variant
      thumbMap[t.project_id] = e
    }
    const { data: musics } = await admin.from('audio_assets').select('project_id, final_score, provider').eq('kind', 'music').in('project_id', ids)
    for (const m of (musics ?? []) as any[]) musicMap[m.project_id] = { score: m.final_score ?? null, provider: m.provider ?? null }
    // learning_status (FASE 5) — defensief: video_learning_summary kan nog ontbreken (migr 154 niet toegepast) → default 'pending'
    const { data: ls } = await admin.from('video_learning_summary').select('video_project_id, learning_status').in('video_project_id', ids)
    for (const l of (ls ?? []) as any[]) learnMap[l.video_project_id] = l.learning_status ?? 'pending'
  }

  const rows = base.map((r) => ({
    ...r,
    upload_eligible: r.approved === true && r.gate_passed === true,
    rework_reason: reworkMap[r.project_id] ?? null,
    thumbnail_variant_count: thumbMap[r.project_id]?.count ?? 0,
    selected_thumbnail: thumbMap[r.project_id]?.chosen ?? null,
    music_selected: !!musicMap[r.project_id],
    music_provider: musicMap[r.project_id]?.provider ?? null,
    learning_status: learnMap[r.project_id] ?? 'pending',
  }))
  return NextResponse.json({ ok: true, rows })
}
