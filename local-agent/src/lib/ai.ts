import axios from 'axios'
import { openaiAvailable, openaiChat } from './cloud-llm'

const USE_LM_STUDIO  = process.env.USE_LM_STUDIO !== 'false'
const LM_STUDIO_URL  = process.env.LM_STUDIO_URL  || 'http://localhost:1234'
const LM_STUDIO_MODEL= process.env.LM_STUDIO_MODEL || 'default'
const OLLAMA_URL     = process.env.OLLAMA_URL      || 'http://localhost:11434'
const OLLAMA_MODEL   = process.env.OLLAMA_MODEL    || 'llama3.2'

export interface ContentResult {
  title:       string
  description: string
  tags:        string[]
  full_script: string
  hook:        string
  cta:         string
  thumbnail_concept: string
}

async function callLMStudio(prompt: string, model: string): Promise<string> {
  const res = await axios.post(`${LM_STUDIO_URL}/v1/chat/completions`, {
    model,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.8,
    max_tokens: 4096,
  }, { timeout: 120_000 })
  return res.data.choices[0].message.content as string
}

async function callOllama(prompt: string, model: string): Promise<string> {
  const res = await axios.post(`${OLLAMA_URL}/api/generate`, {
    model,
    prompt,
    stream: false,
    format: 'json',
    options: { temperature: 0.7, num_predict: 8192, num_ctx: 8192 },
  }, { timeout: 300_000 })
  return res.data.response as string
}

// Cloud-route (publish-grade): claude.sonnet via Anthropic API. Zelfde model als de QC →
// content geoptimaliseerd voor de QC-criteria. Gebruikt bij CONTENT_MODEL=claude.
const USE_CLAUDE = process.env.CONTENT_MODEL === 'claude' && !!process.env.ANTHROPIC_API_KEY
async function callClaude(prompt: string): Promise<string> {
  const res = await axios.post('https://api.anthropic.com/v1/messages', {
    model: process.env.CONTENT_CLAUDE_MODEL || 'claude-sonnet-4-6',
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }],
  }, {
    headers: { 'x-api-key': process.env.ANTHROPIC_API_KEY!, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    timeout: 120_000,
  })
  return (res.data?.content?.[0]?.text ?? '') as string
}

/**
 * Claude (sonnet) beschikbaar als JSON-judge? Alleen op ANTHROPIC_API_KEY — onafhankelijk van
 * CONTENT_MODEL (content-generatie kan lokaal blijven terwijl scoring via Claude loopt).
 */
export const CLAUDE_AVAILABLE = !!process.env.ANTHROPIC_API_KEY

/**
 * JSON-judge via claude.sonnet (dezelfde Anthropic-laag als generateContent). Parseert de JSON
 * uit de respons. GOOIT bij ontbrekende key/onbereikbaar/ongeldige JSON — de caller valt dan
 * expliciet terug op de lokale scorer (geen verzonnen score).
 */
export async function claudeJson(prompt: string): Promise<any> {
  if (!CLAUDE_AVAILABLE) throw new Error('ANTHROPIC_API_KEY ontbreekt')
  const raw = await callClaude(prompt)
  const stripped = raw.replace(/```(?:json)?/g, '').replace(/```/g, '')
  const m = stripped.match(/\{[\s\S]*\}/)
  if (!m) throw new Error('claudeJson: geen JSON in respons')
  return JSON.parse(m[0])
}

// Dutch words that virtually never appear in English text
const DUTCH_PATTERN = /\b(voor|naar|van|bij|zijn|wordt|worden|hebben|maar|ook|dan|als|met|aan|wat|hoe|dit|dat|zo|jouw|mijn|ons|onze|beste|welke|werd|waren|zou|zal|kan|mag|moet|geen|wel|nog|toch|door|over|onder|boven|naast|tussen|buiten|binnen|tijdens|hierbij|hierdoor|hiervan|hierin|hiermee|daarmee|daarin|daarvoor|daarna|waarmee|waarbij|wanneer|terwijl|omdat|indien|hoewel|echter|tevens|namelijk|immers)\b/gi

function dutchWordCount(text: string): number {
  return (text.match(DUTCH_PATTERN) ?? []).length
}

export async function generateContent(payload: {
  channel_name:  string
  topic:         string
  video_type:    'longform' | 'short'
  language:      string
  style:         string
  target_seconds: number
  ollama_model:  string
  lm_studio_model: string
  format_profile?: string | null   // bv. 'us_finance_longform' → data-explainer-script
  data_bundle?:    string | null   // echte FMP-cijfers om in het script te injecteren
  channel_topics?:  string[]       // CF2-repair: kanaal-niche-topics (niche-conform genereren)
  own_cta_options?: string[]       // CF2-repair: kanaal-eigen CTA's (verplicht i.p.v. generiek)
}): Promise<ContentResult> {
  const isShort   = payload.video_type === 'short'
  const words     = Math.round(payload.target_seconds * 2.5)
  const isEnglish = payload.language !== 'nl'
  const isFinanceLongform = payload.format_profile === 'us_finance_longform'

  // CF2 content-engine repair: niche- en CTA-context uit channel_strategy in de prompt vouwen.
  const topics = (payload.channel_topics ?? []).filter(Boolean)
  const ownCta = (payload.own_cta_options ?? []).filter(Boolean)
  const nicheInstr = topics.length
    ? (isEnglish
        ? ` Stay STRICTLY within the channel niche topics [${topics.join(', ')}]; never produce off-niche (gaming/music/entertainment) content.`
        : ` Blijf STRIKT binnen de kanaal-niche-topics [${topics.join(', ')}]; nooit off-niche (gaming/muziek/entertainment) content.`)
    : ''
  const ctaInstr = ownCta.length
    ? (isEnglish
        ? ` MANDATORY CTA: end with EXACTLY one of these channel CTAs (never "like & subscribe"): ${ownCta.join(' | ')}.`
        : ` VERPLICHTE CTA: sluit af met EXACT één van deze kanaal-CTA's (nooit "like & subscribe"): ${ownCta.join(' | ')}.`)
    : ''

  const systemContext = isEnglish
    ? `You are an expert YouTube content creator for ${payload.channel_name}.${nicheInstr}${ctaInstr}`
    : `Je bent een expert YouTube contentmaker voor ${payload.channel_name}.${nicheInstr}${ctaInstr}`

  // Faceless US-finance data-explainer (de €60k-pivot). Stijl: Wall Street Millennial /
  // How Money Works — data-gedreven, sceptisch, verhaal-geleid. Anti-slop conform YouTube's
  // 2025 inauthentic-content-beleid: echte cijfers, bronnen, disclaimer, geen vage AI-vulling.
  const financePrompt = `
You are a sharp, credible FACELESS finance YouTube narrator for ${payload.channel_name},
in the style of Wall Street Millennial and How Money Works: data-driven, skeptical, story-led.
Write in English ONLY. Do NOT use Dutch or any other language.

Create a ~${Math.round(payload.target_seconds / 60)}-minute long-form finance explainer about: "${payload.topic}"

${payload.data_bundle
    ? `${payload.data_bundle}\nUse these REAL numbers verbatim and refer to them naturally; frame as "as of the latest close".`
    : 'Use concrete, realistic figures; clearly frame any estimate AS an estimate.'}

HARD RULES (YouTube 2025 inauthentic-content policy — avoid demonetization):
- Real, specific, verifiable claims; anchor every key point to a number; no vague AI filler.
- Include the exact line "This is not financial advice." near the end.
- Structure the script as: (1) 0-20s HOOK with a concrete stake/number, (2) context,
  (3) 3-6 DATA BEATS, each anchored to a number/chart, (4) a counterintuitive twist,
  (5) conclusion + CTA. Pace tight; no fluff.

Return ONLY valid JSON (no markdown, no code blocks):
{
  "title": "catchy SEO title max 70 chars, contains a number or tension, English",
  "description": "SEO description 300-500 chars with keywords, English",
  "tags": ["tag1","tag2",...20 tags],
  "hook": "first 15 seconds hook with a concrete number, English",
  "full_script": "complete word-for-word script ~${words} words following the 5-part structure, English",
  "cta": "call to action closing sentence, English",
  "thumbnail_concept": "visual: bold number/chart + 3-4 word overlay, high contrast"
}`

  const prompt = isFinanceLongform ? financePrompt : isEnglish ? `
${systemContext}
IMPORTANT: Write ALL content in English only. Do NOT use Dutch or any other language.

Create a complete YouTube ${isShort ? 'Short (max 60s)' : `video (~${payload.target_seconds}s)`} about: "${payload.topic}"

Style: ${payload.style}
Channel: ${payload.channel_name}
Language: English only

Return ONLY valid JSON (no markdown, no code blocks):
{
  "title": "catchy SEO title max 70 chars in English",
  "description": "SEO description 300-500 chars with keywords in English",
  "tags": ["tag1","tag2",...20 tags],
  "hook": "first 3 seconds hook sentence in English",
  "full_script": "complete word-for-word script ~${words} words in English",
  "cta": "call to action closing sentence in English",
  "thumbnail_concept": "visual description for thumbnail"
}` : `
${systemContext}
Maak een complete YouTube ${isShort ? 'Short (max 60s)' : `video (~${payload.target_seconds}s)`} over: "${payload.topic}"

Stijl: ${payload.style}
Kanaal: ${payload.channel_name}
Taal: Nederlands

KWALITEITSEISEN (verplicht — anders wordt de video afgekeurd door de QC):
- HOOK: GEEN cliché/versleten fear-zin ("inflatie vernietigt je spaargeld", "wist je dat..."). Open met een CONCREET getal/percentage/bedrag of een controversiële/verrassende stelling die een curiosity-gap opent.
- RETENTIE: onthul NOOIT het antwoord/de opties in de eerste 15s. Bouw een open loop ("3 opties — de derde verbaast 9 van de 10 beleggers") en los pas later op.
- CONCREETHEID: gebruik echte cijfers, rendementen, jaartallen of cases — geen vage generieke uitspraken die op elke finance-video passen.
- CTA: stuur naar een concrete Aquier-stap (dealcheck / adresscan / financieringsscan / rapport / Mandaat) — NOOIT "like & subscribe".
- TITEL: concreet getal + spanning + differentiatie. GEEN generieke validatie-taal ("die echt werken", "die je moet kennen").

Geef ALLEEN geldige JSON terug (geen markdown, geen code blocks):
{
  "title": "pakkende SEO-titel max 70 tekens",
  "description": "SEO-beschrijving 300-500 tekens met keywords",
  "tags": ["tag1","tag2",...20 tags],
  "hook": "openingszin eerste 3 seconden",
  "full_script": "volledig woord-voor-woord script ~${words} woorden",
  "cta": "call to action slotafsluiting",
  "thumbnail_concept": "visuele omschrijving voor thumbnail"
}`

  const MAX_ATTEMPTS = 3
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    // On retry for English channels: prepend hard override to prompt
    const finalPrompt = (isEnglish && attempt > 1)
      ? `CRITICAL OVERRIDE: You MUST respond in English ONLY. Every single word must be English. No Dutch. No exceptions.\n\n${prompt}`
      : prompt

    let raw: string
    try {
      if (openaiAvailable()) {
        raw = await openaiChat(finalPrompt, { json: true })
      } else if (USE_CLAUDE) {
        raw = await callClaude(finalPrompt)
      } else if (USE_LM_STUDIO) {
        raw = await callLMStudio(finalPrompt, payload.lm_studio_model)
      } else {
        raw = await callOllama(finalPrompt, payload.ollama_model)
      }
    } catch (primaryErr) {
      console.warn('Primaire AI mislukt, fallback naar lokaal:', (primaryErr as Error).message)
      raw = USE_LM_STUDIO
        ? await callLMStudio(finalPrompt, payload.lm_studio_model)
        : await callOllama(finalPrompt, payload.ollama_model)
    }

    // Extract JSON — strip markdown code blocks first
    const stripped = raw.replace(/```(?:json)?/g, '').replace(/```/g, '')
    const jsonMatch = stripped.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      if (attempt < MAX_ATTEMPTS) { console.warn(`Poging ${attempt}: geen JSON, opnieuw...`); continue }
      throw new Error('AI gaf geen geldige JSON terug')
    }

    const result = JSON.parse(jsonMatch[0]) as ContentResult
    // Normalize — Ollama occasionally returns arrays for string fields
    const asStr = (v: unknown) => Array.isArray(v) ? (v as string[]).join(' ') : String(v ?? '')
    result.title             = asStr(result.title)
    result.description       = asStr(result.description)
    result.full_script       = asStr(result.full_script)
    result.hook              = asStr(result.hook)
    result.cta               = asStr(result.cta)
    result.thumbnail_concept = asStr(result.thumbnail_concept)
    if (!Array.isArray(result.tags)) result.tags = []

    // CF2-repair: forceer een kanaal-eigen CTA (geen generieke "abonneer/subscribe/like").
    if (ownCta.length) {
      const c = (result.cta ?? '').toLowerCase()
      const generic = !c || c.includes('abonneer') || c.includes('subscribe') || c.includes('like &') || c.includes('like en')
      const hasOwn = ownCta.some(o => c.includes(o.toLowerCase()))
      if (generic || !hasOwn) result.cta = ownCta[0]
    }

    // Language guard: English channels must not contain Dutch output
    if (isEnglish) {
      const sample = `${result.title} ${result.hook} ${result.full_script.slice(0, 300)}`
      const dutchCount = dutchWordCount(sample)
      if (dutchCount >= 3) {
        console.warn(`Poging ${attempt}: Dutch gedetecteerd (${dutchCount} woorden) in English content — opnieuw genereren`)
        if (attempt < MAX_ATTEMPTS) continue
        throw new Error(`AI blijft Dutch genereren voor English kanaal na ${MAX_ATTEMPTS} pogingen (${dutchCount} Dutch woorden). Taak gefaald.`)
      }
    }

    return result
  }

  throw new Error('generateContent: onverwacht einde van retry-loop')
}
