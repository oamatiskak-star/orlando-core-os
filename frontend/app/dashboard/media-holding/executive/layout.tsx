'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import clsx from 'clsx'
import {
  LayoutDashboard, Briefcase, Building2, Activity,
  Zap, Eye, Wallet,
} from 'lucide-react'

const SUBTABS = [
  { label: 'Overview',          href: '/dashboard/media-holding/executive',                icon: LayoutDashboard },
  { label: 'AI Boardroom',      href: '/dashboard/media-holding/executive/boardroom',      icon: Briefcase },
  { label: 'Channels',          href: '/dashboard/media-holding/executive/channels',       icon: Building2 },
  { label: 'Retention Lab',     href: '/dashboard/media-holding/executive/retention-lab',  icon: Activity },
  { label: 'Algorithm',         href: '/dashboard/media-holding/executive/algorithm',      icon: Zap },
  { label: 'Compete',           href: '/dashboard/media-holding/executive/compete',        icon: Eye },
  { label: 'Content Fund',      href: '/dashboard/media-holding/executive/fund',           icon: Wallet },
]

export default function ExecutiveLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div className="space-y-4">
      <nav className="flex gap-1 border border-white/5 bg-white/[0.02] rounded-xl p-1 overflow-x-auto">
        {SUBTABS.map(t => {
          const Icon = t.icon
          const active = pathname === t.href || (t.href !== '/dashboard/media-holding/executive' && pathname.startsWith(t.href))
          return (
            <Link
              key={t.href}
              href={t.href}
              className={clsx(
                'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-colors',
                active
                  ? 'bg-violet-500/15 text-violet-300 border border-violet-400/30'
                  : 'border border-transparent text-white/40 hover:text-white/70 hover:bg-white/[0.04]'
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
