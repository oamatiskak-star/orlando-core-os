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
const BATCH_SIZE     = 10   // videos per batch
const FULL_AUDIT     = process.argv.includes('--audit')

function log(msg: string) {
  console.log(`[${new Date().toISOString()}] [seo-optimizer] ${msg}`)
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
    } catch (err) {
      log(`WARN LM_STUDIO unavailable, using OLLAMA fallback: ${err instanceof Error ? err.message : err}`)
    }
  }
  try {
    const res = await axios.post(`${OLLAMA_URL}/api/generate`, {
      model: OLLAMA_MODEL,
      prompt,
      stream: false,
      options: { temperature: 0.7, num_predict: 512 },
    }, { timeout: 60_000 })
    return res.data.response as string
  } catch (err) {
    const msg = `AI_SERVICE_UNAVAILABLE (LM_STUDIO=${USE_LM_STUDIO}, OLLAMA=${OLLAMA_URL}): ${err instanceof Error ? err.message : String(err)}`
    log(`ERROR ${msg}`)
    throw new Error(msg)
  }
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
  try {
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
      log(`✗ AI error for ${video.id}: ${err.message}`)
      return
    }

    const stripped   = raw.replace(/```(?:json)?/g, '').replace(/```/g, '')
    const jsonMatch  = stripped.match(/\{[\s\S]*\}/)
    if (!jsonMatch) { log(`✗ No JSON found for ${video.id}`); return }

    let result: { title?: string; tags?: string[] }
    try { result = JSON.parse(jsonMatch[0]) } catch (err) {
      log(`✗ JSON parse error for ${video.id}: ${err instanceof Error ? err.message : err}`)
      return
    }

    if (!result.title || result.title.length > 100) return
    if (result.title === video.title) return

    await db.from('youtube_videos').update({
      title:      result.title,
      tags:       result.tags ?? [],
      updated_at: new Date().toISOString(),
    }).eq('id', video.id)

    log(`✓ SEO: "${video.title.slice(0, 40)}" → "${result.title.slice(0, 40)}"`)
  } catch (err: any) {
    log(`✗ Error in optimizeVideo(${video.id}): ${err.message}`)
    throw err
  }
}

async function runOptimizer(): Promise<void> {
  try {
    let query = db
      .from('youtube_videos')
      .select('id, title, description, channel_id, status')
      .is('seo_optimized_at', null)
      .order('created_at', { ascending: true })
      .limit(BATCH_SIZE)

    if (!FULL_AUDIT) {
      // Normal mode: only videos not yet published
      query = query.in('status', ['queued', 'planned', 'scheduled'])
    }
    // --audit mode: all videos without seo_optimized_at, including live

    const { data: videos, error } = await query

    if (error) {
      log(`✗ Database error fetching videos: ${error.message}`)
      throw error
    }

    if (!videos?.length) {
      if (FULL_AUDIT) log('Audit complete — all videos optimized')
      return
    }
    log(`${videos.length} videos to optimize${FULL_AUDIT ? ' (audit mode)' : ''}`)

    for (const video of videos) {
      try {
        await optimizeVideo(video as any)
        await db.from('youtube_videos')
          .update({ seo_optimized_at: new Date().toISOString() } as any)
          .eq('id', video.id)
      } catch (videoErr: any) {
        log(`✗ Error processing video ${video.id}: ${videoErr.message}`)
        // Continue with next video instead of failing entire batch
      }
    }
  } catch (err: any) {
    log(`✗ Error in runOptimizer: ${err.message}`)
    throw err
  }
}

async function runFullAudit(): Promise<void> {
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  log('  SEO Full Audit — all channels')
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  const { data: channels } = await db
    .from('youtube_channels')
    .select('id, naam')
    .order('naam')

  if (!channels?.length) { log('No channels found'); return }

  for (const ch of channels) {
    const { count } = await db
      .from('youtube_videos')
      .select('id', { count: 'exact', head: true })
      .eq('channel_id', ch.id)
      .is('seo_optimized_at', null)

    log(`${(ch as any).naam}: ${count ?? 0} videos waiting for SEO`)
  }

  log('Starting batch optimization...')
  let totalDone = 0
  let hasMore   = true

  while (hasMore) {
    const { data: batch } = await db
      .from('youtube_videos')
      .select('id, title, description, channel_id, status')
      .is('seo_optimized_at', null)
      .order('created_at', { ascending: true })
      .limit(BATCH_SIZE)

    if (!batch?.length) { hasMore = false; break }

    for (const video of batch) {
      await optimizeVideo(video as any)
      await db.from('youtube_videos')
        .update({ seo_optimized_at: new Date().toISOString() } as any)
        .eq('id', video.id)
      totalDone++
    }

    log(`${totalDone} videos completed...`)
  }

  log(`SEO audit completed — ${totalDone} videos optimized`)
}

async function main() {
  if (FULL_AUDIT) {
    await runFullAudit()
    process.exit(0)
  }
  log('SEO Optimizer started — interval: 15m')
  try {
    await runOptimizer()
  } catch (err: any) {
    log(`✗ First run error: ${err.message}`)
  }
  setInterval(async () => {
    try {
      await runOptimizer()
    } catch (err: any) {
      log(`✗ Scheduled run error: ${err.message}`)
    }
  }, INTERVAL_MS)
}

main().catch(err => {
  console.error('[seo-optimizer] Fatal:', err.message)
  process.exit(1)
})
