'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Clock, CheckCircle, AlertCircle, Loader2, ChevronDown, ChevronRight } from 'lucide-react'
import clsx from 'clsx'

type QueueItem = {
  id: string
  status: string
  title: string | null
  scheduled_publish_at: string | null
  upload_started_at: string | null
  upload_finished_at: string | null
  verification_finished_at: string | null
  created_at: string
  updated_at: string
  youtube_video_id: string | null
  youtube_url: string | null
  last_error: string | null
  youtube_videos: { title: string | null; description: string | null } | null
  youtube_channels: { naam: string } | null
}

type LogEvent = {
  id: string
  queue_id: string
  action: string
  status: string
  message: string | null
  created_at: string
  worker_id: string | null
}

const PIPELINE_STAGES = [
  { key: 'planned',                    label: 'Gepland',       color: 'text-white/30' },
  { key: 'queued',                     label: 'In wachtrij',   color: 'text-white/50' },
  { key: 'preparing',                  label: 'Voorbereiden',  color: 'text-sky-400' },
  { key: 'normalizing',                label: 'FFmpeg',        color: 'text-sky-400' },
  { key: 'uploading',                  label: 'Uploaden',      color: 'text-indigo-400' },
  { key: 'uploaded_pending_processing',label: 'YT verwerkt',   color: 'text-violet-400' },
  { key: 'processing',                 label: 'Processing',    color: 'text-violet-400' },
  { key: 'verifying',                  label: 'Verificatie',   color: 'text-amber-400' },
  { key: 'verified_live',              label: '✓ Live',        color: 'text-green-400' },
  { key: 'failed',                     label: '✗ Mislukt',     color: 'text-red-400' },
]

function stageIndex(status: string) {
  return PIPELINE_STAGES.findIndex(s => s.key === status)
}

export default function WorkflowTimeline() {
  const [items, setItems]       = useState<QueueItem[]>([])
  const [expanded, setExpanded] = useState<string | null>(null)
  const [logs, setLogs]         = useState<Record<string, LogEvent[]>>({})

  useEffect(() => {
    const supabase = createClient()

    const fetch = async () => {
      const { data } = await supabase
        .from('youtube_upload_queue')
        .select('*, youtube_videos(title, description), youtube_channels(naam)')
        .not('video_id', 'is', null)
        .not('status', 'in', '("planned")')
        .order('updated_at', { ascending: false })
        .limit(30)
      if (data) setItems(data as QueueItem[])
    }

    fetch()

    const channel = supabase.channel('workflow_timeline_live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'youtube_upload_queue' }, fetch)
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  async function loadLogs(queueId: string) {
    if (logs[queueId]) return
    const supabase = createClient()
    const { data } = await supabase
      .from('media_audit_log')
      .select('*')
      .eq('queue_id', queueId)
      .order('created_at')
    setLogs(prev => ({ ...prev, [queueId]: (data as LogEvent[]) ?? [] }))
  }

  function expand(id: string) {
    const next = expanded === id ? null : id
    setExpanded(next)
    if (next) loadLogs(next)
  }

  if (!items.length) {
    return <p className="text-center py-6 text-xs text-white/30">Geen actieve pipeline items</p>
  }

  return (
    <div className="space-y-2">
      {items.map(item => {
        const curIdx = stageIndex(item.status)
        const isExp  = expanded === item.id
        const title  = item.youtube_videos?.title ?? item.title ?? 'geen titel'

        return (
          <div key={item.id} className="border border-white/5 rounded-lg overflow-hidden">
            {/* Row */}
            <div
              className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.02] cursor-pointer transition-colors"
              onClick={() => expand(item.id)}
            >
              {isExp
                ? <ChevronDown size={11} className="text-white/30 flex-shrink-0" />
                : <ChevronRight size={11} className="text-white/30 flex-shrink-0" />
              }

              {/* Status icon */}
              {item.status === 'verified_live'
                ? <CheckCircle size={11} className="text-green-400 flex-shrink-0" />
                : item.status === 'failed'
                ? <AlertCircle size={11} className="text-red-400 flex-shrink-0" />
                : ['preparing','normalizing','uploading','processing','verifying'].includes(item.status)
                ? <Loader2 size={11} className="text-sky-400 animate-spin flex-shrink-0" />
                : <Clock size={11} className="text-white/30 flex-shrink-0" />
              }

              {/* Title */}
              <span className="text-xs text-white/75 flex-1 truncate">{title}</span>

              {/* Channel */}
              <span className="text-[10px] text-white/40 hidden sm:block flex-shrink-0">{item.youtube_channels?.naam}</span>

              {/* Progress bar (pipeline stages) */}
              <div className="hidden md:flex items-center gap-0.5 flex-shrink-0">
                {PIPELINE_STAGES.filter(s => !['failed'].includes(s.key)).map((stage, idx) => (
                  <div
                    key={stage.key}
                    className={clsx(
                      'h-1 w-4 rounded-full transition-colors',
                      idx < curIdx ? 'bg-green-400/60' :
                      idx === curIdx ? 'bg-sky-400' :
                      'bg-white/10'
                    )}
                    title={stage.label}
                  />
                ))}
              </div>

              {/* Current stage label */}
              <span className={clsx('text-[10px] font-medium flex-shrink-0', PIPELINE_STAGES.find(s => s.key === item.status)?.color ?? 'text-white/50')}>
                {PIPELINE_STAGES.find(s => s.key === item.status)?.label ?? item.status}
              </span>

              {/* Time */}
              <span className="text-[10px] text-white/35 font-mono flex-shrink-0">
                {new Date(item.updated_at).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>

            {/* Expanded timeline */}
            {isExp && (
              <div className="px-4 pb-4 pt-2 border-t border-white/5 bg-[#07070f] space-y-4">
                {/* Stage timeline */}
                <div className="flex items-center gap-1 overflow-x-auto pb-1">
                  {PIPELINE_STAGES.map((stage, idx) => {
                    const done    = idx < curIdx
                    const current = idx === curIdx
                    const pending = idx > curIdx

                    return (
                      <div key={stage.key} className="flex items-center gap-1 flex-shrink-0">
                        <div className={clsx(
                          'flex flex-col items-center gap-1',
                        )}>
                          <div className={clsx(
                            'w-5 h-5 rounded-full flex items-center justify-center border',
                            done    ? 'bg-green-500/20 border-green-500/40 text-green-400' :
                            current ? 'bg-sky-500/20 border-sky-500/40 text-sky-400' :
                            'bg-white/3 border-white/10 text-white/20'
                          )}>
                            {done ? <CheckCircle size={10} /> : current ? <Loader2 size={10} className="animate-spin" /> : <span className="text-[8px]">{idx + 1}</span>}
                          </div>
                          <span className={clsx(
                            'text-[9px] whitespace-nowrap',
                            done ? 'text-green-400/70' : current ? 'text-sky-400' : 'text-white/20'
                          )}>
                            {stage.label}
                          </span>
                        </div>
                        {idx < PIPELINE_STAGES.length - 1 && (
                          <div className={clsx('w-4 h-px flex-shrink-0', done ? 'bg-green-400/30' : 'bg-white/8')} />
                        )}
                      </div>
                    )
                  })}
                </div>

                {/* Key timestamps */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-[11px]">
                  {item.scheduled_publish_at && (
                    <div>
                      <p className="text-white/40">Gepland</p>
                      <p className="text-white/60">{new Date(item.scheduled_publish_at).toLocaleString('nl-NL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                  )}
                  {item.upload_started_at && (
                    <div>
                      <p className="text-white/40">Upload gestart</p>
                      <p className="text-white/60">{new Date(item.upload_started_at).toLocaleTimeString('nl-NL')}</p>
                    </div>
                  )}
                  {item.upload_finished_at && (
                    <div>
                      <p className="text-white/40">Upload klaar</p>
                      <p className="text-white/60">{new Date(item.upload_finished_at).toLocaleTimeString('nl-NL')}</p>
                    </div>
                  )}
                  {item.verification_finished_at && (
                    <div>
                      <p className="text-white/40">Geverifieerd</p>
                      <p className="text-green-400">{new Date(item.verification_finished_at).toLocaleTimeString('nl-NL')}</p>
                    </div>
                  )}
                </div>

                {/* Error */}
                {item.last_error && (
                  <div className="bg-red-500/10 border border-red-500/20 rounded px-3 py-2">
                    <p className="text-red-400 text-[11px]">✗ {item.last_error}</p>
                  </div>
                )}

                {/* Audit log events */}
                {logs[item.id] && logs[item.id].length > 0 && (
                  <div className="space-y-1">
                    <p className="text-[10px] text-white/40 font-medium">Audit Log</p>
                    <div className="bg-black/30 rounded p-2 space-y-1 max-h-32 overflow-y-auto">
                      {logs[item.id].map(log => (
                        <div key={log.id} className="flex items-start gap-2 text-[10px]">
                          <span className="text-white/30 font-mono flex-shrink-0">
                            {new Date(log.created_at).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </span>
                          <span className={clsx(
                            'flex-shrink-0',
                            log.status === 'success' ? 'text-green-400' :
                            log.status === 'failure' ? 'text-red-400' :
                            log.status === 'warning' ? 'text-amber-400' :
                            'text-white/50'
                          )}>
                            {log.action}
                          </span>
                          {log.message && <span className="text-white/40">{log.message}</span>}
                          {log.worker_id && <span className="text-violet-400/50">[{log.worker_id}]</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* YouTube link */}
                {item.youtube_url && (
                  <a
                    href={item.youtube_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-[11px] text-red-400 hover:text-red-300 transition-colors"
                  >
                    <CheckCircle size={11} /> {item.youtube_url}
                  </a>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
