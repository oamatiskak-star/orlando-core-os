'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Activity, ChevronLeft, Power, Zap, RefreshCw, AlertCircle } from 'lucide-react'
import clsx from 'clsx'

type Config = {
  id: string
  link_key: string
  description: string | null
  enabled: boolean
  threshold: number | null
  last_triggered_at: string | null
  trigger_count: number
}

type Event = {
  id: string
  link_key: string
  source_table: string
  source_id: string | null
  target_executor: string
  task_id: string | null
  triggered_at: string
  details: Record<string, unknown> | null
}

function timeAgo(iso: string | null) {
  if (!iso) return 'nooit'
  const diff = Date.now() - new Date(iso).getTime()
  if (diff < 60_000) return `${Math.floor(diff/1000)}s geleden`
  if (diff < 3_600_000) return `${Math.floor(diff/60_000)}m geleden`
  if (diff < 86_400_000) return `${Math.floor(diff/3_600_000)}u geleden`
  return `${Math.floor(diff/86_400_000)}d geleden`
}

export default function AutopilotPage() {
  const [config, setConfig] = useState<Config[]>([])
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [cronRunning, setCronRunning] = useState(false)
  const [msg, setMsg] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [cRes, eRes] = await Promise.all([
        fetch('/api/media-holding/autopilot/config'),
        fetch('/api/media-holding/autopilot/events?limit=60'),
      ])
      if (cRes.ok) {
        const j = await cRes.json()
        setConfig(j.config ?? [])
      }
      if (eRes.ok) {
        const j = await eRes.json()
        setEvents(j.events ?? [])
      }
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  async function toggle(linkKey: string, enabled: boolean) {
    setSaving(linkKey); setMsg('')
    try {
      const r = await fetch('/api/media-holding/autopilot/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ link_key: linkKey, enabled }),
      })
      if (r.ok) {
        await load()
        setMsg(`Link ${linkKey} → ${enabled ? 'AAN' : 'UIT'}`)
      } else {
        const j = await r.json().catch(() => ({}))
        setMsg(`Fout: ${j.error ?? r.status}`)
      }
    } finally { setSaving(null) }
  }

  async function changeThreshold(linkKey: string, threshold: number) {
    setSaving(linkKey); setMsg('')
    try {
      const r = await fetch('/api/media-holding/autopilot/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ link_key: linkKey, threshold }),
      })
      if (r.ok) {
        await load()
        setMsg(`Threshold ${linkKey} → ${threshold}`)
      } else {
        const j = await r.json().catch(() => ({}))
        setMsg(`Fout: ${j.error ?? r.status}`)
      }
    } finally { setSaving(null) }
  }

  async function runCron() {
    setCronRunning(true); setMsg('')
    try {
      const r = await fetch('/api/media-holding/autopilot/cron', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      if (r.ok) {
        const j = await r.json()
        setMsg(`Cron tick gestart — task ${j.task_id?.slice(0, 8)}…`)
        setTimeout(load, 10_000)
      } else {
        const j = await r.json().catch(() => ({}))
        setMsg(`Fout: ${j.error ?? r.status}`)
      }
    } finally { setCronRunning(false) }
  }

  const enabledCount = config.filter((c) => c.enabled).length

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/media-holding" className="text-white/40 hover:text-white">
          <ChevronLeft size={16} />
        </Link>
        <div className="w-9 h-9 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
          <Activity size={16} className="text-violet-400" />
        </div>
        <div className="flex-1">
          <h1 className="text-base font-semibold text-white">Autopilot — Autonomous Scaling</h1>
          <p className="text-xs text-white/50">4 chain links · {enabledCount} actief · auto-dispatch zonder menselijke knop</p>
        </div>
        <button
          onClick={runCron}
          disabled={cronRunning}
          className="flex items-center gap-1.5 bg-violet-500/20 border border-violet-500/30 hover:bg-violet-500/30 disabled:opacity-50 text-violet-300 text-xs font-medium px-3 py-1.5 rounded-lg"
        >
          <RefreshCw size={12} className={cronRunning ? 'animate-spin' : ''} /> Run cron tick
        </button>
      </div>

      {msg && (
        <div className="bg-white/[0.04] border border-white/10 rounded-lg px-4 py-2.5 text-[11px] text-white/70">
          {msg}
        </div>
      )}

      {/* Chain links */}
      <div>
        <h2 className="text-[10px] font-semibold text-white/40 uppercase tracking-wider mb-3">Chain links</h2>
        {loading ? (
          <div className="p-10 text-center text-xs text-white/40">Laden…</div>
        ) : (
          <div className="space-y-2">
            {config.map((c) => (
              <div key={c.id} className={clsx(
                'flex items-center gap-4 p-4 rounded-xl border',
                c.enabled ? 'bg-emerald-500/[0.04] border-emerald-500/20' : 'bg-white/[0.04] border-white/8'
              )}>
                <button
                  onClick={() => toggle(c.link_key, !c.enabled)}
                  disabled={saving === c.link_key}
                  className={clsx(
                    'shrink-0 w-10 h-6 rounded-full transition-colors flex items-center px-0.5',
                    c.enabled ? 'bg-emerald-500/40 justify-end' : 'bg-white/10 justify-start'
                  )}
                >
                  <span className="w-5 h-5 rounded-full bg-white" />
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-semibold text-white">{c.link_key}</span>
                    {c.enabled && <Power size={11} className="text-emerald-400" />}
                  </div>
                  <p className="text-[10px] text-white/45 line-clamp-1">{c.description}</p>
                  <p className="text-[10px] text-white/30 mt-0.5">
                    {c.trigger_count} triggers · laatst: {timeAgo(c.last_triggered_at)}
                  </p>
                </div>
                {c.threshold !== null && (
                  <div className="shrink-0">
                    <p className="text-[9px] text-white/40 uppercase tracking-wider">Threshold</p>
                    <input
                      type="number"
                      defaultValue={c.threshold}
                      onBlur={(e) => {
                        const v = parseFloat(e.target.value)
                        if (!isNaN(v) && v !== c.threshold) changeThreshold(c.link_key, v)
                      }}
                      className="w-20 bg-white/[0.06] border border-white/10 rounded px-2 py-1 text-xs text-white tabular-nums"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Event log */}
      <div>
        <h2 className="text-[10px] font-semibold text-white/40 uppercase tracking-wider mb-3">Recent triggers</h2>
        {events.length === 0 ? (
          <div className="p-10 text-center bg-white/[0.04] border border-white/5 rounded-xl">
            <AlertCircle size={32} className="mx-auto text-white/30 mb-3" />
            <p className="text-sm text-white/65">Nog geen autopilot events.</p>
            <p className="text-[11px] text-white/40 mt-1">Schakel een chain in en wacht op een signaal.</p>
          </div>
        ) : (
          <div className="space-y-1">
            {events.map((e) => (
              <div key={e.id} className="flex items-center gap-3 px-3 py-2 bg-white/[0.04] border border-white/5 rounded-lg">
                <Zap size={11} className="text-violet-300 shrink-0" />
                <span className="text-[11px] font-medium text-white/85 shrink-0">{e.link_key}</span>
                <span className="text-[10px] text-white/45 shrink-0">→</span>
                <span className="text-[11px] text-violet-300 shrink-0">{e.target_executor}</span>
                <span className="text-[10px] text-white/35 truncate flex-1">{e.source_table} · {e.source_id?.slice(0, 8)}</span>
                <span className="text-[10px] text-white/40 tabular-nums shrink-0">{timeAgo(e.triggered_at)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
