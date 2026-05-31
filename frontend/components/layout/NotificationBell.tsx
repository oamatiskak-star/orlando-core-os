'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Bell, AlertTriangle, XCircle, Info, Check, Zap } from 'lucide-react'

type Item = {
  id: string
  source: 'notification' | 'hermes'
  type: string
  title: string
  message: string | null
  priority: 'low' | 'medium' | 'high' | 'critical'
  read: boolean
  at: string
}

function relTime(iso: string): string {
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return ''
  const s = Math.floor((Date.now() - t) / 1000)
  if (s < 60) return 'net'
  if (s < 3600) return `${Math.floor(s / 60)}m`
  if (s < 86400) return `${Math.floor(s / 3600)}u`
  return `${Math.floor(s / 86400)}d`
}

function icon(it: Item) {
  if (it.source === 'hermes') return <Zap size={14} className="text-fuchsia-400 mt-0.5 shrink-0" />
  if (it.priority === 'critical' || it.priority === 'high')
    return <XCircle size={14} className="text-red-400 mt-0.5 shrink-0" />
  if (it.priority === 'medium') return <AlertTriangle size={14} className="text-amber-400 mt-0.5 shrink-0" />
  return <Info size={14} className="text-white/40 mt-0.5 shrink-0" />
}

export default function NotificationBell() {
  const [items, setItems] = useState<Item[]>([])
  const [unread, setUnread] = useState(0)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/notifications', { cache: 'no-store' })
      if (!r.ok) return
      const j = await r.json()
      setItems(j.items ?? [])
      setUnread(j.unread ?? 0)
    } catch {
      /* stil falen — volgende poll probeert opnieuw */
    }
  }, [])

  useEffect(() => {
    load()
    const t = setInterval(load, 45_000)
    return () => clearInterval(t)
  }, [load])

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (open && ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  async function markAllRead() {
    setBusy(true)
    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mark_all_read' }),
      })
      await load()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => { setOpen(o => !o); if (!open) load() }}
        className="relative p-1.5 rounded-lg hover:bg-white/5 text-white/65 hover:text-white/70 transition-colors"
        aria-label="Notificaties"
      >
        <Bell size={16} />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[15px] h-[15px] px-1 flex items-center justify-center text-[9px] font-bold text-white bg-indigo-500 rounded-full leading-none">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-1rem)] z-50 rounded-xl border border-white/10 bg-[#181830] shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-white/5">
            <span className="text-xs font-semibold text-white">
              Notificaties{unread > 0 ? ` · ${unread} nieuw` : ''}
            </span>
            {unread > 0 && (
              <button
                onClick={markAllRead}
                disabled={busy}
                className="flex items-center gap-1 text-[11px] text-indigo-300 hover:text-indigo-200 disabled:opacity-50"
              >
                <Check size={12} /> Alles gelezen
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto divide-y divide-white/5">
            {items.length === 0 && (
              <p className="px-3 py-8 text-center text-xs text-white/35">Geen notificaties</p>
            )}
            {items.map(it => (
              <div
                key={it.id}
                className={`flex items-start gap-2.5 px-3 py-2.5 ${!it.read ? 'bg-white/[0.03]' : ''}`}
              >
                {icon(it)}
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-white/90 truncate">{it.title}</p>
                  {it.message && <p className="text-[11px] text-white/50 line-clamp-2">{it.message}</p>}
                  <p className="text-[9px] text-white/25 mt-0.5 uppercase tracking-wide">{it.type}</p>
                </div>
                <span className="shrink-0 text-[10px] text-white/30">{relTime(it.at)}</span>
              </div>
            ))}
          </div>

          <a
            href="/dashboard/hermes"
            className="block px-3 py-2 text-center text-[11px] text-fuchsia-300/80 hover:text-fuchsia-200 border-t border-white/5"
          >
            Open Hermes →
          </a>
        </div>
      )}
    </div>
  )
}
