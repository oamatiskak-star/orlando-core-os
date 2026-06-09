import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import type { SceneSpec } from './scene-planner'

/**
 * SPINE-WRITER (Content Factory 2.0 — FASE 2).
 *
 * Schrijft de `video_projects`-graph (project + scenes + audio/visual assets) en
 * beheert de status-machine TOT EN MET `awaiting_approval`. Raakt NOOIT
 * `youtube_upload_queue` aan en zet NOOIT `upload_ready`/`uploaded`/
 * `verified_live` of `approved=true` — upload + approval zijn bewust buiten deze
 * laag (menselijke goedkeuring + de gate elders). Geblokkeerde projecten →
 * status `rework_required` + `rework_reason` (video_projects kent geen 'blocked').
 */

const db = createClient(
  (process.env.SUPABASE_URL ?? 'http://preflight.invalid'),
  (process.env.SUPABASE_SERVICE_ROLE_KEY ?? 'preflight'),
  { auth: { persistSession: false } },
)

// Statussen die deze writer mag zetten. upload_ready/uploaded/verified_live en
// approved zijn HARD verboden hier (no-upload / no-auto-approve garantie).
export type WriterStatus =
  | 'draft' | 'production_ready' | 'quality_checked' | 'awaiting_approval'
  | 'rework_required' | 'rejected'

const FORBIDDEN_STATUSES = new Set(['approved', 'upload_ready', 'uploaded', 'verified_live'])

export interface CreateProjectInput {
  channel_id?: string | null
  niche?: string | null
  topic: string
  title?: string | null
  script?: string | null
  language: string
  format: '16:9' | '9:16' | '1:1'
  utm_campaign?: string | null
}

export async function createProject(input: CreateProjectInput): Promise<string> {
  const { data, error } = await db.from('video_projects').insert({
    channel_id: input.channel_id ?? null,
    niche:      input.niche ?? null,
    topic:      input.topic,
    title:      input.title ?? null,
    script:     input.script ?? null,
    language:   input.language,
    format:     input.format,
    status:     'draft',
    approved:   false,
    quality_enforced: false,
    quality_passed:   false,
    utm_campaign: input.utm_campaign ?? null,
  }).select('id').single()
  if (error || !data) throw new Error(`createProject faalde: ${error?.message}`)
  // utm_content-conventie: 'video:{id}' (sluit de omzet-attributie-loop).
  await db.from('video_projects').update({ utm_content: `video:${data.id}` }).eq('id', data.id)
  return data.id as string
}

export async function writeScenes(projectId: string, scenes: SceneSpec[]): Promise<number> {
  if (scenes.length === 0) return 0
  const rows = scenes.map((s) => ({
    project_id:        projectId,
    idx:               s.idx,
    voice_text:        s.voice_text,
    visual_intent:     s.visual_intent,
    search_query:      s.search_query,
    shot_type:         s.shot_type,
    emotion:           s.emotion,
    pacing:            s.pacing,
    music_intensity:   s.music_intensity,
    caption_text:      s.caption_text,
    expected_duration: s.expected_duration,
  }))
  const { error } = await db.from('video_scenes').insert(rows)
  if (error) throw new Error(`writeScenes faalde: ${error.message}`)
  return rows.length
}

export interface AudioAssetInput {
  provider: string
  url: string | null
  language: string
  duration?: number | null
  scores?: Record<string, unknown>
  final_score?: number | null
}

export async function writeVoiceAsset(projectId: string, a: AudioAssetInput): Promise<void> {
  const { error } = await db.from('audio_assets').insert({
    project_id: projectId,
    kind:       'voice',
    provider:   a.provider,
    url:        a.url,
    language:   a.language,
    duration:   a.duration ?? null,
    scores:     a.scores ?? {},
    final_score: a.final_score ?? null,
  })
  if (error) throw new Error(`writeVoiceAsset faalde: ${error.message}`)
}

/**
 * Zet de project-status. Weigert hard elke status die upload/approval zou
 * impliceren — de garantie "geen upload, geen auto-approve" zit hier afgedwongen.
 */
export async function setStatus(projectId: string, status: WriterStatus, reason?: string | null): Promise<void> {
  if (FORBIDDEN_STATUSES.has(status as string)) {
    throw new Error(`setStatus geweigerd: '${status}' is buiten de spine-writer (upload/approval verboden)`)
  }
  const patch: Record<string, unknown> = { status }
  if (reason !== undefined) patch.rework_reason = reason
  const { error } = await db.from('video_projects').update(patch).eq('id', projectId)
  if (error) throw new Error(`setStatus faalde: ${error.message}`)
}

/** Veiligheidscheck: bewijst dat dit project NIET in de upload-queue zit. */
export async function assertNoQueue(projectId: string): Promise<boolean> {
  const { data } = await db.from('video_projects').select('queue_id').eq('id', projectId).single()
  return !data?.queue_id
}
