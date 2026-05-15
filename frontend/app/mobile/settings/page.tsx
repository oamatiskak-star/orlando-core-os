import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import StatusPill from '@/components/mobile/StatusPill'
import PushSetup from '@/components/mobile/PushSetup'
import { Settings, Cpu, Bell, Info, ExternalLink, Globe } from 'lucide-react'

export const metadata: Metadata = { title: 'Instellingen' }
export const dynamic = 'force-dynamic'
export const revalidate = 0

function timeAgo(iso: string | null): string {
  if (!iso) return 'Nooit'
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (m < 1) return 'Nu'
  if (m < 60) return `${m}m geleden`
  if (m < 1440) return `${Math.floor(m / 60)}u geleden`
  return `${Math.floor(m / 1440)}d geleden`
}

export default async function MobileSettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [workersRes, subscriptionsRes] = await Promise.allSettled([
    supabase.from('worker_registry').select('id,worker_type,status,last_heartbeat,description').order('worker_type'),
    supabase.from('push_subscriptions').select('id,user_agent,created_at').eq('user_id', user?.id ?? '').order('created_at', { ascending: false }),
  ])

  const workers       = workersRes.status       === 'fulfilled' ? (workersRes.value.data       ?? []) : []
  const subscriptions = subscriptionsRes.status === 'fulfilled' ? (subscriptionsRes.value.data ?? []) : []

  const onlineCount  = workers.filter((w: any) => w.status === 'online' || w.status === 'busy').length
  const offlineCount = workers.filter((w: any) => w.status === 'offline').length

  return (
    <div className="max-w-lg mx-auto px-4 py-5 space-y-6"
      style={{ paddingTop: 'calc(1.25rem + env(safe-area-inset-top))' }}>

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0">
          <Settings size={16} className="text-white/55" />
        </div>
        <div>
          <h1 className="text-base font-bold text-white">Instellingen</h1>
          <p className="text-[11px] text-white/40">App & push notificaties</p>
        </div>
      </div>

      {/* User info */}
      {user && (
        <section>
          <h2 className="text-[11px] text-white/38 font-semibold uppercase tracking-wider mb-3">Account</h2>
          <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
                <span className="text-sm font-bold text-white/60">
                  {(user.email?.[0] ?? 'U').toUpperCase()}
                </span>
              </div>
              <div>
                <p className="text-sm text-white/75 font-medium">{user.email}</p>
                <p className="text-[10px] text-white/30 mt-0.5">Orlando Core OS</p>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Push notifications */}
      <section>
        <h2 className="text-[11px] text-white/38 font-semibold uppercase tracking-wider mb-3">Push Notificaties</h2>
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
          {subscriptions.length > 0 && (
            <div className="pt-3 border-t border-white/[0.06]">
              <p className="text-[10px] text-white/35 mb-2">{subscriptions.length} apparaat{subscriptions.length !== 1 ? 'en' : ''} ingeschreven</p>
              <div className="space-y-1.5">
                {subscriptions.map((sub: any) => (
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
      </section>

      {/* Workers */}
      <section>
        <h2 className="text-[11px] text-white/38 font-semibold uppercase tracking-wider mb-3">
          Workers
          <span className="ml-2 text-white/25 font-normal normal-case tracking-normal">
            {onlineCount} online · {offlineCount} offline
          </span>
        </h2>
        {workers.length === 0 ? (
          <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl px-4 py-3">
            <p className="text-sm text-white/30">Geen workers geregistreerd</p>
          </div>
        ) : (
          <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl divide-y divide-white/[0.04]">
            {workers.map((w: any) => (
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
        )}
      </section>

      {/* App info */}
      <section>
        <h2 className="text-[11px] text-white/38 font-semibold uppercase tracking-wider mb-3">App info</h2>
        <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl divide-y divide-white/[0.04]">
          {[
            { label: 'Platform',  value: 'Orlando Core OS' },
            { label: 'Versie',    value: 'PWA 1.0' },
            { label: 'Tijdzone',  value: 'Europe/Amsterdam' },
            { label: 'Dashboard', value: '/dashboard', link: true },
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
      </section>
    </div>
  )
}
