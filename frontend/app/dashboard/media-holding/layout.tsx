'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import clsx from 'clsx'
import { LayoutGrid, Layers, Video, Clapperboard, Server } from 'lucide-react'

const TABS = [
  { label: 'Overzicht',       href: '/dashboard/media-holding',          icon: LayoutGrid },
  { label: 'Build Tracker',   href: '/dashboard/media-holding/build',    icon: Layers },
  { label: 'Channels',        href: '/dashboard/media-holding/channels', icon: Video },
  { label: 'Content Factory', href: '/dashboard/media-holding/factory',  icon: Clapperboard },
  { label: 'Workers',         href: '/dashboard/media-holding/workers',  icon: Server },
]

export default function MediaHoldingLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div className="space-y-4">
      <nav className="flex gap-1 border-b border-white/5 pb-0 overflow-x-auto">
        {TABS.map(t => {
          const Icon = t.icon
          const active = pathname === t.href || (t.href !== '/dashboard/media-holding' && pathname.startsWith(t.href))
          return (
            <Link
              key={t.href}
              href={t.href}
              className={clsx(
                'flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 -mb-px whitespace-nowrap transition-colors',
                active
                  ? 'border-violet-400 text-violet-400'
                  : 'border-transparent text-white/50 hover:text-white/60'
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
