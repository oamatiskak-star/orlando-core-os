import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateText } from 'ai'
import { claude } from '@/lib/ai/client'

export const runtime = 'nodejs'

/**
 * QUALITY CONTROL — CQI ASSESS (Content Factory 2.0 — FASE C).
 *
 * Eén orchestrator die de 9 QC-agenten als dimensies draait voor één
 * video_project en de uitkomst naar `youtube_quality_scores` schrijft:
 *  1 Hook · 2 Thumbnail · 3 Retention · 4 Visual · 5 Voice · 6 Music · 7 CTA
 *  8 Content-Reject · 9 CQI (aggregaat).
 *
 * - Tekst-dimensies (hook/retention/cta/title + content-reject) → claude.sonnet.
 * - Visual = deterministische score uit visual_assets (FASE A).
 * - Voice  = provider-tier uit audio_assets (local <95 → gate).
 * - Thumbnail/Music = nog geen engine → 'pending' (blokkeert de gate bewust).
 *
 * Drempels: hook/thumbnail/retention/music/cta ≥90, voice ≥95, visual ≥85, CQI ≥90.
 * Schrijft NOOIT approved/upload_ready en raakt youtube_upload_queue NIET aan —
 * upload blijft onmogelijk. Status hooguit → 'quality_checked'.
 */

const THRESHOLDS = { hook: 90, thumbnail: 90, retention: 90, visual: 85, voice: 95, music: 90, cta: 90, cqi: 90 }

type LlmScores = {
  hook_score: number
  retention_prediction: number
  cta_score: number
  title_score: number
  content_reject: { reject: boolean; reasons: string[] }
}

function clamp(n: unknown): number { const v = Number(n); return Number.isFinite(v) ? Math.min(100, Math.max(0, Math.round(v))) : 0 }

export async function POST(req: NextRequest) {
  const { video_project_id } = await req.json()
  if (!video_project_id) return NextResponse.json({ error: 'video_project_id required' }, { status: 400 })

  const admin = createAdminClient()

  const { data: project } = await admin.from('video_projects')
    .select('id, channel_id, title, topic, script, niche, language, format').eq('id', video_project_id).single()
  if (!project) return NextResponse.json({ error: 'project niet gevonden' }, { status: 404 })

  const { data: scenes } = await admin.from('video_scenes')
    .select('idx, voice_text, visual_intent, caption_text').eq('project_id', video_project_id).order('idx')
  const openingScript = (scenes ?? []).slice(0, 4).map((s) => s.voice_text).filter(Boolean).join(' ')

  // ── Visual (FASE A): gemiddelde deterministische score van geselecteerde assets ──
  const { data: vAssets } = await admin.from('visual_assets')
    .select('final_visual_score').eq('project_id', video_project_id).not('final_visual_score', 'is', null)
  const visual_score = (vAssets && vAssets.length)
    ? Math.round(vAssets.reduce((s, a) => s + (a.final_visual_score ?? 0), 0) / vAssets.length) : 0

  // ── Voice: provider-tier uit audio_assets ──
  const { data: voice } = await admin.from('audio_assets')
    .select('provider, final_score, scores').eq('project_id', video_project_id).eq('kind', 'voice')
    .order('created_at', { ascending: false }).limit(1).maybeSingle()
  const voiceGate = (voice?.scores as any)?.gate_reason ?? null
  const premiumVoice = voice?.provider === 'elevenlabs' || voice?.provider === 'openai_tts'
  const voice_score = voice ? (premiumVoice ? clamp(voice.final_score ?? 96) : 80) : 0

  // ── Thumbnail / Music: nog geen engine → pending (blokkeert de gate bewust) ──
  const thumbPending = true   // FASE: thumbnail-engine volgt
  const musicPending = true   // FASE: music-engine volgt
  const thumbnail_score = 0
  const music_score = 0

  // ── LLM-dimensies (tekst) ──
  let llm: LlmScores = { hook_score: 0, retention_prediction: 0, cta_score: 0, title_score: 0, content_reject: { reject: true, reasons: ['llm_unavailable'] } }
  const prompt = `Je bent een panel van YouTube-kwaliteitsexperts voor een Nederlands financieel/vastgoed-netwerk. Optimaliseer voor OMZET (kijker → Aquier), niet enkel views. Geef ALLEEN geldige JSON terug.

TITEL: "${project.title ?? project.topic}"
NICHE: "${project.niche ?? ''}"  TAAL: ${project.language}
OPENING (eerste ~15s voice-over): "${openingScript || '(geen)'}"
AANTAL SCENES: ${(scenes ?? []).length}

Scoor 0-100 per dimensie:
- hook_score: kracht eerste 3/10/30s (curiosity/urgency/authority/controversy/greed/fear/surprise/exclusivity)
- retention_prediction: vasthoudkracht 0-3s/3-7s/7-15s (geen saaie AI-opening)
- cta_score: eindigt het met een logische stap naar Aquier (dealcheck/adresscan/financieringsscan/rapport/Mandaat) i.p.v. "like&subscribe"
- title_score: concreet/getal/spanning/persoonlijk
- content_reject: reject=true bij generieke/AI-klinkende/herhalende/lage-nieuwsgierigheid content; geef reasons[]

{"hook_score":<n>,"retention_prediction":<n>,"cta_score":<n>,"title_score":<n>,"content_reject":{"reject":<bool>,"reasons":[<string>]}}`

  try {
    const { text } = await generateText({ model: claude.sonnet, maxOutputTokens: 500, messages: [{ role: 'user', content: prompt }] })
    const raw = text.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim()
    const p = JSON.parse(raw)
    llm = {
      hook_score: clamp(p.hook_score), retention_prediction: clamp(p.retention_prediction),
      cta_score: clamp(p.cta_score), title_score: clamp(p.title_score),
      content_reject: { reject: !!p?.content_reject?.reject, reasons: Array.isArray(p?.content_reject?.reasons) ? p.content_reject.reasons : [] },
    }
  } catch (e) {
    return NextResponse.json({ error: 'QC-assessment faalde (LLM)' }, { status: 502 })
  }

  // ── CQI (aggregaat over beschikbare dimensies) ──
  const dims = { hook: llm.hook_score, thumbnail: thumbnail_score, retention: llm.retention_prediction, visual: visual_score, voice: voice_score, music: music_score, cta: llm.cta_score }
  const cqi = Math.round(Object.values(dims).reduce((s, v) => s + v, 0) / Object.values(dims).length)

  // ── Gate (Content-Reject Agent) ──
  const reasons: string[] = []
  if (llm.hook_score < THRESHOLDS.hook) reasons.push(`hook<${THRESHOLDS.hook}`)
  if (thumbPending) reasons.push('thumbnail_pending'); else if (thumbnail_score < THRESHOLDS.thumbnail) reasons.push(`thumbnail<${THRESHOLDS.thumbnail}`)
  if (llm.retention_prediction < THRESHOLDS.retention) reasons.push(`retention<${THRESHOLDS.retention}`)
  if (visual_score < THRESHOLDS.visual) reasons.push(`visual<${THRESHOLDS.visual}`)
  if (voice_score < THRESHOLDS.voice) reasons.push(voiceGate || `voice<${THRESHOLDS.voice}`)
  if (musicPending) reasons.push('music_pending'); else if (music_score < THRESHOLDS.music) reasons.push(`music<${THRESHOLDS.music}`)
  if (llm.cta_score < THRESHOLDS.cta) reasons.push(`cta<${THRESHOLDS.cta}`)
  if (cqi < THRESHOLDS.cqi) reasons.push(`cqi<${THRESHOLDS.cqi}`)
  if (llm.content_reject.reject) reasons.push(...llm.content_reject.reasons.map((r) => `reject:${r}`))

  const gate_passed = reasons.length === 0
  const gate_reason = gate_passed ? null : reasons.join('; ')

  await admin.from('youtube_quality_scores').insert({
    video_project_id, channel_id: project.channel_id ?? null,
    title_score: llm.title_score, hook_score: llm.hook_score, thumbnail_score,
    visual_score, voice_score, music_score, retention_prediction: llm.retention_prediction,
    cta_score: llm.cta_score, content_quality_index: cqi, total_score: cqi,
    verdict: gate_passed ? 'publish' : (cqi >= 50 ? 'improve' : 'reject'),
    dimension_verdicts: dims, gate_passed, gate_reason,
    feedback: { content_reject: llm.content_reject },
  })

  // Status hooguit → quality_checked. NOOIT approved/upload_ready. Queue ongemoeid.
  await admin.from('video_projects').update({
    status: 'quality_checked', quality_passed: gate_passed,
    rework_reason: gate_passed ? null : gate_reason,
  }).eq('id', video_project_id)

  return NextResponse.json({ ok: true, video_project_id, cqi, gate_passed, gate_reason, dimensions: dims })
}
