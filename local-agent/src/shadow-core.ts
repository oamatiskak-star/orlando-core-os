import './ws-shim'   // MOET eerst — zet global WebSocket vóór elke @supabase-import
import path from 'path'
import os from 'os'
import { generateContent } from './lib/ai'
import { buildDataBundle } from './lib/financial-data-fetch'
import { buildAquierPromoBundle } from './lib/aquier-promo'
import { attachChartsToProject } from './lib/chart-intelligence'
import { planScenes, SceneSpec } from './lib/scene-planner'
import { synthVoice } from './lib/audio'
import { sourceVisualsForProject } from './lib/visual-intelligence'
import { selectMusic } from './lib/music-intelligence'
import { generateThumbnails } from './lib/thumbnail-intelligence'
import { renderProject } from './lib/render'
import { renderRemotionExplainer, remotionAvailable } from './lib/remotion-render'
import { generateSubtitles } from './lib/subtitles'
import { cleanForSpeech, cleanTitle } from './lib/script-clean'
import { assessQuality } from './quality-assess'
import { loadChannelStrategy } from './lib/channel-strategy'
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
  renderEngine?:  string | null   // 'remotion' → high-end motion-graphic render i.p.v. ffmpeg news-desk
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

/**
 * LOOP-SHORT (productie-type 'loops_short' — entertainment/satisfying-kanalen).
 * Eén naadloze, loopende satisfying-clip + muziek + korte on-screen hook. GEEN script/voice/
 * ondertiteling (dat is de narrated-keten). Eigen flow zodat de narrated-keten ongemoeid blijft.
 */
async function runLoopShort(o: ShadowOpts): Promise<ShadowResult> {
  const strategy = await loadChannelStrategy(o.channelId)
  // 1. Minimale metadata (titel + korte hook-overlay), geen narratie.
  const content = await generateContent({
    channel_name: strategy?.niche ?? o.niche ?? 'Loops',
    topic: o.topic, video_type: 'short', language: o.language, style: 'satisfying',
    target_seconds: o.targetSeconds, ollama_model: o.ollamaModel, lm_studio_model: o.lmStudioModel,
    format_profile: 'loops_short', data_bundle: null,
    channel_topics: strategy?.topics ?? [], own_cta_options: strategy?.own_cta ?? [],
  })
  content.title = cleanTitle(content.title) || o.topic

  const projectId = await spine.createProject({
    channel_id: o.channelId ?? null, niche: o.niche ?? null, topic: o.topic,
    title: content.title, script: '', language: o.language, format: o.format,
  })

  // 2. Eén loopende scene: satisfying-zoekterm uit de kanaal-niche + korte hook-overlay.
  const topic0 = (strategy?.topics ?? [])[0]
  const q = topic0 ? `oddly satisfying ${topic0}` : 'oddly satisfying seamless loop'
  const hook = cleanForSpeech(content.hook || content.title).split(/\s+/).slice(0, 5).join(' ')
  const scene: SceneSpec = {
    idx: 1, voice_text: '', visual_intent: q, search_query: q, shot_type: 'loop',
    emotion: 'satisfying', pacing: 'slow', music_intensity: 'low',
    caption_text: hook, expected_duration: o.targetSeconds,
  }
  const sceneCount = await spine.writeScenes(projectId, [scene])
  await spine.setStatus(projectId, 'production_ready')

  // 3. Visual (de satisfying clip), muziek, thumbnail. Geen voice.
  let vis: Awaited<ReturnType<typeof sourceVisualsForProject>>
  try { vis = await sourceVisualsForProject(projectId, o.format) }
  catch (e: any) { vis = { blockedReason: `visual_error: ${(e?.message ?? e).toString().slice(0, 120)}`, sceneCount: 0, assetsSelected: 0, belowThreshold: 0, lowConfidence: 0 } }
  const mus = await selectMusic(projectId)
  const thumb = await generateThumbnails(projectId, o.format)

  // 4. Render: clip loopen + muziek (renderProject haalt het muziek-asset zelf op), geen voice/subs.
  let renderUrl: string | null = null
  let renderBlocked: string | null = null
  if (vis.assetsSelected > 0) {
    try { const r = await renderProject({ projectId, format: o.format, voicePath: null, pacing: true }); renderUrl = r.outputPath }
    catch (e: any) { renderBlocked = `blocked_render_failed: ${(e?.message ?? e).toString().slice(0, 220)}` }
  } else { renderBlocked = 'blocked_no_visual_assets' }

  // 5. QC (entertainment-rubric). Muziek-gate blokkeert NIET (silent loop is acceptabel).
  const qc = await assessQuality(projectId)
  const reasons = [vis.blockedReason, thumb.blockedReason, renderBlocked,
    qc.ok ? (qc.gate_passed ? null : qc.gate_reason) : qc.blocked].filter(Boolean).join('; ')
  let status: spine.WriterStatus
  if (reasons) { status = 'rework_required'; await spine.setStatus(projectId, status, reasons) }
  else { status = 'awaiting_approval'; await spine.setStatus(projectId, status, null) }
  const noQueue = await spine.assertNoQueue(projectId)
  return {
    projectId, title: content.title, sceneCount, voiceProvider: null,
    visualsSelected: vis.assetsSelected, musicScore: mus.selectedScore, thumbnailVariants: thumb.variants,
    renderUrl, cqi: qc.cqi ?? null, gatePassed: qc.gate_passed ?? false, status, reasons: reasons || null, noQueue,
  }
}

export async function runShadowTopic(o: ShadowOpts): Promise<ShadowResult> {
  // Loop-short heeft een eigen, voice-loze flow.
  if (o.formatProfile === 'loops_short') return runLoopShort(o)
  // 0. Databundel voor het profiel: finance → FMP-marktdata; aquier_promo → Aquier-productbundel
  //    (wat Aquier doet + uitgelicht product + WERKENDE Stripe-link). Anders null.
  const promo = o.formatProfile === 'aquier_promo' ? await buildAquierPromoBundle(null, 0, o.language) : null
  const dataBundle = o.formatProfile === 'us_finance_longform'
    ? await buildDataBundle(o.dataSymbols ?? [])
    : (promo ? promo.bundleText : null)

  // CF2-repair: kanaal-strategie laden (niche/topics/own_cta) zodat de generatie niche-conform is.
  const strategy = await loadChannelStrategy(o.channelId)

  // 1. Script (lokale LLM, ai.ts) — data-explainer-tak bij format-profiel + niche-strategy
  const content = await generateContent({
    channel_name:    strategy?.niche ?? o.niche ?? 'Aquier',
    topic:           o.topic,
    video_type:      o.format === '9:16' ? 'short' : 'longform',
    language:        o.language,
    style:           'documentary',
    target_seconds:  o.targetSeconds,
    ollama_model:    o.ollamaModel,
    lm_studio_model: o.lmStudioModel,
    format_profile:  o.formatProfile ?? null,
    data_bundle:     dataBundle,
    channel_topics:  strategy?.topics ?? [],
    own_cta_options: strategy?.own_cta ?? [],
  })

  // 1b. Content-cleanup (kwaliteit-gate): strip regie-aanwijzingen/markdown/timecodes/labels
  //     uit het script vóór alles. Hetzelfde schone script gaat naar de DB, de scene-planner
  //     ÉN de TTS — zo lekt er nooit "(0:00-0:20) HOOK" of **vet** in stem of beeld.
  const cleanScript = cleanForSpeech(content.full_script)
  content.title = cleanTitle(content.title) || content.title

  // 2. Spine: project (status 'draft')
  const projectId = await spine.createProject({
    channel_id: o.channelId ?? null,
    niche:      o.niche ?? null,
    topic:      o.topic,
    title:      content.title,
    script:     cleanScript,
    language:   o.language,
    format:     o.format,
  })

  // 3. Scenes (scene-planner) → video_scenes
  const scenes = await planScenes({
    full_script:     cleanScript,
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

  // 4. Voice — premium bij finance-profiel OF bij publicatie (CF2_PUBLISH=1): credibele stem
  //    die de QC voice-gate (>=95) haalt. Anders shadow (lokaal/gratis). Premium escaleert
  //    naar OpenAI/ElevenLabs; zonder premium-key valt het terug op lokaal (gemarkeerd).
  const audioPath = path.join(os.tmpdir(), `cf2-voice-${projectId}.mp3`)
  const premiumProfile = o.formatProfile === 'us_finance_longform' || o.formatProfile === 'aquier_promo'
  const voiceMode = (premiumProfile || process.env.CF2_PUBLISH === '1') ? 'premium' : 'shadow'
  const voiceRes = await synthVoice(cleanScript, audioPath, {
    voice: o.voice, mode: voiceMode, language: o.language,
  })
  await spine.writeVoiceAsset(projectId, {
    provider: voiceRes.provider ?? 'none',
    url:      voiceRes.outputPath,
    language: o.language,
    scores:   voiceRes.gateReason ? { gate_reason: voiceRes.gateReason } : {},
    final_score: null,
  })

  // 6. Visual Intelligence (FASE A) — echte Pexels/Pixabay; geen key → blocked, geen fakes.
  //    Defensief: een API-fout (400/rate-limit) mag de productie niet killen; charts (6b)
  //    kunnen dan alsnog beeld leveren voor de data-explainer.
  let vis: Awaited<ReturnType<typeof sourceVisualsForProject>>
  try { vis = await sourceVisualsForProject(projectId, o.format) }
  catch (e: any) { vis = { blockedReason: `visual_error: ${(e?.message ?? e).toString().slice(0, 120)}`, sceneCount: 0, assetsSelected: 0, belowThreshold: 0, lowConfidence: 0 } }

  // 6b. Chart Intelligence — finance-profiel: echte FMP-data-charts als scene-visual
  //     (no-op zonder FMP-key). Overschrijft generieke stock op data-beat scenes.
  const charts = o.formatProfile === 'us_finance_longform'
    ? await attachChartsToProject(projectId, o.format, o.dataSymbols ?? [])
    : { chartsAttached: 0, reason: null as string | null }

  // 7. Music Intelligence (FASE F) — licensed catalogus; geen bron → blocked_missing_music_source
  const mus = await selectMusic(projectId)

  // 8. Thumbnail Intelligence (FASE E) — ≥3 echte varianten; geen visuals → blocked
  const thumb = await generateThumbnails(projectId, o.format)

  // 8b. Synchrone ondertiteling — whisper-SRT uit de échte voicetrack (lokaal, geen API).
  //     Geen whisper/model → null → render valt terug op legacy per-scene caption.
  let subtitlePath: string | null = null
  if (voiceRes.outputPath) {
    const subBase = path.join(os.tmpdir(), `cf2-subs-${projectId}`)
    const sub = await generateSubtitles(voiceRes.outputPath, subBase, {
      language: o.language,
      brand: o.formatProfile === 'aquier_promo' ? 'aquier' : undefined,
    })
    subtitlePath = sub.srtPath
    if (!sub.srtPath) console.warn(`subtitles: ${sub.reason} → legacy per-scene caption`)
  }

  // 9. Render — Remotion (high-end motion-graphic) als renderEngine='remotion', anders de
  //    ffmpeg news-desk. Remotion heeft GEEN stock-assets nodig (captions op bewegende gradient).
  let renderUrl: string | null = null
  let renderBlocked: string | null = null
  const renderableAssets = vis.assetsSelected + charts.chartsAttached
  const useRemotion = o.renderEngine === 'remotion' && !!voiceRes.outputPath && remotionAvailable()
  if (useRemotion) {
    try {
      const out = renderRemotionExplainer({
        projectId, voicePath: voiceRes.outputPath!, srtPath: subtitlePath,
        title: content.title, outro: content.cta || strategy?.own_cta?.[0] || '',
        stats: content.stats || [],
      })
      await spine.setRenderUrl(projectId, out)
      renderUrl = out
    } catch (e: any) { renderBlocked = `blocked_remotion_failed: ${(e?.message ?? e).toString().slice(0, 220)}` }
  } else if (renderableAssets > 0 && voiceRes.outputPath) {
    try {
      const r = await renderProject({ projectId, format: o.format, voicePath: voiceRes.outputPath, musicPath: null, pacing: !!o.formatProfile, subtitlePath })
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
