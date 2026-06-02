'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import clsx from 'clsx'
import { LayoutGrid, Upload, Clock, BarChart2, Zap, ScrollText, Radar, Target, Lightbulb } from 'lucide-react'

const TABS = [
  { label: 'Overzicht',        href: '/dashboard/youtube',                    icon: LayoutGrid },
  { label: 'Mission Control',  href: '/dashboard/youtube/mission-control',    icon: Radar },
  { label: 'Content-radar',    href: '/dashboard/youtube/radar',              icon: Lightbulb },
  { label: 'Strategie',        href: '/dashboard/youtube/strategy',           icon: Target },
  { label: 'Queue',            href: '/dashboard/youtube/queue',              icon: Upload },
  { label: 'Scheduled',        href: '/dashboard/youtube/scheduled',          icon: Clock },
  { label: 'Analytics',        href: '/dashboard/youtube/analytics',          icon: BarChart2 },
  { label: 'Automation',       href: '/dashboard/youtube/automation',         icon: Zap },
  { label: 'Logs',             href: '/dashboard/youtube/logs',               icon: ScrollText },
]

export default function YouTubeLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div className="space-y-4">
      <nav className="flex gap-1 border-b border-white/5 pb-0 overflow-x-auto">
        {TABS.map(t => {
          const Icon = t.icon
          const active = pathname === t.href || (t.href !== '/dashboard/youtube' && pathname.startsWith(t.href))
          return (
            <Link
              key={t.href}
              href={t.href}
              className={clsx(
                'flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 -mb-px whitespace-nowrap transition-colors',
                active
                  ? 'border-indigo-400 text-indigo-400'
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
