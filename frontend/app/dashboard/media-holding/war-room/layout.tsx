'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import clsx from 'clsx'
import {
  Network, Megaphone, CalendarClock, FlaskConical, Banknote,
  LayoutGrid, ClipboardCheck, Sparkles, Cpu, User, LayoutDashboard,
} from 'lucide-react'
import Scoreboard from '@/components/war-room/Scoreboard'

const BASE = '/dashboard/media-holding/war-room'

const TABS = [
  { label: 'Creative Graph',      href: BASE,                 icon: Network },
  { label: 'Creative Workspace',  href: `${BASE}/workspace`,  icon: LayoutDashboard },
  { label: 'Creative Library',    href: `${BASE}/library`,    icon: LayoutGrid },
  { label: 'Campaign Studio',     href: `${BASE}/campaigns`,  icon: Megaphone },
  { label: 'Timeline',            href: `${BASE}/timeline`,   icon: CalendarClock },
  { label: 'A/B & Winners',       href: `${BASE}/ab-tests`,   icon: FlaskConical },
  { label: 'Review Queue',        href: `${BASE}/review`,     icon: ClipboardCheck },
  { label: 'Revenue Attribution', href: `${BASE}/revenue`,    icon: Banknote },
  { label: 'Hermes',              href: `${BASE}/hermes`,     icon: Sparkles },
]

export default function WarRoomLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  // Machine View = Creative Graph (de graaf). Human View = Creative Workspace (operator-laag).
  const isHuman = pathname.startsWith(`${BASE}/workspace`) || pathname.startsWith(`${BASE}/library`)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-semibold text-white">
            <Network size={18} className="text-violet-400" />
            Media War Room
          </h1>
          <p className="text-xs text-white/45">
            De glazen wand van de Content Factory — observeren, niet blokkeren. Hermes produceert autonoom door.
          </p>
        </div>
        {/* Machine / Human view-toggle */}
        <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-[#0e1525] p-0.5 text-xs">
          <Link href={BASE}
            className={clsx('flex items-center gap-1.5 rounded px-2.5 py-1 transition-colors', !isHuman ? 'bg-violet-500/20 text-violet-200' : 'text-white/50 hover:text-white/70')}>
            <Cpu size={13} /> Machine
          </Link>
          <Link href={`${BASE}/workspace`}
            className={clsx('flex items-center gap-1.5 rounded px-2.5 py-1 transition-colors', isHuman ? 'bg-violet-500/20 text-violet-200' : 'text-white/50 hover:text-white/70')}>
            <User size={13} /> Human
          </Link>
        </div>
      </div>

      <Scoreboard />

      <nav className="flex gap-1 border-b border-white/5 pb-0 overflow-x-auto">
        {TABS.map((t) => {
          const Icon = t.icon
          const active = pathname === t.href || (t.href !== BASE && pathname.startsWith(t.href))
          return (
            <Link
              key={t.href}
              href={t.href}
              className={clsx(
                'flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 -mb-px whitespace-nowrap transition-colors',
                active ? 'border-violet-400 text-violet-400' : 'border-transparent text-white/50 hover:text-white/60'
              )}
            >
              <Icon size={12} />
              {t.label}
            </Link>
          )
        })}
      </nav>
      {children}
    </div>
  )
}
