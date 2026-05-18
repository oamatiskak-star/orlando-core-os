'use client'

import { useState, useEffect, useTransition } from 'react'
import { Bell, CheckCheck, Trash2, Loader2, Info, AlertTriangle, CheckCircle, XCircle } from 'lucide-react'
import SortableSection from '@/components/mobile/SortableSection'

type SectionId = 'controls' | 'list'

const SECTION_LABELS: Record<SectionId, string> = {
  controls: 'Filters & acties',
  list:     'Meldingen',
}

const DEFAULT_ORDER: SectionId[] = ['controls', 'list']
const LS_ORDER     = 'no-section-order'
const LS_COLLAPSED = 'no-section-collapsed'

interface Notification {
  id: string
  type: string
  title: string
  body: string
  read: boolean
  created_at: string
}

function timeAgo(iso: string): string {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (m < 1) return 'Nu'
  if (m < 60) return `${m}m geleden`
  if (m < 1440) return `${Math.floor(m / 60)}u geleden`
  return `${Math.floor(m / 1440)}d geleden`
}

const TYPE_META: Record<string, { icon: typeof Info; color: string; bg: string }> = {
  info:    { icon: Info,          color: 'text-sky-400',     bg: 'bg-sky-500/10 border-sky-500/20' },
  success: { icon: CheckCircle,   color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
  warning: { icon: AlertTriangle, color: 'text-amber-400',   bg: 'bg-amber-500/10 border-amber-500/20' },
  error:   { icon: XCircle,       color: 'text-red-400',     bg: 'bg-red-500/10 border-red-500/20' },
}

export default function MobileNotificationsPage() {
  const [notifs, setNotifs]         = useState<Notification[]>([])
  const [loading, setLoading]       = useState(true)
  const [filter, setFilter]         = useState<'all' | 'unread'>('all')
  const [order, setOrder]           = useState<SectionId[]>(DEFAULT_ORDER)
  const [collapsed, setCollapsed]   = useState<Set<SectionId>>(new Set())
  const [editing, setEditing]       = useState(false)
  const [markPending, startMark]    = useTransition()
  const [delPending, startDel]      = useTransition()

  useEffect(() => {
    try {
      const o = localStorage.getItem(LS_ORDER)
      if (o) setOrder(JSON.parse(o))
      const c = localStorage.getItem(LS_COLLAPSED)
      if (c) setCollapsed(new Set(JSON.parse(c)))
    } catch {}
  }, [])

  useEffect(() => {
    setLoading(true)
    const url = filter === 'unread' ? '/api/mobile/notifications?unread=true' : '/api/mobile/notifications'
    fetch(url, { cache: 'no-store' })
      .then(r => r.json())
      .then(j => setNotifs(j.notifications ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [filter])

  function saveOrder(next: SectionId[]) {
    setOrder(next)
    try { localStorage.setItem(LS_ORDER, JSON.stringify(next)) } catch {}
  }
  function toggleCollapse(id: SectionId) {
    setCollapsed(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      try { localStorage.setItem(LS_COLLAPSED, JSON.stringify([...next])) } catch {}
      return next
    })
  }
  function moveUp(id: SectionId) {
    const idx = order.indexOf(id)
    if (idx <= 0) return
    const next = [...order]; [next[idx-1], next[idx]] = [next[idx], next[idx-1]]
    saveOrder(next)
  }
  function moveDown(id: SectionId) {
    const idx = order.indexOf(id)
    if (idx >= order.length - 1) return
    const next = [...order]; [next[idx], next[idx+1]] = [next[idx+1], next[idx]]
    saveOrder(next)
  }

  async function markAllRead() {
    startMark(async () => {
      await fetch('/api/mobile/notifications', { method: 'PATCH' })
      setNotifs(n => n.map(x => ({ ...x, read: true })))
    })
  }
  async function deleteAll() {
    startDel(async () => {
      await fetch('/api/mobile/notifications', { method: 'DELETE' })
      setNotifs([])
    })
  }
  async function markOne(id: string) {
    await fetch(`/api/mobile/notifications/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ read: true }),
    })
    setNotifs(n => n.map(x => x.id === id ? { ...x, read: true } : x))
  }
  async function deleteOne(id: string) {
    await fetch(`/api/mobile/notifications/${id}`, { method: 'DELETE' })
    setNotifs(n => n.filter(x => x.id !== id))
  }

  const unreadCount = notifs.filter(n => !n.read).length

  return (
    <div className="max-w-lg mx-auto px-4 py-5 space-y-5"
>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative w-9 h-9 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center flex-shrink-0">
            <Bell size={16} className="text-orange-400" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-[9px] font-bold text-white flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </div>
          <div>
            <h1 className="text-base font-bold text-white">Meldingen</h1>
            <p className="text-[11px] text-white/40">{unreadCount} ongelezen</p>
          </div>
        </div>
        <button
          onClick={() => setEditing(e => !e)}
          className={`px-4 min-h-[44px] rounded-xl text-[11px] font-medium border transition-colors ${editing ? 'bg-indigo-600/80 border-indigo-500/50 text-white' : 'bg-indigo-500/15 border-indigo-500/40 text-indigo-300'}`}
        >
          {editing ? 'Klaar' : 'Rangschikken'}
        </button>
      </div>

      {order.map((id, idx) => (
        <SortableSection
          key={id}
          label={SECTION_LABELS[id]}
          collapsed={collapsed.has(id)}
          editing={editing}
          isFirst={idx === 0}
          isLast={idx === order.length - 1}
          onToggleCollapse={() => toggleCollapse(id)}
          onMoveUp={() => moveUp(id)}
          onMoveDown={() => moveDown(id)}
        >
          {id === 'controls' && (
            <div className="space-y-3">
              {/* Filter tabs */}
              <div className="flex gap-2">
                {(['all', 'unread'] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`px-4 min-h-[44px] rounded-xl text-[11px] font-medium transition-colors ${
                      filter === f
                        ? 'bg-white/[0.10] text-white border border-white/[0.12]'
                        : 'text-white/40 border border-transparent'
                    }`}
                  >
                    {f === 'all' ? 'Alle' : 'Ongelezen'}
                  </button>
                ))}
              </div>
              {/* Action buttons */}
              <div className="flex gap-2">
                {unreadCount > 0 && (
                  <button
                    onClick={markAllRead}
                    disabled={markPending}
                    className="flex items-center gap-1.5 px-3 py-2 bg-white/[0.06] border border-white/[0.08] rounded-xl text-[11px] text-white/60 disabled:opacity-50"
                  >
                    {markPending ? <Loader2 size={11} className="animate-spin" /> : <CheckCheck size={11} />}
                    Alles gelezen
                  </button>
                )}
                {notifs.length > 0 && (
                  <button
                    onClick={deleteAll}
                    disabled={delPending}
                    className="flex items-center gap-1.5 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-xl text-[11px] text-red-400/80 disabled:opacity-50"
                  >
                    {delPending ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
                    Wis alles
                  </button>
                )}
              </div>
            </div>
          )}

          {id === 'list' && (
            loading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 size={20} className="text-white/30 animate-spin" />
              </div>
            ) : notifs.length === 0 ? (
              <div className="text-center py-10">
                <Bell size={28} className="text-white/15 mx-auto mb-2" />
                <p className="text-sm text-white/30">
                  {filter === 'unread' ? 'Geen ongelezen meldingen' : 'Geen meldingen'}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {notifs.map(notif => {
                  const meta = TYPE_META[notif.type] ?? TYPE_META.info
                  const Icon = meta.icon
                  return (
                    <div
                      key={notif.id}
                      onClick={() => { if (!notif.read) markOne(notif.id) }}
                      className={`flex items-start gap-3 bg-white/[0.04] border rounded-xl px-4 py-3 cursor-pointer transition-colors ${notif.read ? 'border-white/[0.06]' : 'border-white/[0.10]'}`}
                    >
                      <div className={`w-7 h-7 rounded-lg border flex items-center justify-center flex-shrink-0 mt-0.5 ${meta.bg}`}>
                        <Icon size={13} className={meta.color} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className={`text-[12px] font-semibold truncate ${notif.read ? 'text-white/55' : 'text-white/85'}`}>
                            {notif.title}
                          </p>
                          {!notif.read && <span className="w-1.5 h-1.5 rounded-full bg-sky-400 flex-shrink-0" />}
                        </div>
                        {notif.body && (
                          <p className="text-[11px] text-white/38 mt-0.5 line-clamp-2">{notif.body}</p>
                        )}
                        <p className="text-[10px] text-white/25 mt-1">{timeAgo(notif.created_at)}</p>
                      </div>
                      <button
                        onClick={e => { e.stopPropagation(); deleteOne(notif.id) }}
                        className="p-1 text-white/20 hover:text-red-400/60 transition-colors flex-shrink-0"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  )
                })}
              </div>
            )
          )}
        </SortableSection>
      ))}
    </div>
  )
}
