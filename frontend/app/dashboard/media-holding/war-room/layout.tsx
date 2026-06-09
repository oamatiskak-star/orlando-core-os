'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import clsx from 'clsx'
import { Network, Megaphone, CalendarClock, FlaskConical, Banknote } from 'lucide-react'

const TABS = [
  { label: 'Creative Graph', href: '/dashboard/media-holding/war-room',          icon: Network },
  { label: 'Campagnes',      href: '/dashboard/media-holding/war-room/campaigns', icon: Megaphone },
  { label: 'Timeline',       href: '/dashboard/media-holding/war-room/timeline',  icon: CalendarClock },
  { label: 'A/B & Winners',  href: '/dashboard/media-holding/war-room/ab-tests',  icon: FlaskConical },
  { label: 'Revenue',        href: '/dashboard/media-holding/war-room/revenue',   icon: Banknote },
]

export default function WarRoomLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-lg font-semibold text-white">
          <Network size={18} className="text-violet-400" />
          Media War Room
        </h1>
        <p className="text-xs text-white/45">
          De glazen wand van de Content Factory — observeren, niet blokkeren. Hermes produceert autonoom door.
        </p>
      </div>
      <nav className="flex gap-1 border-b border-white/5 pb-0 overflow-x-auto">
        {TABS.map((t) => {
          const Icon = t.icon
          const active = pathname === t.href || (t.href !== '/dashboard/media-holding/war-room' && pathname.startsWith(t.href))
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
