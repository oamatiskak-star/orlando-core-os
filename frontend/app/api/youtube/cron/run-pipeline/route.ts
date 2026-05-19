import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateText } from 'ai'
import { claude } from '@/lib/ai/client'

async function scoreVideo(
  title: string,
  hook: string,
  channelId: string,
  queueId: string | undefined,
): Promise<{ total_score: number; verdict: 'publish' | 'improve' | 'reject' } | null> {
  try {
    const prompt = `Beoordeel deze YouTube video op kwaliteit. Geef ALLEEN geldige JSON terug.

TITEL: "${title}"
HOOK: "${hook}"

Scoor title (0-100) en hook (0-100). total_score = (title*0.5 + hook*0.5). verdict: "publish" (≥75), "improve" (50-74), "reject" (<50).

{"title_score":<n>,"hook_score":<n>,"total_score":<n>,"verdict":"publish|improve|reject","feedback":{"title":"<tip>","hook":"<tip>"}}`

    const { text } = await generateText({
      model:           claude.haiku,
      maxOutputTokens: 200,
      messages:        [{ role: 'user', content: prompt }],
    })
    const raw    = text.trim().replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim()
    const result = JSON.parse(raw)

    const admin = createAdminClient()
    await admin.from('youtube_quality_scores').insert({
      queue_id:        queueId ?? null,
      channel_id:      channelId,
      title_score:     result.title_score  ?? 50,
      hook_score:      result.hook_score   ?? 50,
      thumbnail_score: 50,
      total_score:     result.total_score  ?? 50,
      verdict:         result.verdict      ?? 'improve',
      feedback:        result.feedback     ?? {},
    })

    return { total_score: result.total_score ?? 50, verdict: result.verdict ?? 'improve' }
  } catch {
    return null
  }
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const today = new Date()
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const publishDate = tomorrow.toISOString().slice(0, 10)

  // Fetch all enabled pipeline configs
  const { data: configs } = await admin
    .from('yt_pipeline_configs')
    .select('*, youtube_channels(id, naam, status, oauth_status)')
    .eq('enabled', true)

  if (!configs?.length) {
    return NextResponse.json({ message: 'Geen actieve pipeline configs', jobs: 0 })
  }

  let totalJobs = 0
  const results: { channel: string; jobs: number; error?: string }[] = []

  for (const cfg of configs) {
    const ch = (cfg as any).youtube_channels
    if (!ch || ch.status !== 'active') continue

    const runRecord = await admin.from('yt_pipeline_runs').insert({
      run_date:   publishDate,
      channel_id: ch.id,
      status:     'started',
    }).select('id').single()

    const runId = runRecord.data?.id

    try {
      const jobs: any[] = []

      // Long-form videos
      for (let i = 0; i < cfg.longform_per_day; i++) {
        const topic = cfg.topics[Math.floor(Math.random() * cfg.topics.length)]
        const { data: cal } = await admin.from('yt_content_calendar').insert({
          channel_id:       ch.id,
          week_start:       publishDate,
          publish_date:     publishDate,
          day_index:        i,
          video_type:       'longform',
          video_type_detail:'longform',
          title:            `${topic} — ${ch.naam} ${publishDate}`,
          description:      '',
          tags:             cfg.topics,
          thumbnail_concept:`${topic} thumbnail voor ${ch.naam}`,
          hook_script:      '',
          cta:              'Abonneer en sla op!',
          status:           'pending',
        }).select('id').single()

        if (cal?.id) {
          // Quality gate: score titel + topic hook vóór inplannen
          const qTitle = `${topic} — ${ch.naam} ${publishDate}`
          const qHook  = `${topic}. Wist je dat dit direct invloed heeft op jouw vermogen?`
          const qScore = await scoreVideo(qTitle, qHook, ch.id, undefined)
          const calStatus = qScore?.verdict === 'reject' ? 'rejected' : 'pending'

          if (calStatus === 'rejected') {
            await admin.from('yt_content_calendar').update({
              status:     'rejected',
              hook_script: `[REJECTED] Kwaliteitsscore te laag: ${qScore?.total_score ?? 0}/100`,
            }).eq('id', cal.id)
          } else {
            const { data: task } = await admin.from('agent_tasks').insert({
              task_type: 'generate_content',
              status:    'pending',
              priority:  10,
              payload: {
                calendar_id:   cal.id,
                channel_id:    ch.id,
                channel_name:  ch.naam,
                topic,
                video_type:    'longform',
                language:      cfg.language,
                style:         cfg.style,
                voice:         cfg.voice,
                ollama_model:  cfg.ollama_model,
                lm_studio_model: cfg.lm_studio_model,
                target_seconds: cfg.target_duration_longform,
                bg_color:      cfg.bg_color,
                publish_date:  publishDate,
              },
            }).select('id').single()

            if (task?.id) {
              await admin.from('yt_content_calendar')
                .update({ agent_task_id: task.id })
                .eq('id', cal.id)
              jobs.push(task.id)
            }
          }
        }
      }

      // Shorts
      for (let i = 0; i < cfg.shorts_per_day; i++) {
        const topic = cfg.topics[Math.floor(Math.random() * cfg.topics.length)]
        const { data: cal } = await admin.from('yt_content_calendar').insert({
          channel_id:       ch.id,
          week_start:       publishDate,
          publish_date:     publishDate,
          day_index:        cfg.longform_per_day + i,
          video_type:       'short',
          video_type_detail:'short',
          title:            `[Short] ${topic} — ${ch.naam}`,
          description:      '',
          tags:             [...cfg.topics, 'shorts', 'ytshorts'],
          thumbnail_concept:`Viral short thumbnail: ${topic}`,
          hook_script:      '',
          cta:              'Volg voor meer tips!',
          status:           'pending',
        }).select('id').single()

        if (cal?.id) {
          const { data: task } = await admin.from('agent_tasks').insert({
            task_type: 'generate_content',
            status:    'pending',
            priority:  8,
            payload: {
              calendar_id:   cal.id,
              channel_id:    ch.id,
              channel_name:  ch.naam,
              topic,
              video_type:    'short',
              language:      cfg.language,
              style:         cfg.style,
              voice:         cfg.voice,
              ollama_model:  cfg.ollama_model,
              lm_studio_model: cfg.lm_studio_model,
              target_seconds: cfg.target_duration_short,
              bg_color:      cfg.bg_color,
              publish_date:  publishDate,
            },
          }).select('id').single()

          if (task?.id) {
            await admin.from('yt_content_calendar')
              .update({ agent_task_id: task.id })
              .eq('id', cal.id)
            jobs.push(task.id)
          }
        }
      }

      await admin.from('yt_pipeline_runs').update({
        status:       'completed',
        jobs_created: jobs.length,
        finished_at:  new Date().toISOString(),
      }).eq('id', runId)

      totalJobs += jobs.length
      results.push({ channel: ch.naam, jobs: jobs.length })
    } catch (err: any) {
      await admin.from('yt_pipeline_runs').update({
        status:     'failed',
        error:      err.message,
        finished_at: new Date().toISOString(),
      }).eq('id', runId)
      results.push({ channel: ch.naam, jobs: 0, error: err.message })
    }
  }

  console.log(`Pipeline cron: ${totalJobs} jobs aangemaakt voor ${publishDate}`, results)
  return NextResponse.json({ date: publishDate, totalJobs, results })
}
