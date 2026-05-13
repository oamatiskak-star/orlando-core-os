'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Cpu, Upload, CheckCircle2, Loader2, Clock, Zap, AlertCircle } from 'lucide-react'
import clsx from 'clsx'

type AgentTask = {
  id: string
  status: string
  started_at: string | null
  created_at: string
  payload: {
    channel_name?: string
    topic?: string
    video_type?: string
  }
}

type QueueItem = {
  id: string
  status: string
  upload_started_at: string | null
  updated_at: string
  youtube_videos: { title: string } | null
  youtube_channels: { naam: string } | null
}

type BatchStats = {
  total: number
  completed: number
  running: number
  pending: number
  failed: number
}

// Infer AI generation step from elapsed time
function inferGenStep(startedAt: string | null): { label: string; pct: number } {
  if (!startedAt) return { label: 'Wacht...', pct: 2 }
  const s = (Date.now() - new Date(startedAt).getTime()) / 1000
  if (s < 50)  return { label: 'Stap 1/4 · Script via AI', pct: 15 }
  if (s < 90)  return { label: 'Stap 2/4 · TTS audio', pct: 40 }
  if (s < 150) return { label: 'Stap 3/4 · Video assembleren', pct: 65 }
  if (s < 220) return { label: 'Stap 4/4 · Upload naar Storage', pct: 85 }
  return { label: 'Afronden...', pct: 95 }
}

const UPLOAD_STEP: Record<string, { label: string; pct: number; color: string }> = {
  preparing:                   { label: 'Voorbereiden',          pct: 10, color: 'bg-sky-400' },
  normalizing:                 { label: 'FFmpeg',                pct: 28, color: 'bg-sky-400' },
  uploading:                   { label: 'Upload → YouTube',      pct: 58, color: 'bg-indigo-400' },
  uploaded_pending_processing: { label: 'YouTube verwerkt',      pct: 80, color: 'bg-violet-400' },
  verifying:                   { label: 'Verificatie',           pct: 93, color: 'bg-amber-400' },
  verified_live:               { label: 'Live ✓',                pct: 100, color: 'bg-green-400' },
}

const ACTIVE_UPLOAD_STATUSES = ['preparing', 'normalizing', 'uploading', 'uploaded_pending_processing', 'verifying']
const TODAY_START = new Date(); TODAY_START.setUTCHours(0, 0, 0, 0)

export default function WorkerStatusBar() {
  const [genTasks, setGenTasks]   = useState<AgentTask[]>([])
  const [uploads, setUploads]     = useState<QueueItem[]>([])
  const [batch, setBatch]         = useState<BatchStats>({ total: 0, completed: 0, running: 0, pending: 0, failed: 0 })
  const [tick, setTick]           = useState(0)

  useEffect(() => {
    const supabase = createClient()

    async function load() {
      const [
        { data: tasks },
        { data: queue },
        { data: batchRows },
      ] = await Promise.all([
        supabase
          .from('agent_tasks')
          .select('id, status, started_at, created_at, payload')
          .eq('task_type', 'generate_content')
          .in('status', ['running', 'pending', 'claimed'])
          .order('created_at', { ascending: true })
          .limit(10),

        supabase
          .from('youtube_upload_queue')
          .select('id, status, upload_started_at, updated_at, youtube_videos(title), youtube_channels(naam)')
          .in('status', ACTIVE_UPLOAD_STATUSES)
          .not('video_id', 'is', null)
          .order('updated_at', { ascending: false })
          .limit(8),

        supabase
          .from('agent_tasks')
          .select('status')
          .eq('task_type', 'generate_content')
          .gte('created_at', TODAY_START.toISOString()),
      ])

      setGenTasks((tasks ?? []) as AgentTask[])
      setUploads((queue ?? []) as unknown as QueueItem[])

      const rows = batchRows ?? []
      setBatch({
        total:     rows.length,
        completed: rows.filter(r => r.status === 'completed').length,
        running:   rows.filter(r => r.status === 'running').length,
        pending:   rows.filter(r => ['pending', 'claimed'].includes(r.status)).length,
        failed:    rows.filter(r => r.status === 'failed').length,
      })
    }

    load()
    const dataInterval = setInterval(load, 5_000)
    // Tick every second so progress bars animate smoothly
    const tickInterval = setInterval(() => setTick(t => t + 1), 1_000)

    return () => { clearInterval(dataInterval); clearInterval(tickInterval) }
  }, [])

  const running = genTasks.filter(t => t.status === 'running')
  const waiting = genTasks.filter(t => ['pending', 'claimed'].includes(t.status))
  const hasActivity = running.length > 0 || uploads.length > 0

  // Overall batch progress
  const batchPct = batch.total > 0 ? Math.round((batch.completed / batch.total) * 100) : 0

  if (!hasActivity && batch.total === 0) return null

  return (
    <div className="bg-white/[0.04] border border-white/5 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-white/5">
        <div className="flex items-center gap-2">
          <Zap size={13} className="text-amber-400" />
          <span className="text-xs font-semibold text-white">Worker Status</span>
          {hasActivity && (
            <span className="flex items-center gap-1 text-[10px] text-green-400/80">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              Actief
            </span>
          )}
        </div>
        <span className="text-[10px] text-white/40">↻ 5s</span>
      </div>

      <div className="divide-y divide-white/[0.04]">

        {/* Batch progress bar */}
        {batch.total > 0 && (
          <div className="px-5 py-3 space-y-2">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-white/60 font-medium">Batch vandaag</span>
              <div className="flex items-center gap-3 text-white/40">
                {batch.running > 0  && <span className="text-indigo-400">{batch.running} bezig</span>}
                {batch.pending > 0  && <span>{batch.pending} wacht</span>}
                {batch.failed > 0   && <span className="text-red-400">{batch.failed} fout</span>}
                <span className="text-white/60 font-medium">{batch.completed}/{batch.total}</span>
              </div>
            </div>
            <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full transition-all duration-700"
                style={{ width: `${batchPct}%` }}
              />
            </div>
          </div>
        )}

        {/* AI Generator — running tasks */}
        {running.length > 0 && (
          <div className="px-5 py-3 space-y-3">
            <div className="flex items-center gap-2 text-[11px] text-white/50">
              <Cpu size={11} className="text-indigo-400" />
              <span className="font-medium text-white/70">AI Generator</span>
            </div>
            {running.map(task => {
              const step = inferGenStep(task.started_at)
              return (
                <div key={task.id} className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-2 min-w-0">
                      <Loader2 size={10} className="text-indigo-400 animate-spin flex-shrink-0" />
                      <span className="text-white/70 font-medium">{task.payload?.channel_name ?? '—'}</span>
                      <span className="text-white/35 truncate hidden sm:block">
                        {task.payload?.video_type === 'short' ? 'Short' : 'Longform'} · {task.payload?.topic?.slice(0, 40) ?? '—'}
                      </span>
                    </div>
                    <span className="text-white/40 flex-shrink-0 ml-2">{step.pct}%</span>
                  </div>
                  <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-500 rounded-full transition-all duration-1000"
                      style={{ width: `${step.pct}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-white/35">{step.label}</p>
                </div>
              )
            })}
          </div>
        )}

        {/* Waiting tasks summary */}
        {waiting.length > 0 && (
          <div className="px-5 py-2.5 flex items-center gap-2 text-[11px] text-white/40">
            <Clock size={10} />
            <span>{waiting.length} taken in wachtrij</span>
            <span className="text-white/25">·</span>
            <span className="truncate">
              {waiting[0]?.payload?.channel_name} · {waiting[0]?.payload?.topic?.slice(0, 35)}
              {waiting.length > 1 ? ` + ${waiting.length - 1} meer` : ''}
            </span>
          </div>
        )}

        {/* Upload Worker — active uploads */}
        {uploads.length > 0 && (
          <div className="px-5 py-3 space-y-3">
            <div className="flex items-center gap-2 text-[11px] text-white/50">
              <Upload size={11} className="text-sky-400" />
              <span className="font-medium text-white/70">Upload Worker</span>
              <span className="text-white/30">·</span>
              <span>{uploads.length} actief</span>
            </div>
            {uploads.map(item => {
              const step = UPLOAD_STEP[item.status] ?? { label: item.status, pct: 0, color: 'bg-white/30' }
              const isUploading = item.status === 'uploading'
              return (
                <div key={item.id} className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-2 min-w-0">
                      <Loader2 size={10} className={clsx('flex-shrink-0 animate-spin', step.color.replace('bg-', 'text-'))} />
                      <span className="text-white/70 font-medium flex-shrink-0">
                        {item.youtube_channels?.naam ?? '—'}
                      </span>
                      <span className="text-white/35 truncate hidden sm:block">
                        {item.youtube_videos?.title?.slice(0, 45) ?? '—'}
                      </span>
                    </div>
                    <span className="text-white/40 flex-shrink-0 ml-2">{step.pct}%</span>
                  </div>
                  <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className={clsx(
                        'h-full rounded-full transition-all duration-700',
                        step.color,
                        isUploading && 'animate-pulse'
                      )}
                      style={{ width: `${step.pct}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-white/35">{step.label}</p>
                </div>
              )
            })}
          </div>
        )}

        {/* All idle */}
        {!hasActivity && batch.completed === batch.total && batch.total > 0 && (
          <div className="px-5 py-3 flex items-center gap-2 text-[11px] text-green-400/70">
            <CheckCircle2 size={12} />
            <span>Batch klaar — {batch.completed} videos gegenereerd vandaag</span>
          </div>
        )}
      </div>
    </div>
  )
}
