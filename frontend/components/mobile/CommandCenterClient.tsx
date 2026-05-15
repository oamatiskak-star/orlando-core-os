'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Play, GitBranch, Bell, Settings, Search, Zap } from 'lucide-react'
import StatusPill from './StatusPill'
import SortableSection from './SortableSection'

type SectionId = 'quick-links' | 'systems' | 'yt-channels'

const SECTION_LABELS: Record<SectionId, string> = {
  'quick-links': 'Snelkoppelingen',
  'systems':     'Systemen',
  'yt-channels': 'YouTube Kanalen',
}

const DEFAULT_ORDER: SectionId[] = ['quick-links', 'systems', 'yt-channels']
const LS_ORDER     = 'cc-section-order'
const LS_COLLAPSED = 'cc-section-collapsed'

const QUICK_LINKS = [
  { href: '/mobile/youtube',       label: 'YouTube',      icon: Play,       color: 'text-red-400     bg-red-500/10     border-red-500/20' },
  { href: '/mobile/content',       label: 'Content',      icon: Zap,        color: 'text-violet-400  bg-violet-500/10  border-violet-500/20' },
  { href: '/mobile/scrapers',      label: 'Vastgoed',     icon: Search,     color: 'text-sky-400     bg-sky-500/10     border-sky-500/20' },
  { href: '/mobile/workflows',     label: 'Workflows',    icon: GitBranch,  color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
  { href: '/mobile/notifications', label: 'Meldingen',    icon: Bell,       color: 'text-orange-400  bg-orange-500/10  border-orange-500/20' },
  { href: '/mobile/settings',      label: 'Instellingen', icon: Settings,   color: 'text-white/55    bg-white/5        border-white/10' },
]

function fmt(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return String(n)
}

function timeAgo(iso: string | null): string {
  if (!iso) return 'Nooit'
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (m < 1) return 'Nu'
  if (m < 60) return `${m}m geleden`
  if (m < 1440) return `${Math.floor(m / 60)}u geleden`
  return `${Math.floor(m / 1440)}d geleden`
}

interface SystemItem {
  label: string
  href: string
  icon: React.ComponentType<{ size?: number; className?: string }>
  iconColor: string
  status: string
  stats: { key: string; val: number; alert?: boolean }[]
}

interface Props {
  workers: any[]
  ytChannels: any[]
  systems: SystemItem[]
  unread: number
}

export default function CommandCenterClient({ workers, ytChannels, systems, unread }: Props) {
  const [order, setOrder]         = useState<SectionId[]>(DEFAULT_ORDER)
  const [collapsed, setCollapsed] = useState<Set<SectionId>>(new Set())
  const [editing, setEditing]     = useState(false)

  useEffect(() => {
    try {
      const savedOrder = localStorage.getItem(LS_ORDER)
      if (savedOrder) {
        const parsed: SectionId[] = JSON.parse(savedOrder)
          .filter((id: string) => DEFAULT_ORDER.includes(id as SectionId))
        const merged = [...new Set([...parsed, ...DEFAULT_ORDER])] as SectionId[]
        setOrder(merged)
      }
      const savedCollapsed = localStorage.getItem(LS_COLLAPSED)
      if (savedCollapsed) setCollapsed(new Set(JSON.parse(savedCollapsed)))
    } catch {}
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
    const next = [...order]
    ;[next[idx - 1], next[idx]] = [next[idx], next[idx - 1]]
    saveOrder(next)
  }

  function moveDown(id: SectionId) {
    const idx = order.indexOf(id)
    if (idx >= order.length - 1) return
    const next = [...order]
    ;[next[idx], next[idx + 1]] = [next[idx + 1], next[idx]]
    saveOrder(next)
  }

  const visibleOrder = order.filter(id => {
    if (id === 'yt-channels' && ytChannels.length === 0) return false
    return true
  })

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <button
          onClick={() => setEditing(e => !e)}
          className={`px-4 min-h-[44px] rounded-xl text-[11px] font-medium transition-colors border ${
            editing
              ? 'bg-indigo-600/80 border-indigo-500/50 text-white'
              : 'bg-indigo-500/15 border-indigo-500/40 text-indigo-300'
          }`}
        >
          {editing ? 'Klaar' : 'Rangschikken'}
        </button>
      </div>

      {visibleOrder.map((id, idx) => (
        <SortableSection
          key={id}
          label={SECTION_LABELS[id]}
          collapsed={collapsed.has(id)}
          editing={editing}
          isFirst={idx === 0}
          isLast={idx === visibleOrder.length - 1}
          onToggleCollapse={() => toggleCollapse(id)}
          onMoveUp={() => moveUp(id)}
          onMoveDown={() => moveDown(id)}
        >
          {id === 'quick-links' && (
            <div className="grid grid-cols-3 gap-2.5">
              {QUICK_LINKS.map(link => {
                const [tc, bg, bc] = link.color.split(' ')
                const Icon = link.icon
                return (
                  <Link key={link.label} href={link.href}
                    className={`flex flex-col items-center justify-center gap-1.5 rounded-xl border p-3 min-h-[4.5rem] transition-colors active:scale-95 ${bg} ${bc}`}>
                    <Icon size={20} className={tc} />
                    <span className="text-[11px] text-white/70 font-medium text-center leading-tight">{link.label}</span>
                  </Link>
                )
              })}
            </div>
          )}

          {id === 'systems' && (
            <div className="space-y-2.5">
              {systems.map(sys => {
                const Icon = sys.icon
                return (
                  <Link key={sys.label} href={sys.href}
                    className="flex items-center gap-3 bg-white/[0.04] border border-white/[0.06] rounded-xl px-4 py-3 hover:bg-white/[0.06] active:scale-[0.99] transition-all">
                    <div className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center flex-shrink-0">
                      <Icon size={16} className={sys.iconColor} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-white">{sys.label}</span>
                        <StatusPill status={sys.status} size="xs" />
                      </div>
                      <div className="flex items-center gap-3">
                        {sys.stats.map(st => (
                          <span key={st.key} className={`text-[11px] ${st.alert ? 'text-red-400' : 'text-white/40'}`}>
                            {st.key}: <span className={`font-medium ${st.alert ? 'text-red-400' : 'text-white/65'}`}>{st.val}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                    <span className="text-white/20 text-sm">›</span>
                  </Link>
                )
              })}
            </div>
          )}

          {id === 'yt-channels' && (
            <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl divide-y divide-white/[0.04]">
              {ytChannels.map((ch: any) => (
                <Link key={ch.id} href="/mobile/youtube"
                  className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.03] active:bg-white/[0.06] transition-colors">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${ch.oauth_connected ? 'bg-emerald-400' : 'bg-white/20'}`} />
                  <span className="flex-1 text-sm text-white/75 font-medium">{ch.naam}</span>
                  <div className="flex items-center gap-3 text-right">
                    <span className="text-[11px] text-white/40">
                      <span className="text-white/65 font-medium">{fmt(ch.subscriber_count ?? 0)}</span> subs
                    </span>
                    {!ch.oauth_connected && (
                      <span className="text-[10px] text-amber-400/70 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded-full">
                        Verbinden
                      </span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </SortableSection>
      ))}
    </div>
  )
}
