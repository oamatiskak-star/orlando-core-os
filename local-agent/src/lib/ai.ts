import axios from 'axios'

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
}): Promise<ContentResult> {
  const isShort   = payload.video_type === 'short'
  const words     = Math.round(payload.target_seconds * 2.5)
  const isEnglish = payload.language !== 'nl'

  const systemContext = isEnglish
    ? `You are an expert YouTube content creator for ${payload.channel_name}.`
    : `Je bent een expert YouTube contentmaker voor ${payload.channel_name}.`

  const prompt = isEnglish ? `
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
      if (USE_CLAUDE) {
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
