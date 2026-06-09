import './ws-shim'   // MOET eerst — zet global WebSocket vóór elke @supabase-import
import 'dotenv/config'
import path from 'path'
import os from 'os'
import { generateContent } from './lib/ai'
import { planScenes } from './lib/scene-planner'
import { synthVoice } from './lib/audio'
import { sourceVisualsForProject } from './lib/visual-intelligence'
import { selectMusic } from './lib/music-intelligence'
import { generateThumbnails } from './lib/thumbnail-intelligence'
import { renderProject } from './lib/render'
import { assessQuality } from './quality-assess'
import { runPreflight } from './preflight'
import * as spine from './lib/video-projects'

/**
 * VIDEO-PROJECTS RUNNER (Content Factory 2.0 — FASE 2, shadow).
 *
 * Draait ÉÉN shadow-topic door: content → scenes → spine-write → voice (router,
 * lokaal). Visual = echte Pexels in de volgende slice; zonder PEXELS_API_KEY
 * wordt visual gemarkeerd als `blocked_missing_pexels_key` (GEEN fake clips).
 *
 * Harde garanties: geen upload, geen auto-approve, geen youtube_upload_queue.
 * Alleen handmatig/controlled te starten (geen loop, geen Planner-trigger tot
 * er shadow-bewijs is).
 */

export interface ShadowOpts {
  channelId?:    string | null
  niche?:        string | null
  topic:         string
  language:      string
  format:        '16:9' | '9:16' | '1:1'
  voice:         string
  targetSeconds: number
  lmStudioModel: string
  ollamaModel:   string
}

export interface ShadowResult {
  projectId:        string
  title:            string
  sceneCount:       number
  voiceProvider:    string | null
  visualsSelected:  number
  musicScore:       number | null
  thumbnailVariants: number
  renderUrl:        string | null
  cqi:              number | null
  gatePassed:       boolean
  status:           spine.WriterStatus
  reasons:          string | null
  noQueue:          boolean
}

export async function runShadowTopic(o: ShadowOpts): Promise<ShadowResult> {
  // 1. Script (lokale LLM, ai.ts)
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

  // 2. Spine: project (status 'draft')
  const projectId = await spine.createProject({
    channel_id: o.channelId ?? null,
    niche:      o.niche ?? null,
    topic:      o.topic,
    title:      content.title,
    script:     content.full_script,
    language:   o.language,
    format:     o.format,
  })

  // 3. Scenes (scene-planner) → video_scenes
  const scenes = await planScenes({
    full_script:     content.full_script,
    title:           content.title,
    language:        o.language,
    format:          o.format,
    target_seconds:  o.targetSeconds,
    lm_studio_model: o.lmStudioModel,
    ollama_model:    o.ollamaModel,
  })
  const sceneCount = await spine.writeScenes(projectId, scenes)
  await spine.setStatus(projectId, 'production_ready')

  // 4. Voice (router, shadow = lokaal/gratis)
  const audioPath = path.join(os.tmpdir(), `cf2-voice-${projectId}.mp3`)
  const voiceRes = await synthVoice(content.full_script, audioPath, {
    voice: o.voice, mode: 'shadow', language: o.language,
  })
  await spine.writeVoiceAsset(projectId, {
    provider: voiceRes.provider ?? 'none',
    url:      voiceRes.outputPath,
    language: o.language,
    scores:   voiceRes.gateReason ? { gate_reason: voiceRes.gateReason } : {},
    final_score: null,
  })

  // 6. Visual Intelligence (FASE A) — echte Pexels/Pixabay; geen key → blocked, geen fakes
  const vis = await sourceVisualsForProject(projectId, o.format)

  // 7. Music Intelligence (FASE F) — licensed catalogus; geen bron → blocked_missing_music_source
  const mus = await selectMusic(projectId)

  // 8. Thumbnail Intelligence (FASE E) — ≥3 echte varianten; geen visuals → blocked
  const thumb = await generateThumbnails(projectId, o.format)

  // 9. Render (FASE B) — alleen met echte assets; anders blocked (geen fake render)
  let renderUrl: string | null = null
  let renderBlocked: string | null = null
  if (vis.assetsSelected > 0 && voiceRes.outputPath) {
    try {
      const r = await renderProject({ projectId, format: o.format, voicePath: voiceRes.outputPath, musicPath: null })
      renderUrl = r.outputPath
    } catch (e: any) { renderBlocked = 'blocked_render_failed' }
  } else {
    renderBlocked = vis.assetsSelected === 0 ? 'blocked_no_visual_assets' : 'blocked_no_voice'
  }

  // 10. QC (FASE C/G) — canonieke frontend-route schrijft youtube_quality_scores + gate
  const qc = await assessQuality(projectId)

  // Status — elke open gate → rework_required + reden. NOOIT upload/approve/queue.
  const reasons = [
    voiceRes.gateReason,
    vis.blockedReason,
    mus.blockedReason,
    thumb.blockedReason,
    renderBlocked,
    qc.ok ? (qc.gate_passed ? null : qc.gate_reason) : qc.blocked,
  ].filter(Boolean).join('; ')

  let status: spine.WriterStatus
  if (reasons) {
    status = 'rework_required'
    await spine.setStatus(projectId, status, reasons)
  } else {
    status = 'awaiting_approval'   // alle gates groen; menselijke approval volgt (buiten deze runner)
    await spine.setStatus(projectId, status, null)
  }

  const noQueue = await spine.assertNoQueue(projectId)
  return {
    projectId, title: content.title, sceneCount,
    voiceProvider: voiceRes.provider,
    visualsSelected: vis.assetsSelected, musicScore: mus.selectedScore,
    thumbnailVariants: thumb.variants, renderUrl,
    cqi: qc.cqi ?? null, gatePassed: qc.gate_passed ?? false,
    status, reasons: reasons || null, noQueue,
  }
}

// ── CLI: handmatig/controlled, geen loop ─────────────────────────────────────
//   node dist/video-projects-runner.js --topic "..." [--niche vastgoed] [--lang nl] [--format 16:9]
if (require.main === module) {
  const arg = (k: string, d: string): string => {
    const i = process.argv.indexOf(`--${k}`)
    return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : d
  }
  const topic = arg('topic', '')
  if (!topic) {
    console.error('Gebruik: --shadow --topic "..." [--niche ..] [--lang nl|en|es] [--format 16:9|9:16|1:1] [--seconds 60]')
    process.exit(1)
  }
  // PREFLIGHT-GATE: geen record-producerende run zonder runtime. BLOCKED_* → stop,
  // GEEN DB-writes, GEEN fake records.
  runPreflight().then((pf) => {
    if (!pf.ok) {
      console.log('PREFLIGHT:', JSON.stringify(pf, null, 2))
      console.error(`SHADOW-RUN GEBLOKKEERD (preflight): ${pf.blocked.join(', ')} — geen records geproduceerd, geen fakes.`)
      process.exit(2)
    }
    return runShadowTopic({
      topic,
      niche:         arg('niche', 'vastgoed'),
      language:      arg('lang', 'nl'),
      format:        arg('format', '16:9') as '16:9' | '9:16' | '1:1',
      voice:         arg('voice', 'nl-NL-ColetteNeural'),
      targetSeconds: Number(arg('seconds', '60')),
      lmStudioModel: process.env.LM_STUDIO_MODEL || 'default',
      ollamaModel:   process.env.OLLAMA_MODEL || 'llama3.2',
    }).then((r) => { console.log('SHADOW-RESULT:', JSON.stringify(r, null, 2)); process.exit(0) })
  }).catch((e) => { console.error('SHADOW-FOUT:', e?.message ?? e); process.exit(1) })
}
