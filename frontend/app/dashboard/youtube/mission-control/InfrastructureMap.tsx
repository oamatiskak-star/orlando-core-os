'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Monitor, Server, Database, Cloud, Cpu, Wifi, WifiOff, Activity } from 'lucide-react'
import clsx from 'clsx'

type WorkerStatus = {
  id: string
  display_name: string
  host: string
  status: string
  current_task_description: string | null
  cpu_percent: number | null
  ram_mb: number | null
  tasks_today: number
}

type AiEngine = {
  engine: string
  online: boolean
  loaded_model: string | null
  response_ms: number | null
  requests_today: number
  updated_at: string
}

type Node = {
  id: string
  label: string
  sublabel: string
  icon: React.ElementType
  color: string
  services: { id: string; name: string; status: string; detail?: string }[]
}

export default function InfrastructureMap() {
  const [workers, setWorkers] = useState<WorkerStatus[]>([])
  const [aiEngines, setAiEngines] = useState<AiEngine[]>([])

  useEffect(() => {
    const supabase = createClient()

    const fetch = async () => {
      const [{ data: w }, { data: ai }] = await Promise.all([
        supabase.from('worker_registry').select('id, display_name, host, status, current_task_description, cpu_percent, ram_mb, tasks_today'),
        supabase.from('ai_worker_status').select('*'),
      ])
      if (w) setWorkers(w as WorkerStatus[])
      if (ai) setAiEngines(ai as AiEngine[])
    }

    fetch()
    const interval = setInterval(fetch, 10_000)
    return () => clearInterval(interval)
  }, [])

  const workersByHost = (host: string) => workers.filter(w => w.host === host)

  const lmStudio = aiEngines.find(a => a.engine === 'lmstudio')
  const ollama   = aiEngines.find(a => a.engine === 'ollama')

  const nodes: Node[] = [
    {
      id: 'mac1',
      label: 'Mac Mini 1',
      sublabel: 'mac-mini-1',
      icon: Monitor,
      color: 'border-violet-500/30 bg-violet-500/5',
      services: [
        { id: 'ollama',  name: 'Ollama',          status: ollama?.online  ? 'online' : 'offline', detail: ollama?.loaded_model ?? undefined },
        { id: 'factory', name: 'Content Factory',  status: workersByHost('mac-mini-1').find(w => w.id === 'content-factory')?.status ?? 'offline' },
        { id: 'W1',      name: 'Video Worker 1',   status: workersByHost('mac-mini-1').find(w => w.id === 'W1')?.status ?? 'offline', detail: workersByHost('mac-mini-1').find(w => w.id === 'W1')?.current_task_description ?? undefined },
        { id: 'W2',      name: 'Video Worker 2',   status: workersByHost('mac-mini-1').find(w => w.id === 'W2')?.status ?? 'offline', detail: workersByHost('mac-mini-1').find(w => w.id === 'W2')?.current_task_description ?? undefined },
        { id: 'seo',     name: 'SEO Optimizer',    status: workersByHost('mac-mini-1').find(w => w.id === 'seo-optimizer')?.status ?? 'offline' },
      ],
    },
    {
      id: 'mac2',
      label: 'Mac Mini 2',
      sublabel: 'mac-mini-2',
      icon: Monitor,
      color: 'border-indigo-500/30 bg-indigo-500/5',
      services: [
        { id: 'lmstudio', name: 'LM Studio',       status: lmStudio?.online ? 'online' : 'offline', detail: lmStudio?.loaded_model ?? undefined },
        { id: 'tts',      name: 'TTS / edge-tts',  status: 'offline' },
        { id: 'ffmpeg',   name: 'FFmpeg',           status: 'offline' },
      ],
    },
    {
      id: 'render',
      label: 'Render.com',
      sublabel: 'cloud executor',
      icon: Cloud,
      color: 'border-sky-500/30 bg-sky-500/5',
      services: [
        { id: 'upload',   name: 'Upload Worker',    status: workersByHost('render').find(w => w.id === 'upload-worker')?.status ?? 'offline' },
        { id: 'verify',   name: 'Verify Worker',    status: workersByHost('render').find(w => w.id === 'verify-worker')?.status ?? 'offline' },
        { id: 'browser',  name: 'Browser Verifier', status: workersByHost('render').find(w => w.id === 'browser-verify')?.status ?? 'offline' },
        { id: 'recovery', name: 'Recovery Worker',  status: workersByHost('render').find(w => w.id === 'recovery-worker')?.status ?? 'offline' },
        { id: 'slot',     name: 'Slot Filler',      status: workersByHost('render').find(w => w.id === 'slot-filler')?.status ?? 'offline' },
      ],
    },
    {
      id: 'supabase',
      label: 'Supabase',
      sublabel: 'eu-west-1',
      icon: Database,
      color: 'border-green-500/30 bg-green-500/5',
      services: [
        { id: 'db',      name: 'PostgreSQL',       status: 'online' },
        { id: 'storage', name: 'Storage (yt-videos)', status: 'online' },
        { id: 'rt',      name: 'Realtime',         status: 'online' },
        { id: 'auth',    name: 'Auth',             status: 'online' },
      ],
    },
  ]

  function statusColor(s: string) {
    switch (s) {
      case 'online':  return 'text-green-400 bg-green-400'
      case 'busy':    return 'text-sky-400 bg-sky-400'
      case 'idle':    return 'text-white/40 bg-white/30'
      case 'offline': return 'text-white/25 bg-white/15'
      case 'error':   return 'text-red-400 bg-red-400'
      default:        return 'text-white/25 bg-white/15'
    }
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
      {nodes.map(node => {
        const Icon = node.icon
        const onlineCount = node.services.filter(s => s.status === 'online' || s.status === 'busy').length

        return (
          <div key={node.id} className={clsx('border rounded-xl p-4 space-y-3', node.color)}>
            {/* Node header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Icon size={13} className="text-white/60" />
                <div>
                  <p className="text-xs font-semibold text-white/80">{node.label}</p>
                  <p className="text-[10px] text-white/40">{node.sublabel}</p>
                </div>
              </div>
              <span className={clsx(
                'text-[10px] px-2 py-0.5 rounded-full',
                onlineCount > 0 ? 'bg-green-500/10 text-green-400' : 'bg-white/5 text-white/30'
              )}>
                {onlineCount}/{node.services.length}
              </span>
            </div>

            {/* Services */}
            <div className="space-y-1.5">
              {node.services.map(svc => {
                const [textCls, dotCls] = statusColor(svc.status).split(' ')
                return (
                  <div key={svc.id} className="flex items-center gap-2">
                    <span className={clsx('w-1.5 h-1.5 rounded-full flex-shrink-0', dotCls,
                      (svc.status === 'busy' || svc.status === 'error') && 'animate-pulse'
                    )} />
                    <span className="text-[11px] text-white/60 flex-1 min-w-0">{svc.name}</span>
                    {svc.detail && (
                      <span className="text-[10px] text-white/30 truncate max-w-[80px]" title={svc.detail}>
                        {svc.detail}
                      </span>
                    )}
                    <span className={clsx('text-[10px] flex-shrink-0', textCls)}>
                      {svc.status === 'offline' ? '—' : svc.status}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
