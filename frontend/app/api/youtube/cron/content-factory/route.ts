import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { reportHeartbeat } from '@/lib/watchdog/heartbeat'

export const revalidate = 0
export const maxDuration = 60

// Vercel cron — /api/youtube/cron/content-factory
// Schedule: zie vercel.json (elke 10 min).
// Beveiligd via Bearer CRON_SECRET.
//
// Pakt open content_factory orchestrator_tasks, genereert een Forge brief
// via Anthropic, inserteert media_holding_content_items. De DB-triggers
// trg_autopilot_ready_to_render en trg_autopilot_render_to_upload nemen
// het over voor render + upload.
//
// Replaceert de externe orchestrator-poller die sinds 2026-05-19 20:22 niet
// meer draait. Direct-in-Vercel pattern, zelfde als viral/audio/trend scans.

const BATCH_SIZE = 5
const MODEL = 'claude-haiku-4-5-20251001'
const ALLOWED_KINDS = ['short','reel','long','loop','asmr','satisfying','cutting','marble','mini_world','ai_visual','remix','compilation']

const SYSTEM_PROMPT = `Je bent Forge, content brief generator voor Orlando's media holding.

Genereer voor een viral kans een ready-to-render content brief in shorts format.

Output ALLEEN een JSON object (geen markdown, geen extra tekst):
{
  "title": "NL clickbait titel met 1 emoji, max 60 chars",
  "hook": "NL openings-zin als cliffhanger, max 100 chars",
  "prompt": "EN visuele beschrijving voor video generator (cinematic 9:16, color grading, shot details, lighting). Min 200 chars",
  "kind": "short | reel | long | loop | asmr | satisfying | remix",
  "duration_seconds": 40 t/m 60 voor shorts,
  "language": "nl"
}

Regels:
- Title in NL, hook in NL, prompt in EN
- Inhaak op de viral hoek maar maak het origineel — geen letterlijke kopie
- Voor entertainment/trailers: maak een "inzicht/reactie" hoek
- Voor muziek: maak een aesthetic visual short
- Geen NSFW`

interface OpenTask {
  id: string
  payload: {
    viral_opportunity_id?: string | null
    channel_id?: string | null
    brief?: string | null
    persona?: string | null
  }
  objective: string[] | null
  attempts: number
  max_attempts: number | null
}

interface ViralOpp {
  id: string
  title: string
  url: string | null
  channel_name: string | null
  virality_score: number
  niche: string | null
  language: string | null
  source_platform: string
}

interface Brief {
  title: string
  hook: string
  prompt: string
  kind: string
  duration_seconds: number
  language: string
}

interface AnthropicMessage {
  content?: Array<{ type: string; text?: string }>
  error?: { type: string; message: string }
}

async function generateBrief(opp: ViralOpp): Promise<Brief> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is required')

  const userContent = [
    `Bron-titel: ${opp.title}`,
    `Bron-platform: ${opp.source_platform}`,
    opp.url ? `Bron-URL: ${opp.url}` : null,
    `Virality score: ${opp.virality_score}/100`,
    opp.niche ? `Bron-niche: ${opp.niche}` : null,
    opp.language ? `Bron-taal: ${opp.language}` : null,
    opp.channel_name ? `Bron-kanaal: ${opp.channel_name}` : null,
  ].filter(Boolean).join('\n')

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key':         apiKey,
      'anthropic-version': '2023-06-01',
      'content-type':      'application/json',
    },
    body: JSON.stringify({
      model:     MODEL,
      max_tokens: 1024,
      system:    SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userContent }],
    }),
  })

  if (!res.ok) {
    const errBody = await res.text().catch(() => '')
    throw new Error(`Anthropic ${res.status}: ${errBody.slice(0, 200)}`)
  }
  const json = (await res.json()) as AnthropicMessage
  if (json.error) throw new Error(`Anthropic API error: ${json.error.message}`)

  const text = (json.content ?? [])
    .filter((b) => b.type === 'text')
    .map((b) => b.text ?? '')
    .join('')
    .trim()

  // Strip eventuele markdown fences
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim()

  let parsed: Partial<Brief>
  try {
    parsed = JSON.parse(cleaned)
  } catch {
    throw new Error(`Anthropic returned non-JSON: ${cleaned.slice(0, 150)}`)
  }

  // Validatie
  if (!parsed.title || !parsed.hook || !parsed.prompt) {
    throw new Error('Anthropic response mist title/hook/prompt')
  }
  const kind = ALLOWED_KINDS.includes(parsed.kind ?? '') ? parsed.kind! : 'short'
  const duration = Math.max(20, Math.min(90, Number(parsed.duration_seconds ?? 50)))

  return {
    title:            String(parsed.title).slice(0, 200),
    hook:             String(parsed.hook).slice(0, 200),
    prompt:           String(parsed.prompt).slice(0, 4000),
    kind,
    duration_seconds: duration,
    language:         (parsed.language ?? 'nl').slice(0, 5),
  }
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const startedAt = Date.now()
  const admin = createAdminClient()

  // Claim batch open tasks — 2-staps want PostgREST UPDATE ondersteunt geen ORDER BY:
  //   1) select kandidaat-IDs in juiste volgorde
  //   2) update WHERE id IN (...) + status='open' (concurrency safety)
  const nowIso = new Date().toISOString()
  const { data: candidates, error: selErr } = await admin
    .from('orchestrator_tasks')
    .select('id, payload, objective, attempts, max_attempts')
    .eq('status', 'open')
    .eq('executor', 'content_factory')
    .lte('run_at', nowIso)
    .order('priority', { ascending: true })
    .order('created_at', { ascending: true })
    .limit(BATCH_SIZE)

  if (selErr) return NextResponse.json({ error: selErr.message }, { status: 500 })
  const candidateList = candidates ?? []
  if (candidateList.length === 0) {
    return NextResponse.json({ ok: true, skipped: true, reason: 'no_open_tasks', duration_ms: Date.now() - startedAt })
  }

  const ids = candidateList.map((c) => c.id as string)
  const { data: claimed, error: claimErr } = await admin
    .from('orchestrator_tasks')
    .update({ status: 'running', started_at: nowIso, updated_at: nowIso })
    .in('id', ids)
    .eq('status', 'open') // race guard
    .select('id, payload, objective, attempts, max_attempts')

  if (claimErr) return NextResponse.json({ error: claimErr.message }, { status: 500 })
  const tasks = (claimed ?? []) as OpenTask[]

  if (tasks.length === 0) {
    return NextResponse.json({ ok: true, skipped: true, reason: 'race_lost', duration_ms: Date.now() - startedAt })
  }

  // Media Holding channels voor round-robin assignment. Let op: FK gaat naar
  // media_holding_channels (Media Holding OS), NIET naar youtube_channels.
  // autopilot_render_to_upload trigger vereist channel_id IS NOT NULL.
  const { data: liveMediaChannels } = await admin
    .from('media_holding_channels')
    .select('id, name')
    .eq('status', 'live')
  const channelPool: string[] = (liveMediaChannels ?? []).map((c) => c.id as string)

  const results: Array<{ task_id: string; status: 'completed'|'failed'; detail: string }> = []
  let channelIdx = 0

  for (const task of tasks) {
    const oppId = task.payload?.viral_opportunity_id
    if (!oppId) {
      await markFailed(admin, task, 'payload.viral_opportunity_id ontbreekt')
      results.push({ task_id: task.id, status: 'failed', detail: 'no_viral_opportunity_id' })
      continue
    }

    const { data: opp, error: oppErr } = await admin
      .from('viral_opportunities')
      .select('id, title, url, channel_name, virality_score, niche, language, source_platform')
      .eq('id', oppId)
      .single()

    if (oppErr || !opp) {
      await markFailed(admin, task, `viral_opportunity ${oppId} niet gevonden`)
      results.push({ task_id: task.id, status: 'failed', detail: 'viral_opp_not_found' })
      continue
    }

    let brief: Brief
    try {
      brief = await generateBrief(opp as ViralOpp)
    } catch (err) {
      await markFailed(admin, task, `Anthropic: ${(err as Error).message}`)
      results.push({ task_id: task.id, status: 'failed', detail: (err as Error).message })
      continue
    }

    // Channel pick: task.payload.channel_id heeft prio, anders Phase 1 round-robin.
    // autopilot_render_to_upload trigger vereist channel_id IS NOT NULL.
    // status='ready' triggert trg_autopilot_ready_to_render → renderer task.
    // content_brief.hook + visual_prompt triggert trg_extract_hook_to_library.
    let channelId: string | null = (task.payload?.channel_id as string | null) ?? null
    if (!channelId && channelPool.length > 0) {
      channelId = channelPool[channelIdx % channelPool.length]
      channelIdx++
    }
    const { data: contentItem, error: insErr } = await admin
      .from('media_holding_content_items')
      .insert({
        channel_id:            channelId,
        source_opportunity_id: opp.id,
        kind:                  brief.kind,
        title:                 brief.title,
        prompt:                brief.prompt,
        hook:                  brief.hook,
        duration_seconds:      brief.duration_seconds,
        language:              brief.language,
        status:                'ready',
        content_brief: {
          generated_by:    'vercel-cron-content-factory',
          generated_at:    new Date().toISOString(),
          model:           MODEL,
          source_score:    opp.virality_score,
          hook:            brief.hook,
          visual_prompt:   brief.prompt,
          suggested_kind:  brief.kind,
          replay_friendly: brief.kind === 'loop',
        },
      })
      .select('id')
      .single()

    if (insErr || !contentItem) {
      await markFailed(admin, task, `content_item insert: ${insErr?.message ?? 'unknown'}`)
      results.push({ task_id: task.id, status: 'failed', detail: 'insert_failed' })
      continue
    }

    // Mark task completed
    await admin.from('orchestrator_tasks').update({
      status:         'completed',
      finished_at:    new Date().toISOString(),
      updated_at:     new Date().toISOString(),
      attempts:       (task.attempts ?? 0) + 1,
      result_summary: `Forge brief klaar: "${brief.title}" (kind=${brief.kind}, ${brief.duration_seconds}s). content_item_id=${contentItem.id}`,
      error:          null,
    }).eq('id', task.id)

    results.push({ task_id: task.id, status: 'completed', detail: contentItem.id })
  }

  await reportHeartbeat('cron.vercel.content-factory').catch(() => {}) /* watchdog-heartbeat */

  return NextResponse.json({
    ok:           true,
    claimed:      tasks.length,
    completed:    results.filter((r) => r.status === 'completed').length,
    failed:       results.filter((r) => r.status === 'failed').length,
    results,
    duration_ms:  Date.now() - startedAt,
  })
}

async function markFailed(admin: ReturnType<typeof createAdminClient>, task: OpenTask, error: string) {
  const maxAttempts = task.max_attempts ?? 3
  const nextAttempts = (task.attempts ?? 0) + 1
  const finalStatus = nextAttempts >= maxAttempts ? 'failed' : 'open'

  await admin.from('orchestrator_tasks').update({
    status:      finalStatus,
    error,
    attempts:    nextAttempts,
    started_at:  null, // free voor next pickup als retry
    updated_at:  new Date().toISOString(),
  }).eq('id', task.id)
}
