import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateText } from 'ai'
import { claude } from '@/lib/ai/client'

export const runtime = 'nodejs'

/**
 * QUALITY CONTROL — CQI ASSESS (Content Factory 2.0 — FASE C).
 *
 * Eén orchestrator die de QC-dimensies draait voor één video_project en de uitkomst
 * naar `youtube_quality_scores` schrijft (hook/thumbnail/retention/visual/voice/music/cta/CQI).
 *
 * PER-KANAAL RUBRIC: de tekst-dimensies worden beoordeeld TEGEN de strategie van het
 * kanaal (channel_strategy: niche/topics/own_cta/content_rules.qc_profile/taal), NIET
 * hardcoded vastgoed. Profielen: 'vastgoed' (Aquier-conversie), 'finance' (autoriteit+data
 * → broker/nieuwsbrief), 'entertainment' (satisfying/loops → retentie/loopability/YPP),
 * 'generic'. Geen qc_profile → afgeleid uit de niche. Zo zakt een entertainment- of
 * finance-kanaal niet meer op de vastgoed-bril.
 *
 * Drempels: hook/thumbnail/retention/music/cta ≥90, voice ≥95, visual ≥85, CQI ≥90.
 * Schrijft NOOIT approved/upload_ready en raakt youtube_upload_queue NIET aan.
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

/** Bepaalt het QC-profiel: expliciet (content_rules.qc_profile) of afgeleid uit de niche. */
function resolveProfile(qcProfile: string, niche: string): 'vastgoed' | 'finance' | 'entertainment' | 'generic' {
  const p = (qcProfile || '').toLowerCase()
  if (p === 'vastgoed' || p === 'finance' || p === 'entertainment' || p === 'generic') return p
  const n = (niche || '').toLowerCase()
  if (/vastgoed|woning|huur|hypothe|real ?estate|property/.test(n)) return 'vastgoed'
  if (/finance|beleg|crypto|spaar|vermogen|invest|stock|aandel|money|dividend/.test(n)) return 'finance'
  if (/satisf|loop|asmr|brick|cutting|mini-?world|oddly/.test(n)) return 'entertainment'
  return 'generic'
}

/** Bouwt de per-profiel QC-prompt. Alle profielen geven dezelfde JSON-vorm terug. */
function buildPrompt(opts: {
  profile: 'vastgoed' | 'finance' | 'entertainment' | 'generic'
  channelName: string; niche: string; language: string; ownCtas: string[]
  title: string; opening: string; sceneCount: number
}): string {
  const { profile, channelName, niche, language, ownCtas, title, opening, sceneCount } = opts
  const ctaList = ownCtas.length ? ownCtas.join(' | ') : ''
  const head = `TITEL: "${title}"\nKANAAL: "${channelName}"  NICHE: "${niche}"  TAAL: ${language}\nOPENING (eerste ~15s voice-over): "${opening || '(geen)'}"\nAANTAL SCENES: ${sceneCount}`
  const jsonSpec = `{"hook_score":<n>,"retention_prediction":<n>,"cta_score":<n>,"title_score":<n>,"content_reject":{"reject":<bool>,"reasons":[<string>]}}`

  if (profile === 'vastgoed') {
    return `Je bent een panel van YouTube-kwaliteitsexperts voor een Nederlands financieel/vastgoed-netwerk. Optimaliseer voor OMZET (kijker → Aquier), niet enkel views. Geef ALLEEN geldige JSON terug.

${head}

Scoor 0-100 per dimensie:
- hook_score: kracht eerste 3/10/30s (curiosity/urgency/authority/controversy/greed/fear/surprise/exclusivity)
- retention_prediction: vasthoudkracht 0-3s/3-7s/7-15s (geen saaie AI-opening)
- cta_score: eindigt het met een logische stap naar Aquier (${ctaList || 'dealcheck/adresscan/financieringsscan/rapport/Mandaat'}) i.p.v. "like&subscribe"
- title_score: concreet/getal/spanning/persoonlijk
- content_reject: reject=true bij generieke/AI-klinkende/herhalende/lage-nieuwsgierigheid content; geef reasons[]

${jsonSpec}`
  }

  if (profile === 'entertainment') {
    return `Je bent een panel van YouTube Shorts-kwaliteitsexperts voor het kanaal "${channelName}" — niche: ${niche} (satisfying/loops/ASMR/mini-world), taal: ${language}.
Doel van dit kanaal: maximale scroll-stop (0-3s), kijktijd + herhaalkijk (loopability) en deelbaarheid richting YouTube-monetisatie (YPP). Conversie/affiliate is NIET het doel.
Beoordeel STRIKT tegen dit doel en deze niche — NIET tegen vastgoed of finance. Geef ALLEEN geldige JSON terug.

${head}

Scoor 0-100 per dimensie:
- hook_score: stopt het scrollen in 0-3s (visuele intrige / satisfying-belofte / "wtf"-moment)
- retention_prediction: vasthoudkracht + naadloze loop (lokt herhaalkijk uit?)
- cta_score: een simpele "follow/subscribe for more" OF een sterke loop die herhaalkijk uitlokt telt als VOLDOENDE (geef ≥90 als er een passende end-card/loop is); straf NIET af voor het ontbreken van een verkoop-/conversie-CTA${ctaList ? ` (kanaal-CTA's: ${ctaList})` : ''}
- title_score: kort, intrigerend, past bij de satisfying-niche
- content_reject: reject=true ALLEEN bij echt generieke/lage-kwaliteit/off-niche content; NIET om taal of om ontbrekende conversie. geef reasons[]

${jsonSpec}`
  }

  if (profile === 'finance') {
    return `Je bent een panel van YouTube-kwaliteitsexperts voor het kanaal "${channelName}" — niche: ${niche}, taal: ${language}.
Doel van dit kanaal: autoriteit + concrete cijfers/data, hoge kijktijd, en doorklik naar ${ctaList || 'broker-link/nieuwsbrief'} → YouTube-monetisatie (YPP) + affiliate.
Beoordeel STRIKT tegen deze niche/taal/doel — NIET tegen vastgoed. Geef ALLEEN geldige JSON terug.

${head}

Scoor 0-100 per dimensie:
- hook_score: kracht eerste 3/10/30s met een concreet getal/cijfer/spanning (geen saaie AI-opening)
- retention_prediction: vasthoudkracht 0-3s/3-7s/7-15s; bouwt het een open loop?
- cta_score: eindigt met een passende stap voor DIT kanaal (een van: ${ctaList || 'broker-link/nieuwsbrief/rapport'}); straf NIET af voor het ontbreken van vastgoed-conversie
- title_score: concreet/getal/spanning/niche-relevant (geen generieke clickbait)
- content_reject: reject=true bij generieke/AI-klinkende content, off-niche t.o.v. "${niche}", of verkeerde taal (verwacht ${language}); geef reasons[]

${jsonSpec}`
  }

  // generic — niche/doel-gedreven, neutraal
  return `Je bent een panel van YouTube-kwaliteitsexperts voor het kanaal "${channelName}" — niche: ${niche}, taal: ${language}.
Beoordeel de video TEGEN deze niche en taal (NIET tegen vastgoed/finance tenzij dat de niche is). Geef ALLEEN geldige JSON terug.

${head}

Scoor 0-100 per dimensie:
- hook_score: kracht eerste 3/10/30s voor dit niche-publiek
- retention_prediction: vasthoudkracht (geen saaie AI-opening)
- cta_score: eindigt met een passende stap/end-card voor dit kanaal${ctaList ? ` (${ctaList})` : ''}; straf NIET af voor het ontbreken van een verkoop-CTA als de niche dat niet vraagt
- title_score: concreet/intrigerend/niche-relevant
- content_reject: reject=true bij generieke/AI-klinkende/off-niche content of verkeerde taal (verwacht ${language}); geef reasons[]

${jsonSpec}`
}

export async function POST(req: NextRequest) {
  const { video_project_id } = await req.json()
  if (!video_project_id) return NextResponse.json({ error: 'video_project_id required' }, { status: 400 })

  const admin = createAdminClient()

  const { data: project } = await admin.from('video_projects')
    .select('id, channel_id, title, topic, script, niche, language, format').eq('id', video_project_id).single()
  if (!project) return NextResponse.json({ error: 'project niet gevonden' }, { status: 404 })

  // ── Kanaal-strategie resolven (channel_strategy keyt op media_holding_channels.id;
  //    project.channel_id = youtube_channels.id → map via youtube_channel_id). ──
  let stratNiche = (project.niche ?? '') as string
  let stratLang = (project.language ?? 'en') as string
  let ownCtas: string[] = []
  let qcProfile = ''
  let channelName = ''
  if (project.channel_id) {
    const { data: mhc } = await admin.from('media_holding_channels')
      .select('id, name, niche, language').eq('youtube_channel_id', project.channel_id).maybeSingle()
    if (mhc) {
      channelName = (mhc.name as string) ?? ''
      stratNiche = (mhc.niche as string) ?? stratNiche
      stratLang = (mhc.language as string) ?? stratLang
      const { data: s } = await admin.from('channel_strategy')
        .select('niche, own_cta, content_rules').eq('channel_id', mhc.id).maybeSingle()
      if (s) {
        stratNiche = (s.niche as string) ?? stratNiche
        ownCtas = Array.isArray(s.own_cta) ? (s.own_cta as string[]) : []
        const rules = (s.content_rules ?? {}) as Record<string, unknown>
        qcProfile = (rules.qc_profile as string) ?? ''
        if (typeof rules.language === 'string') stratLang = rules.language
      }
    }
  }
  const profile = resolveProfile(qcProfile, stratNiche)

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

  // ── Thumbnail (FASE E): gekozen/hoogste variant uit thumbnail_variants ──
  const { data: thumbs } = await admin.from('thumbnail_variants')
    .select('thumbnail_score, chosen').eq('project_id', video_project_id)
    .order('thumbnail_score', { ascending: false })
  const thumbPending = !thumbs || thumbs.length === 0
  const chosenThumb = (thumbs ?? []).find((t) => t.chosen) ?? (thumbs ?? [])[0]
  const thumbnail_score = chosenThumb ? clamp(chosenThumb.thumbnail_score) : 0

  // ── Music (FASE F): laatste audio_assets(kind='music') ──
  const { data: music } = await admin.from('audio_assets')
    .select('final_score').eq('project_id', video_project_id).eq('kind', 'music')
    .order('created_at', { ascending: false }).limit(1).maybeSingle()
  const musicPending = !music
  const music_score = music ? clamp(music.final_score) : 0

  // ── LLM-dimensies (tekst) — per-kanaal rubric ──
  let llm: LlmScores = { hook_score: 0, retention_prediction: 0, cta_score: 0, title_score: 0, content_reject: { reject: true, reasons: ['llm_unavailable'] } }
  const prompt = buildPrompt({
    profile, channelName: channelName || (project.niche ?? 'kanaal'), niche: stratNiche, language: stratLang,
    ownCtas, title: (project.title ?? project.topic) as string, opening: openingScript, sceneCount: (scenes ?? []).length,
  })

  try {
    const { text } = await generateText({ model: claude.sonnet, maxOutputTokens: 1500, messages: [{ role: 'user', content: prompt }] })
    const raw = text.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim()
    const p = JSON.parse(raw)
    llm = {
      hook_score: clamp(p.hook_score), retention_prediction: clamp(p.retention_prediction),
      cta_score: clamp(p.cta_score), title_score: clamp(p.title_score),
      content_reject: { reject: !!p?.content_reject?.reject, reasons: Array.isArray(p?.content_reject?.reasons) ? p.content_reject.reasons : [] },
    }
  } catch (e) {
    console.error('QC LLM error:', (e as any)?.message ?? e, (e as any)?.responseBody ?? (e as any)?.cause ?? '')
    return NextResponse.json({ error: 'QC-assessment faalde (LLM)', detail: String((e as any)?.message ?? e).slice(0, 300) }, { status: 502 })
  }

  // Entertainment/loops: GEEN voice & geen spoken-CTA van toepassing (visuele loop + muziek).
  // Die dimensies zijn dan niet-blokkerend en tellen niet mee in de CQI.
  const isEntertainment = profile === 'entertainment'

  // ── CQI (aggregaat over de TOEPASSELIJKE dimensies) ──
  const dims = { hook: llm.hook_score, thumbnail: thumbnail_score, retention: llm.retention_prediction, visual: visual_score, voice: voice_score, music: music_score, cta: llm.cta_score }
  const cqiDims = isEntertainment
    ? [llm.hook_score, thumbnail_score, llm.retention_prediction, visual_score, music_score]
    : Object.values(dims)
  const cqi = Math.round(cqiDims.reduce((s, v) => s + v, 0) / cqiDims.length)

  // ── Gate (Content-Reject Agent) ──
  const reasons: string[] = []
  if (llm.hook_score < THRESHOLDS.hook) reasons.push(`hook<${THRESHOLDS.hook}`)
  if (thumbPending) reasons.push('thumbnail_pending'); else if (thumbnail_score < THRESHOLDS.thumbnail) reasons.push(`thumbnail<${THRESHOLDS.thumbnail}`)
  if (llm.retention_prediction < THRESHOLDS.retention) reasons.push(`retention<${THRESHOLDS.retention}`)
  if (visual_score < THRESHOLDS.visual) reasons.push(`visual<${THRESHOLDS.visual}`)
  if (!isEntertainment && voice_score < THRESHOLDS.voice) reasons.push(voiceGate || `voice<${THRESHOLDS.voice}`)
  // Muziek: bij entertainment nice-to-have (niet-blokkerend); anders gegate.
  if (!isEntertainment) { if (musicPending) reasons.push('music_pending'); else if (music_score < THRESHOLDS.music) reasons.push(`music<${THRESHOLDS.music}`) }
  if (!isEntertainment && llm.cta_score < THRESHOLDS.cta) reasons.push(`cta<${THRESHOLDS.cta}`)
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
    feedback: { content_reject: llm.content_reject, qc_profile: profile },
  })

  // Status hooguit → quality_checked. NOOIT approved/upload_ready. Queue ongemoeid.
  await admin.from('video_projects').update({
    status: 'quality_checked', quality_passed: gate_passed,
    rework_reason: gate_passed ? null : gate_reason,
  }).eq('id', video_project_id)

  return NextResponse.json({ ok: true, video_project_id, cqi, gate_passed, gate_reason, dimensions: dims, qc_profile: profile })
}
