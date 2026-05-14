import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import axios from 'axios'

const db = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

const LM_STUDIO_URL  = process.env.LM_STUDIO_URL   || 'http://localhost:1234'
const OLLAMA_URL     = process.env.OLLAMA_URL       || 'http://localhost:11434'
const OLLAMA_MODEL   = process.env.OLLAMA_MODEL     || 'llama3:latest'
const USE_LM_STUDIO  = process.env.USE_LM_STUDIO   !== 'false'
const INTERVAL_MS    = 15 * 60 * 1000

function log(msg: string) {
  console.log(`[${new Date().toLocaleTimeString('nl-NL')}] [seo] ${msg}`)
}

async function callAI(prompt: string): Promise<string> {
  if (USE_LM_STUDIO) {
    try {
      const res = await axios.post(`${LM_STUDIO_URL}/v1/chat/completions`, {
        model: process.env.LM_STUDIO_MODEL || 'default',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 512,
      }, { timeout: 30_000 })
      return res.data.choices[0].message.content as string
    } catch {}
  }
  const res = await axios.post(`${OLLAMA_URL}/api/generate`, {
    model: OLLAMA_MODEL,
    prompt,
    stream: false,
    options: { temperature: 0.7, num_predict: 512 },
  }, { timeout: 60_000 })
  return res.data.response as string
}

function buildPrompt(title: string, description: string, language: string): string {
  const isNL = language === 'nl'
  return isNL ? `
Je bent een YouTube SEO expert. Maak de onderstaande titel en beschrijving scherper voor maximale CTR.

Huidige titel: "${title}"
Huidige beschrijving (eerste 200 tekens): "${description.slice(0, 200)}"

Regels voor de titel:
- Maximaal 70 tekens
- Voeg een getal toe als dat nog niet aanwezig is (bijv. "5 manieren", "€500")
- Voeg het jaar 2026 toe als dat zinvol is
- Maak het urgenter of nieuwsgieriger
- Behoud de kern van het onderwerp

Geef ALLEEN geldige JSON terug (geen markdown):
{"title":"nieuwe titel hier","tags":["tag1","tag2","tag3","tag4","tag5","tag6","tag7","tag8","tag9","tag10"]}
` : `
You are a YouTube SEO expert. Improve the title and generate tags for maximum CTR.

Current title: "${title}"
Current description (first 200 chars): "${description.slice(0, 200)}"

Rules for the title:
- Maximum 70 characters
- Include a number if not already present (e.g. "5 steps", "£500")
- Include year 2026 if relevant
- Make it more urgent or curiosity-driven
- Keep the core topic

Return ONLY valid JSON (no markdown):
{"title":"new title here","tags":["tag1","tag2","tag3","tag4","tag5","tag6","tag7","tag8","tag9","tag10"]}
`
}

async function optimizeVideo(video: {
  id: string
  title: string
  description: string
  channel_id: string
}): Promise<void> {
  const { data: channel } = await db
    .from('youtube_channels')
    .select('language')
    .eq('id', video.channel_id)
    .single()

  const language = (channel as any)?.language ?? 'nl'
  const prompt   = buildPrompt(video.title, video.description ?? '', language)

  let raw: string
  try {
    raw = await callAI(prompt)
  } catch (err: any) {
    log(`✗ AI fout voor ${video.id}: ${err.message}`)
    return
  }

  const stripped   = raw.replace(/```(?:json)?/g, '').replace(/```/g, '')
  const jsonMatch  = stripped.match(/\{[\s\S]*\}/)
  if (!jsonMatch) { log(`✗ Geen JSON voor ${video.id}`); return }

  let result: { title?: string; tags?: string[] }
  try { result = JSON.parse(jsonMatch[0]) } catch { return }

  if (!result.title || result.title.length > 100) return
  if (result.title === video.title) return  // geen verbetering

  await db.from('youtube_videos').update({
    title:      result.title,
    tags:       result.tags ?? [],
    updated_at: new Date().toISOString(),
  }).eq('id', video.id)

  log(`✓ SEO: "${video.title.slice(0, 40)}" → "${result.title.slice(0, 40)}"`)
}

async function runOptimizer(): Promise<void> {
  const { data: videos } = await db
    .from('youtube_videos')
    .select('id, title, description, channel_id')
    .eq('status', 'queued')
    .eq('upload_status', 'pending')
    .is('seo_optimized_at', null)
    .order('created_at', { ascending: true })
    .limit(5)

  if (!videos?.length) return
  log(`${videos.length} videos te optimaliseren`)

  for (const video of videos) {
    await optimizeVideo(video as any)
    // Mark as optimized regardless of outcome to prevent infinite retries
    await db.from('youtube_videos')
      .update({ seo_optimized_at: new Date().toISOString() } as any)
      .eq('id', video.id)
  }
}

async function main() {
  log('SEO Optimizer gestart — interval: 15m')
  await runOptimizer()
  setInterval(runOptimizer, INTERVAL_MS)
}

main().catch(err => {
  console.error('[seo] Fatal:', err.message)
  process.exit(1)
})
