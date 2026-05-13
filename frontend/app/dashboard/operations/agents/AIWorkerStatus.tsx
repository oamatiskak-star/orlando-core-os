'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Cpu, Circle, Zap, Clock, AlertCircle, ChevronRight } from 'lucide-react'
import clsx from 'clsx'

type WorkerStatus = {
  engine: string
  online: boolean
  loaded_model: string | null
  available_models: { name: string; size_gb?: string; family?: string; quant?: string }[]
  running_models: { name: string; size_gb?: string }[]
  response_ms: number | null
  requests_today: number
  avg_duration_s: number | null
  last_error: string | null
  updated_at: string
}

function fmt(s: number | null) {
  if (!s) return '—'
  if (s < 60) return `${Math.round(s)}s`
  return `${Math.floor(s / 60)}m${Math.round(s % 60)}s`
}

function staleness(updated_at: string): boolean {
  return Date.now() - new Date(updated_at).getTime() > 30_000
}

function EngineCard({ w }: { w: WorkerStatus }) {
  const isLM    = w.engine === 'lmstudio'
  const stale   = staleness(w.updated_at)
  const offline = !w.online || stale

  const accentOnline  = isLM ? 'text-violet-400' : 'text-sky-400'
  const bgOnline      = isLM ? 'bg-violet-500/10 border-violet-500/20' : 'bg-sky-500/10 border-sky-500/20'
  const dotColor      = offline ? 'bg-red-400' : w.running_models?.length > 0 ? 'bg-amber-400 animate-pulse' : 'bg-green-400'

  return (
    <div className={clsx(
      'rounded-xl border p-4 space-y-3 flex-1',
      offline ? 'bg-white/[0.03] border-white/5' : bgOnline
    )}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Cpu size={13} className={offline ? 'text-white/30' : accentOnline} />
          <span className="text-xs font-semibold text-white">
            {isLM ? 'LM Studio' : 'Ollama'}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={clsx('w-1.5 h-1.5 rounded-full', dotColor)} />
          <span className={clsx('text-[10px]', offline ? 'text-red-400/80' : 'text-white/40')}>
            {stale ? 'Geen data' : offline ? 'Offline' : w.running_models?.length > 0 ? 'Bezig' : 'Gereed'}
          </span>
        </div>
      </div>

      {/* Loaded model */}
      <div className="space-y-1">
        <p className="text-[10px] text-white/35 uppercase tracking-wide">Actief model</p>
        <p className={clsx('text-xs font-medium truncate', offline ? 'text-white/25' : 'text-white/80')}>
          {w.loaded_model ?? '—'}
        </p>
      </div>

      {/* Running inference */}
      {w.running_models?.length > 0 && (
        <div className="flex items-center gap-1.5 text-[10px] text-amber-400/80">
          <Zap size={9} />
          <span>Inferentie actief — {w.running_models[0].name}</span>
        </div>
      )}

      {/* Available models */}
      {w.available_models?.length > 0 && (
        <div className="space-y-1">
          <p className="text-[10px] text-white/35 uppercase tracking-wide">Modellen</p>
          <div className="space-y-0.5">
            {w.available_models.slice(0, 4).map(m => (
              <div key={m.name} className="flex items-center justify-between">
                <span className="text-[10px] text-white/50 truncate max-w-[130px]">{m.name}</span>
                <span className="text-[10px] text-white/25 flex-shrink-0 ml-1">
                  {m.size_gb ? `${m.size_gb}GB` : ''}{m.quant ? ` · ${m.quant}` : ''}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Response time */}
      {!offline && w.response_ms !== null && (
        <div className="flex items-center gap-1 text-[10px] text-white/35">
          <Clock size={9} />
          <span>{w.response_ms}ms ping</span>
        </div>
      )}

      {/* Error */}
      {offline && w.last_error && (
        <div className="flex items-center gap-1 text-[10px] text-red-400/60">
          <AlertCircle size={9} />
          <span className="truncate">{w.last_error}</span>
        </div>
      )}
    </div>
  )
}

export default function AIWorkerStatus() {
  const [workers, setWorkers] = useState<WorkerStatus[]>([])

  useEffect(() => {
    const supabase = createClient()

    async function load() {
      const { data } = await supabase
        .from('ai_worker_status')
        .select('*')
        .in('engine', ['lmstudio', 'ollama'])
      setWorkers((data ?? []) as WorkerStatus[])
    }

    load()
    const iv = setInterval(load, 10_000)
    return () => clearInterval(iv)
  }, [])

  if (!workers.length) return null

  const lm     = workers.find(w => w.engine === 'lmstudio')
  const ollama = workers.find(w => w.engine === 'ollama')

  const reqToday  = (lm?.requests_today ?? ollama?.requests_today ?? 0)
  const avgDur    = lm?.avg_duration_s ?? ollama?.avg_duration_s ?? null
  const anyOnline = workers.some(w => w.online && !staleness(w.updated_at))

  return (
    <div className="bg-white/[0.04] border border-white/5 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-white/5">
        <div className="flex items-center gap-2">
          <Cpu size={13} className="text-violet-400" />
          <span className="text-xs font-semibold text-white">Lokale AI Workers</span>
          {anyOnline && (
            <span className="flex items-center gap-1 text-[10px] text-green-400/80">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              Online
            </span>
          )}
        </div>
        <span className="text-[10px] text-white/40">↻ 10s</span>
      </div>

      <div className="p-4 space-y-4">
        {/* Engine cards */}
        <div className="flex gap-3">
          {lm     && <EngineCard w={lm} />}
          {ollama && <EngineCard w={ollama} />}
        </div>

        {/* Today's production stats */}
        <div className="grid grid-cols-2 gap-3 pt-1 border-t border-white/[0.04]">
          <div>
            <p className="text-[10px] text-white/35 mb-0.5">Videos vandaag</p>
            <p className="text-sm font-bold text-white">{reqToday}</p>
          </div>
          <div>
            <p className="text-[10px] text-white/35 mb-0.5">Gem. generatietijd</p>
            <p className="text-sm font-bold text-white">{fmt(avgDur)}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
