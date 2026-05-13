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
    options: { temperature: 0.7, num_predict: 8192, num_ctx: 8192 },
  }, { timeout: 300_000 })
  return res.data.response as string
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
Create a complete YouTube ${isShort ? 'Short (max 60s)' : 'video (~${payload.target_seconds}s)'} about: "${payload.topic}"

Style: ${payload.style}
Channel: ${payload.channel_name}

Return ONLY valid JSON (no markdown, no code blocks):
{
  "title": "catchy SEO title max 70 chars",
  "description": "SEO description 300-500 chars with keywords",
  "tags": ["tag1","tag2",...20 tags],
  "hook": "first 3 seconds hook sentence",
  "full_script": "complete word-for-word script ~${words} words",
  "cta": "call to action closing sentence",
  "thumbnail_concept": "visual description for thumbnail"
}` : `
${systemContext}
Maak een complete YouTube ${isShort ? 'Short (max 60s)' : `video (~${payload.target_seconds}s)`} over: "${payload.topic}"

Stijl: ${payload.style}
Kanaal: ${payload.channel_name}
Taal: Nederlands

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

  let raw: string
  try {
    if (USE_LM_STUDIO) {
      raw = await callLMStudio(prompt, payload.lm_studio_model)
    } else {
      raw = await callOllama(prompt, payload.ollama_model)
    }
  } catch (primaryErr) {
    console.warn('Primaire AI mislukt, fallback naar andere:', (primaryErr as Error).message)
    if (USE_LM_STUDIO) {
      raw = await callOllama(prompt, payload.ollama_model)
    } else {
      raw = await callLMStudio(prompt, payload.lm_studio_model)
    }
  }

  // Extract JSON — strip markdown code blocks first
  const stripped = raw.replace(/```(?:json)?/g, '').replace(/```/g, '')
  const jsonMatch = stripped.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('AI gaf geen geldige JSON terug')

  const result = JSON.parse(jsonMatch[0]) as ContentResult
  return result
}
