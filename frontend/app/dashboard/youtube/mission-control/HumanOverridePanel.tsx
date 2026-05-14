'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Upload, RefreshCw, ShieldCheck, PauseCircle, Zap, Skull, Database, ArrowUpDown,
  Video, AlertTriangle,
} from 'lucide-react'
import clsx from 'clsx'

type Channel = { id: string; naam: string }
type QueueItem = {
  id: string
  status: string
  title: string | null
  youtube_videos: { title: string | null }[] | null
}

export default function HumanOverridePanel() {
  const [channels, setChannels]   = useState<Channel[]>([])
  const [queueItems, setQueueItems] = useState<QueueItem[]>([])
  const [selectedQueue, setSelectedQueue] = useState('')
  const [selectedChannel, setSelectedChannel] = useState('')
  const [loading, setLoading]     = useState<string | null>(null)
  const [result, setResult]       = useState<{ ok: boolean; msg: string } | null>(null)

  useEffect(() => {
    const supabase = createClient()

    Promise.all([
      supabase.from('youtube_channels').select('id, naam').order('naam'),
      supabase.from('youtube_upload_queue')
        .select('id, status, title, youtube_videos(title)')
        .in('status', ['failed', 'manual_review_required', 'queued', 'uploading', 'verifying'])
        .order('updated_at', { ascending: false })
        .limit(50),
    ]).then(([{ data: ch }, { data: q }]) => {
      if (ch) setChannels(ch as Channel[])
      if (q) setQueueItems(q as QueueItem[])
    })
  }, [])

  async function run(action: string, extra: Record<string, string> = {}) {
    setLoading(action)
    setResult(null)
    try {
      const res = await fetch('/api/youtube/override', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          queue_id:   selectedQueue  || undefined,
          channel_id: selectedChannel || undefined,
          ...extra,
        }),
      })
      const json = await res.json()
      setResult({ ok: res.ok, msg: res.ok ? `✓ ${action} uitgevoerd` : `✗ ${json.error ?? 'Fout'}` })
    } catch (e: any) {
      setResult({ ok: false, msg: `✗ ${e.message}` })
    } finally {
      setLoading(null)
    }
  }

  const ACTIONS = [
    {
      group: 'Queue Acties',
      items: [
        { id: 'upload_now',   label: 'Upload Nu',        icon: Upload,     color: 'text-green-400 border-green-500/20 hover:bg-green-500/10',   needs: 'queue' },
        { id: 'retry',        label: 'Retry',            icon: RefreshCw,  color: 'text-indigo-400 border-indigo-500/20 hover:bg-indigo-500/10', needs: 'queue' },
        { id: 'reverify',     label: 'Reverify',         icon: ShieldCheck,color: 'text-amber-400 border-amber-500/20 hover:bg-amber-500/10',   needs: 'queue' },
        { id: 'force_publish',label: 'Force Publish',    icon: Zap,        color: 'text-red-400 border-red-500/20 hover:bg-red-500/10',          needs: 'queue' },
        { id: 'cancel',       label: 'Cancel',           icon: Skull,      color: 'text-red-400/70 border-red-500/10 hover:bg-red-500/5',        needs: 'queue' },
      ],
    },
    {
      group: 'Kanaal Acties',
      items: [
        { id: 'pause_channel', label: 'Pause Kanaal', icon: PauseCircle, color: 'text-amber-400 border-amber-500/20 hover:bg-amber-500/10', needs: 'channel' },
      ],
    },
  ]

  return (
    <div className="space-y-5">
      {/* Context selectors */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-[11px] text-white/50">Queue item selecteren</label>
          <select
            value={selectedQueue}
            onChange={e => setSelectedQueue(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white/80 focus:outline-none focus:border-indigo-500/40"
          >
            <option value="">— selecteer een item —</option>
            {queueItems.map(q => (
              <option key={q.id} value={q.id}>
                [{q.status}] {q.youtube_videos?.[0]?.title ?? q.title ?? q.id.slice(0, 16)}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-[11px] text-white/50">Kanaal selecteren</label>
          <select
            value={selectedChannel}
            onChange={e => setSelectedChannel(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white/80 focus:outline-none focus:border-indigo-500/40"
          >
            <option value="">— selecteer een kanaal —</option>
            {channels.map(c => (
              <option key={c.id} value={c.id}>{c.naam}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Action groups */}
      {ACTIONS.map(group => (
        <div key={group.group} className="space-y-2">
          <p className="text-[10px] text-white/40 font-medium">{group.group}</p>
          <div className="flex flex-wrap gap-2">
            {group.items.map(({ id, label, icon: Icon, color, needs }) => {
              const disabled =
                (needs === 'queue'   && !selectedQueue) ||
                (needs === 'channel' && !selectedChannel) ||
                loading === id

              return (
                <button
                  key={id}
                  onClick={() => run(id)}
                  disabled={disabled}
                  title={disabled && !loading ? `Selecteer eerst een ${needs === 'queue' ? 'queue item' : 'kanaal'}` : undefined}
                  className={clsx(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all',
                    color,
                    disabled && 'opacity-40 cursor-not-allowed'
                  )}
                >
                  <Icon size={11} className={loading === id ? 'animate-spin' : ''} />
                  {label}
                </button>
              )
            })}
          </div>
        </div>
      ))}

      {/* Warning */}
      <div className="flex items-start gap-2 text-[10px] text-amber-400/60 bg-amber-500/5 border border-amber-500/10 rounded-lg px-3 py-2">
        <AlertTriangle size={11} className="flex-shrink-0 mt-0.5" />
        <p>Human Override bypast de normale pipeline. Alle acties worden gelogd in de audit log. Gebruik alleen bij vastlopende of foutieve items.</p>
      </div>

      {/* Result feedback */}
      {result && (
        <div className={clsx(
          'px-3 py-2 rounded-lg text-xs font-medium',
          result.ok ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
        )}>
          {result.msg}
        </div>
      )}
    </div>
  )
}
