import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

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
