'use client'

import { useState, useEffect } from 'react'
import { Settings, Bell, ExternalLink, Loader2 } from 'lucide-react'
import StatusPill from '@/components/mobile/StatusPill'
import PushSetup from '@/components/mobile/PushSetup'
import SortableSection from '@/components/mobile/SortableSection'

type SectionId = 'account' | 'push' | 'workers' | 'app-info'

const SECTION_LABELS: Record<SectionId, string> = {
  account:  'Account',
  push:     'Push Notificaties',
  workers:  'Workers',
  'app-info': 'App info',
}

const DEFAULT_ORDER: SectionId[] = ['account', 'push', 'workers', 'app-info']
const LS_ORDER     = 'se-section-order'
const LS_COLLAPSED = 'se-section-collapsed'

function timeAgo(iso: string | null): string {
  if (!iso) return 'Nooit'
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (m < 1) return 'Nu'
  if (m < 60) return `${m}m geleden`
  if (m < 1440) return `${Math.floor(m / 60)}u geleden`
  return `${Math.floor(m / 1440)}d geleden`
}

interface Worker { id: string; worker_type: string | null; status: string | null; last_heartbeat: string | null; description: string | null }
interface Subscription { id: string; user_agent: string | null; created_at: string }

interface Data {
  email: string | null
  workers: Worker[]
  subscriptions: Subscription[]
}

export default function MobileSettingsPage() {
  const [data, setData]           = useState<Data | null>(null)
  const [order, setOrder]         = useState<SectionId[]>(DEFAULT_ORDER)
  const [collapsed, setCollapsed] = useState<Set<SectionId>>(new Set())
  const [editing, setEditing]     = useState(false)

  useEffect(() => {
    try {
      const o = localStorage.getItem(LS_ORDER)
      if (o) setOrder(JSON.parse(o))
      const c = localStorage.getItem(LS_COLLAPSED)
      if (c) setCollapsed(new Set(JSON.parse(c)))
    } catch {}

    async function load() {
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      const [workers, subs] = await Promise.all([
        supabase.from('worker_registry').select('id,worker_type,status,last_heartbeat,description').order('worker_type'),
        user ? supabase.from('push_subscriptions').select('id,user_agent,created_at').eq('user_id', user.id).order('created_at', { ascending: false }) : Promise.resolve({ data: [] }),
      ])
      setData({
        email:         user?.email ?? null,
        workers:       (workers.data ?? []) as Worker[],
        subscriptions: (subs.data   ?? []) as Subscription[],
      })
    }
    load()
  }, [])

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

  const onlineCount  = (data?.workers ?? []).filter(w => w.status === 'online' || w.status === 'busy').length
  const offlineCount = (data?.workers ?? []).filter(w => w.status === 'offline').length

  const visibleOrder = order.filter(id => {
    if (id === 'account' && !data?.email) return false
    return true
  })

  return (
    <div className="max-w-lg mx-auto px-4 py-5 space-y-6"
>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0">
            <Settings size={16} className="text-white/55" />
          </div>
          <div>
            <h1 className="text-base font-bold text-white">Instellingen</h1>
            <p className="text-[11px] text-white/40">App & push notificaties</p>
          </div>
        </div>
        <button
          onClick={() => setEditing(e => !e)}
          className={`px-4 min-h-[44px] rounded-xl text-[11px] font-medium border transition-colors ${editing ? 'bg-indigo-600/80 border-indigo-500/50 text-white' : 'bg-indigo-500/15 border-indigo-500/40 text-indigo-300'}`}
        >
          {editing ? 'Klaar' : 'Rangschikken'}
        </button>
      </div>

      {!data && (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={20} className="text-white/20 animate-spin" />
        </div>
      )}

      {data && visibleOrder.map((id, idx) => (
        <SortableSection
          key={id}
          label={id === 'workers'
            ? `Workers  ${onlineCount} online · ${offlineCount} offline`
            : SECTION_LABELS[id]
          }
          collapsed={collapsed.has(id)}
          editing={editing}
          isFirst={idx === 0}
          isLast={idx === visibleOrder.length - 1}
          onToggleCollapse={() => toggleCollapse(id)}
          onMoveUp={() => moveUp(id)}
          onMoveDown={() => moveDown(id)}
        >
          {id === 'account' && data.email && (
            <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-bold text-white/60">{data.email[0].toUpperCase()}</span>
                </div>
                <div>
                  <p className="text-sm text-white/75 font-medium">{data.email}</p>
                  <p className="text-[10px] text-white/30 mt-0.5">Orlando Core OS</p>
                </div>
              </div>
            </div>
          )}

          {id === 'push' && (
            <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl px-4 py-4 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-orange-500/10 border border-orange-500/20 flex items-center justify-center flex-shrink-0">
                  <Bell size={14} className="text-orange-400" />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-white/75 font-medium">Web Push</p>
                  <p className="text-[10px] text-white/38">iPhone: voeg toe aan beginscherm voor push-notificaties</p>
                </div>
              </div>
              <PushSetup />
              {data.subscriptions.length > 0 && (
                <div className="pt-3 border-t border-white/[0.06]">
                  <p className="text-[10px] text-white/35 mb-2">
                    {data.subscriptions.length} apparaat{data.subscriptions.length !== 1 ? 'en' : ''} ingeschreven
                  </p>
                  <div className="space-y-1.5">
                    {data.subscriptions.map(sub => (
                      <div key={sub.id} className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
                        <p className="text-[10px] text-white/40 truncate flex-1">
                          {sub.user_agent ? sub.user_agent.split(' ').slice(-2).join(' ') : 'Onbekend apparaat'}
                        </p>
                        <p className="text-[10px] text-white/25 flex-shrink-0">{timeAgo(sub.created_at)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {id === 'workers' && (
            data.workers.length === 0 ? (
              <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl px-4 py-3">
                <p className="text-sm text-white/30">Geen workers geregistreerd</p>
              </div>
            ) : (
              <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl divide-y divide-white/[0.04]">
                {data.workers.map(w => (
                  <div key={w.id} className="flex items-center gap-3 px-4 py-3">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      w.status === 'online'  ? 'bg-emerald-400' :
                      w.status === 'busy'    ? 'bg-amber-400' :
                      w.status === 'offline' ? 'bg-red-400' : 'bg-white/20'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] text-white/75 font-medium truncate">{w.worker_type ?? w.id}</p>
                      {w.description && <p className="text-[10px] text-white/35 truncate">{w.description}</p>}
                    </div>
                    <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                      <StatusPill status={w.status ?? 'unknown'} size="xs" />
                      {w.last_heartbeat && (
                        <span className="text-[10px] text-white/25">{timeAgo(w.last_heartbeat)}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )
          )}

          {id === 'app-info' && (
            <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl divide-y divide-white/[0.04]">
              {[
                { label: 'Platform',  value: 'Orlando Core OS', link: false },
                { label: 'Versie',    value: 'PWA 1.0',         link: false },
                { label: 'Tijdzone',  value: 'Europe/Amsterdam', link: false },
                { label: 'Dashboard', value: '/dashboard',       link: true },
              ].map(item => (
                <div key={item.label} className="flex items-center justify-between px-4 py-3">
                  <span className="text-[11px] text-white/40">{item.label}</span>
                  {item.link ? (
                    <a href={item.value} className="flex items-center gap-1 text-[11px] text-sky-400">
                      {item.value} <ExternalLink size={10} />
                    </a>
                  ) : (
                    <span className="text-[11px] text-white/65 font-medium">{item.value}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </SortableSection>
      ))}
    </div>
  )
}
