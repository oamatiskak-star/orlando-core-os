'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import clsx from 'clsx'
import { LayoutGrid, Megaphone, Clapperboard, Lightbulb, BarChart3, Mail, Filter, Tv2, CalendarClock, HeartPulse, Brain, Trophy, GitBranch, Coins, GraduationCap } from 'lucide-react'

const BASE = '/dashboard/media-holding/war-room/workspace'

const SUBTABS = [
  { label: 'Creative Library', href: BASE,                       icon: LayoutGrid },
  { label: 'Channel Strategy', href: `${BASE}/channels`,         icon: Tv2 },
  { label: 'Campaign Studio',  href: `${BASE}/campaigns`,        icon: Megaphone },
  { label: 'Video Studio',     href: `${BASE}/video`,            icon: Clapperboard },
  { label: 'Hook Library',     href: `${BASE}/hooks`,            icon: Lightbulb },
  { label: 'Hook Intelligence', href: `${BASE}/hook-intelligence`, icon: Brain },
  { label: 'Winners',          href: `${BASE}/winners`,          icon: Trophy },
  { label: 'Producer Graph',   href: `${BASE}/producer`,         icon: GitBranch },
  { label: 'Attribution',      href: `${BASE}/attribution`,      icon: Coins },
  { label: 'Learning Loop',    href: `${BASE}/learning`,         icon: GraduationCap },
  { label: 'Voor overmorgen',  href: `${BASE}/horizon`,          icon: CalendarClock },
  { label: 'Performance',      href: `${BASE}/performance`,      icon: BarChart3 },
  { label: 'Email Studio',     href: `${BASE}/email`,            icon: Mail },
  { label: 'Funnels',          href: `${BASE}/funnels`,          icon: Filter },
  { label: 'Platform Health',  href: `${BASE}/maintenance`,      icon: HeartPulse },
]

export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {SUBTABS.map((t) => {
          const Icon = t.icon
          const active = pathname === t.href || (t.href !== BASE && pathname.startsWith(t.href))
          return (
            <Link key={t.href} href={t.href}
              className={clsx(
                'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                active ? 'bg-violet-500/20 text-violet-200' : 'bg-white/[0.03] text-white/55 hover:text-white/80'
              )}>
              <Icon size={13} />
              {t.label}
            </Link>
          )
        })}
      </div>
      {children}
    </div>
  )
}
