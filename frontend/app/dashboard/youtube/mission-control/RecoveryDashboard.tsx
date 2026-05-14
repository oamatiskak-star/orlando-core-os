'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { RefreshCw, ShieldAlert, CheckCircle, AlertCircle, Clock, ExternalLink } from 'lucide-react'
import clsx from 'clsx'

type FailureItem = {
  id: string
  status: string
  title: string | null
  retry_count: number
  max_retries: number
  last_error: string | null
  youtube_url: string | null
  youtube_video_id: string | null
  updated_at: string
  scheduled_publish_at: string | null
  youtube_videos: { title: string | null } | null
  youtube_channels: { naam: string } | null
}

type RecoveryAction = {
  id: string
  action: string
  status: string
  message: string | null
  created_at: string
  worker_id: string | null
}

export default function RecoveryDashboard() {
  const [failures, setFailures]   = useState<FailureItem[]>([])
  const [recentLog, setRecentLog] = useState<RecoveryAction[]>([])
  const [loading, setLoading]     = useState<Record<string, boolean>>({})

  useEffect(() => {
    const supabase = createClient()

    const fetch = async () => {
      const [{ data: f }, { data: log }] = await Promise.all([
        supabase
          .from('youtube_upload_queue')
          .select('*, youtube_videos(title), youtube_channels(naam)')
          .in('status', ['failed', 'manual_review_required', 'retrying'])
          .order('updated_at', { ascending: false })
          .limit(30),
        supabase
          .from('media_audit_log')
          .select('*')
          .in('action', ['retry', 'reverify', 'force_publish', 'upload_now', 'cancel', 'worker_restart'])
          .order('created_at', { ascending: false })
          .limit(20),
      ])
      if (f) setFailures(f as FailureItem[])
      if (log) setRecentLog(log as RecoveryAction[])
    }

    fetch()

    const channel = supabase.channel('recovery_dashboard_live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'youtube_upload_queue' }, fetch)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'media_audit_log' }, fetch)
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  async function doAction(action: string, queueId: string) {
    setLoading(prev => ({ ...prev, [`${queueId}_${action}`]: true }))
    try {
      await fetch('/api/youtube/override', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, queue_id: queueId }),
      })
    } finally {
      setLoading(prev => ({ ...prev, [`${queueId}_${action}`]: false }))
    }
  }

  const failureCount  = failures.filter(f => f.status === 'failed').length
  const reviewCount   = failures.filter(f => f.status === 'manual_review_required').length
  const retryingCount = failures.filter(f => f.status === 'retrying').length

  return (
    <div className="space-y-5">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Mislukt',   count: failureCount,  color: 'text-red-400 bg-red-500/10 border-red-500/20' },
          { label: 'Review',    count: reviewCount,   color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
          { label: 'Retrying',  count: retryingCount, color: 'text-sky-400 bg-sky-500/10 border-sky-500/20' },
        ].map(s => (
          <div key={s.label} className={clsx('border rounded-lg px-3 py-2 text-center', s.color)}>
            <p className="text-lg font-bold">{s.count}</p>
            <p className="text-[10px] opacity-80">{s.label}</p>
          </div>
        ))}
      </div>

      {failures.length === 0 ? (
        <div className="flex items-center justify-center gap-2 py-6 text-green-400/60">
          <CheckCircle size={14} />
          <span className="text-xs">Geen failures — systeem gezond</span>
        </div>
      ) : (
        <div className="space-y-1.5">
          {failures.map(item => {
            const title = item.youtube_videos?.title ?? item.title ?? 'geen titel'
            const isManual = item.status === 'manual_review_required'
            const isRetrying = item.status === 'retrying'

            return (
              <div key={item.id} className={clsx(
                'border rounded-lg p-3 space-y-2',
                isManual ? 'border-amber-500/20 bg-amber-500/5' :
                isRetrying ? 'border-sky-500/20 bg-sky-500/5' :
                'border-red-500/15 bg-red-500/5'
              )}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-white/75 truncate">{title}</p>
                    <p className="text-[10px] text-white/40">{item.youtube_channels?.naam} · Retry {item.retry_count}/{item.max_retries}</p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {isManual && <ShieldAlert size={12} className="text-amber-400" />}
                    {isRetrying && <RefreshCw size={12} className="text-sky-400 animate-spin" />}
                    {item.status === 'failed' && <AlertCircle size={12} className="text-red-400" />}
                    <span className="text-[10px] text-white/40">
                      {new Date(item.updated_at).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>

                {item.last_error && (
                  <p className="text-[10px] text-red-400/80 bg-red-500/10 rounded px-2 py-1">{item.last_error}</p>
                )}

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => doAction('retry', item.id)}
                    disabled={loading[`${item.id}_retry`]}
                    className="flex items-center gap-1 text-[10px] text-indigo-400 hover:text-indigo-300 transition-colors"
                  >
                    <RefreshCw size={9} className={loading[`${item.id}_retry`] ? 'animate-spin' : ''} />
                    Retry
                  </button>
                  <button
                    onClick={() => doAction('reverify', item.id)}
                    disabled={loading[`${item.id}_reverify`]}
                    className="flex items-center gap-1 text-[10px] text-amber-400 hover:text-amber-300 transition-colors"
                  >
                    <ShieldAlert size={9} /> Reverify
                  </button>
                  <button
                    onClick={() => doAction('force_publish', item.id)}
                    disabled={loading[`${item.id}_force_publish`]}
                    className="flex items-center gap-1 text-[10px] text-red-400 hover:text-red-300 transition-colors"
                  >
                    Force Publish
                  </button>
                  {item.youtube_url && (
                    <a href={item.youtube_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[10px] text-white/40 hover:text-white/60 transition-colors ml-auto">
                      <ExternalLink size={9} /> YouTube
                    </a>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Recent recovery log */}
      {recentLog.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] text-white/40 font-medium">Recente Recovery Acties</p>
          <div className="bg-black/20 rounded-lg p-3 space-y-1 max-h-40 overflow-y-auto">
            {recentLog.map(log => (
              <div key={log.id} className="flex items-center gap-2 text-[10px]">
                <span className="text-white/30 font-mono flex-shrink-0">
                  {new Date(log.created_at).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}
                </span>
                <span className={clsx(
                  'flex-shrink-0',
                  log.status === 'success' ? 'text-green-400' :
                  log.status === 'failure' ? 'text-red-400' :
                  'text-white/50'
                )}>
                  {log.action}
                </span>
                {log.message && <span className="text-white/35 truncate">{log.message}</span>}
                {log.worker_id && <span className="text-violet-400/40 flex-shrink-0">[{log.worker_id}]</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
