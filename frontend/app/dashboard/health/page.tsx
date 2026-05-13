'use client'

import { useEffect, useState } from 'react'
import { Activity, CheckCircle, XCircle, AlertTriangle } from 'lucide-react'
import clsx from 'clsx'

const services = [
  { name: 'Vercel Frontend', status: 'online', detail: '98ms response' },
  { name: 'Supabase Database', status: 'online', detail: '45ms' },
  { name: 'Supabase Auth', status: 'online', detail: '23ms' },
  { name: 'GitHub Sync', status: 'online', detail: 'Last sync: 5 min geleden' },
  { name: 'Mac Mini 1', status: 'online', detail: 'minivanatiskakl.home' },
  { name: 'Mac Mini 2', status: 'online', detail: 'hostname: unknown' },
  { name: 'YouTube Agent', status: 'online', detail: 'Running' },
  { name: 'Mail Agent', status: 'online', detail: 'Running — 12 verwerkt' },
  { name: 'PDF Generator', status: 'offline', detail: 'Niet gestart' },
]

const events = [
  { time: '09:14:32', type: 'OK', message: 'Mail Agent — 12 e-mails verwerkt' },
  { time: '09:10:01', type: 'OK', message: 'GitHub Sync — 7/7 repos bijgewerkt' },
  { time: '09:05:44', type: 'OK', message: 'Supabase health check — alle services bereikbaar' },
  { time: '08:45:00', type: 'WARN', message: 'Mac Mini 2 — hostname niet resolvebaar' },
  { time: '07:00:00', type: 'ERR', message: 'PDF Generator — process niet gestart' },
]

const typeBadge = (t: string) => {
  if (t === 'OK') return 'bg-green-500/10 text-green-400'
  if (t === 'WARN') return 'bg-amber-500/10 text-amber-400'
  return 'bg-red-500/10 text-red-400'
}

export default function HealthPage() {
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 5000)
    return () => clearInterval(interval)
  }, [])

  const lastChecked = `${new Date().toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-lime-500/10 border border-lime-500/20 flex items-center justify-center">
            <Activity size={16} className="text-lime-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-semibold text-white">System Health</h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-green-500/10 text-green-400">
                Alles operationeel
              </span>
            </div>
            <p className="text-xs text-white/50">Status van alle services, agents en verbindingen.</p>
          </div>
        </div>
        <p className="text-[11px] text-white/38 font-mono">Bijgewerkt: {lastChecked}</p>
      </div>

      {/* Service Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {services.map((svc) => (
          <div key={svc.name} className="bg-white/[0.06] border border-white/5 rounded-xl p-4 flex items-center gap-3">
            {svc.status === 'online' ? (
              <CheckCircle size={16} className="text-green-400 flex-shrink-0" />
            ) : (
              <XCircle size={16} className="text-red-400 flex-shrink-0" />
            )}
            <div className="min-w-0">
              <p className="text-xs font-medium text-white leading-tight">{svc.name}</p>
              <p className="text-[11px] text-white/50 truncate">{svc.detail}</p>
            </div>
            <div className="ml-auto">
              <span className={clsx(
                'px-2 py-0.5 rounded-full text-[10px] font-medium',
                svc.status === 'online' ? 'bg-green-500/10 text-green-400' : 'bg-white/5 text-white/50'
              )}>
                {svc.status === 'online' ? 'Online' : 'Offline'}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Recent Events */}
      <div className="bg-white/[0.06] border border-white/5 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-white">Recente Events</h2>
          <button className="text-[11px] text-indigo-400 hover:text-indigo-300">Alle logs</button>
        </div>
        <div className="space-y-2">
          {events.map((ev, i) => (
            <div key={i} className="flex items-center gap-3 py-2 border-b border-white/5 last:border-0">
              <span className="text-[11px] text-white/45 font-mono w-20 flex-shrink-0">{ev.time}</span>
              <span className={clsx('px-2 py-0.5 rounded text-[10px] font-semibold flex-shrink-0', typeBadge(ev.type))}>
                {ev.type}
              </span>
              <p className="text-xs text-white/60">{ev.message}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Dummy tick usage to silence unused warning */}
      <p className="sr-only">{tick}</p>
    </div>
  )
}
