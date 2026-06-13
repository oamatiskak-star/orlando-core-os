'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import clsx from 'clsx'
import {
  LayoutGrid, Layers, Video, Clapperboard, Server,
  BarChart3, Crosshair, Settings as SettingsIcon, Archive, Crown, Briefcase, Package, GitBranch, Radar,
} from 'lucide-react'

const TABS = [
  { label: 'Overzicht',       href: '/dashboard/media-holding',             icon: LayoutGrid },
  { label: 'Executive',       href: '/dashboard/media-holding/executive',   icon: Crown },
  { label: 'Portfolio',       href: '/dashboard/media-holding/portfolio',   icon: Briefcase },
  { label: 'Offer Engine',    href: '/dashboard/media-holding/offer-engine', icon: Package },
  { label: 'Producer Gap',    href: '/dashboard/media-holding/producer-gap', icon: GitBranch },
  { label: 'Affiliate',       href: '/dashboard/media-holding/affiliate-discovery', icon: Radar },
  { label: 'Build Tracker',   href: '/dashboard/media-holding/build',       icon: Layers },
  { label: 'Channels',        href: '/dashboard/media-holding/channels',  icon: Video },
  { label: 'Content Factory', href: '/dashboard/media-holding/factory',   icon: Clapperboard },
  { label: 'Analytics',       href: '/dashboard/media-holding/analytics', icon: BarChart3 },
  { label: 'Compete',         href: '/dashboard/media-holding/compete',   icon: Crosshair },
  { label: 'Workers',         href: '/dashboard/media-holding/workers',   icon: Server },
  { label: 'Archives',        href: '/dashboard/media-holding/archives',  icon: Archive },
  { label: 'Settings',        href: '/dashboard/media-holding/settings',  icon: SettingsIcon },
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
