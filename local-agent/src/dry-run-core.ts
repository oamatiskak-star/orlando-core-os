// dry-run-core.ts — CF2 generatie-helft ZONDER DB/env/service_role.
// Importeert UITSLUITEND ai + scene-planner (geen @supabase, geen DB-modules).
// Bewijst: topic → script → scenes. Dit is GEEN CF2 PASS.
import { generateContent } from './lib/ai'
import { planScenes, type SceneSpec } from './lib/scene-planner'

export interface DryRunOpts {
  topic: string
  niche?: string
  language: string
  format: '16:9' | '9:16' | '1:1'
  targetSeconds: number
  lmStudioModel: string
  ollamaModel: string
}

export interface DryRunResult {
  dry_run: true
  title: string
  hook: string
  scene_count: number
  scenes: SceneSpec[]
  model_used: string
  validation_status: 'valid' | 'invalid'
  validation_errors: string[]
}

export async function runDryRun(o: DryRunOpts): Promise<DryRunResult> {
  const useLm = process.env.USE_LM_STUDIO !== 'false'
  const model_used = useLm ? `${o.lmStudioModel} (lm-studio)` : `${o.ollamaModel} (ollama)`

  const content = await generateContent({
    channel_name:    o.niche ?? 'Aquier',
    topic:           o.topic,
    video_type:      o.format === '9:16' ? 'short' : 'longform',
    language:        o.language,
    style:           'documentary',
    target_seconds:  o.targetSeconds,
    ollama_model:    o.ollamaModel,
    lm_studio_model: o.lmStudioModel,
  })

  const scenes = await planScenes({
    full_script:     content.full_script,
    title:           content.title,
    language:        o.language,
    format:          o.format,
    target_seconds:  o.targetSeconds,
    lm_studio_model: o.lmStudioModel,
    ollama_model:    o.ollamaModel,
  })

  // Schema-validatie: scenes moeten matchen op de video_scenes-vorm (geen DB nodig).
  const errors: string[] = []
  if (scenes.length === 0) errors.push('geen scenes gegenereerd')
  scenes.forEach((s, i) => {
    if (!s.voice_text) errors.push(`scene ${i + 1}: lege voice_text`)
    if (!s.search_query) errors.push(`scene ${i + 1}: lege search_query`)
    if (!(s.expected_duration > 0)) errors.push(`scene ${i + 1}: ongeldige expected_duration`)
  })

  return {
    dry_run: true,
    title: content.title,
    hook: content.hook,
    scene_count: scenes.length,
    scenes,
    model_used,
    validation_status: errors.length === 0 ? 'valid' : 'invalid',
    validation_errors: errors,
  }
}
