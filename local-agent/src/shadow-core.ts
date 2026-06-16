import './ws-shim'   // MOET eerst — zet global WebSocket vóór elke @supabase-import
import path from 'path'
import os from 'os'
import { generateContent } from './lib/ai'
import { buildDataBundle } from './lib/financial-data-fetch'
import { attachChartsToProject } from './lib/chart-intelligence'
import { planScenes } from './lib/scene-planner'
import { synthVoice } from './lib/audio'
import { sourceVisualsForProject } from './lib/visual-intelligence'
import { selectMusic } from './lib/music-intelligence'
import { generateThumbnails } from './lib/thumbnail-intelligence'
import { renderProject } from './lib/render'
import { assessQuality } from './quality-assess'
import * as spine from './lib/video-projects'

/**
 * SHADOW-CORE (Content Factory 2.0 — FASE 2, record-producerende keten).
 *
 * topic → content → scenes → spine-write → voice → visual → music → thumbnail →
 * render → QC. Schrijft naar de CF2-DB (vereist Supabase service-role env; de
 * runner draait preflight VÓÓR dit wordt geïmporteerd). Harde garanties: geen
 * upload, geen auto-approve, geen youtube_upload_queue. Apart van de --dry-run
 * (die deze module NIET importeert, dus geen Supabase-client initialiseert).
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
  formatProfile?: string | null   // bv. 'us_finance_longform' → data-explainer + FMP-data
  dataSymbols?:   string[]         // tickers voor de FMP-databundel (bv. ['^GSPC','AAPL'])
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
  // 0. Echte marktdata ophalen voor het data-explainer-profiel (graceful: null zonder FMP-key)
  const dataBundle = o.formatProfile === 'us_finance_longform'
    ? await buildDataBundle(o.dataSymbols ?? [])
    : null

  // 1. Script (lokale LLM, ai.ts) — data-explainer-tak bij format-profiel
  const content = await generateContent({
    channel_name:    o.niche ?? 'Aquier',
    topic:           o.topic,
    video_type:      o.format === '9:16' ? 'short' : 'longform',
    language:        o.language,
    style:           'documentary',
    target_seconds:  o.targetSeconds,
    ollama_model:    o.ollamaModel,
    lm_studio_model: o.lmStudioModel,
    format_profile:  o.formatProfile ?? null,
    data_bundle:     dataBundle,
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
    niche:           o.niche ?? null,
    lm_studio_model: o.lmStudioModel,
    ollama_model:    o.ollamaModel,
  })
  const sceneCount = await spine.writeScenes(projectId, scenes)
  await spine.setStatus(projectId, 'production_ready')

  // 4. Voice — finance-profiel = premium (credibele stem; anti-slop + autoriteit).
  //    Overige kanalen blijven shadow (lokaal/gratis). Premium escaleert naar
  //    elevenlabs/openai; zonder premium-key valt het terug op lokaal (gemarkeerd).
  const audioPath = path.join(os.tmpdir(), `cf2-voice-${projectId}.mp3`)
  const voiceMode = o.formatProfile === 'us_finance_longform' ? 'premium' : 'shadow'
  const voiceRes = await synthVoice(content.full_script, audioPath, {
    voice: o.voice, mode: voiceMode, language: o.language,
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

  // 6b. Chart Intelligence — finance-profiel: echte FMP-data-charts als scene-visual
  //     (no-op zonder FMP-key). Overschrijft generieke stock op data-beat scenes.
  const charts = o.formatProfile === 'us_finance_longform'
    ? await attachChartsToProject(projectId, o.format, o.dataSymbols ?? [])
    : { chartsAttached: 0, reason: null as string | null }

  // 7. Music Intelligence (FASE F) — licensed catalogus; geen bron → blocked_missing_music_source
  const mus = await selectMusic(projectId)

  // 8. Thumbnail Intelligence (FASE E) — ≥3 echte varianten; geen visuals → blocked
  const thumb = await generateThumbnails(projectId, o.format)

  // 9. Render (FASE B) — alleen met echte assets; anders blocked (geen fake render)
  let renderUrl: string | null = null
  let renderBlocked: string | null = null
  const renderableAssets = vis.assetsSelected + charts.chartsAttached
  if (renderableAssets > 0 && voiceRes.outputPath) {
    try {
      const r = await renderProject({ projectId, format: o.format, voicePath: voiceRes.outputPath, musicPath: null, pacing: !!o.formatProfile })
      renderUrl = r.outputPath
    } catch (e: any) { renderBlocked = `blocked_render_failed: ${(e?.message ?? e).toString().slice(0, 220)}` }
  } else {
    renderBlocked = renderableAssets === 0 ? 'blocked_no_visual_assets' : 'blocked_no_voice'
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
