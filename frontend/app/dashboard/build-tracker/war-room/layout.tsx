'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import clsx from 'clsx'
import { Network, CalendarClock, GitBranch, Flag, Banknote, AlertTriangle, Layers, LayoutDashboard } from 'lucide-react'

const BASE = '/dashboard/build-tracker/war-room'
const TABS = [
  { label: 'Roadmap', href: BASE, icon: LayoutDashboard },
  { label: 'Timeline', href: `${BASE}/timeline`, icon: CalendarClock },
  { label: 'Dependencies', href: `${BASE}/dependencies`, icon: GitBranch },
  { label: 'Milestones', href: `${BASE}/milestones`, icon: Flag },
  { label: 'Revenue', href: `${BASE}/revenue`, icon: Banknote },
  { label: 'Blockers & Risk', href: `${BASE}/blockers`, icon: AlertTriangle },
  { label: 'Knowledge Graph', href: `${BASE}/graph`, icon: Network },
  { label: 'Consolidation', href: `${BASE}/consolidation`, icon: Layers },
]

export default function BuildWarRoomLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-lg font-semibold text-white">
          <Network size={18} className="text-violet-400" />
          Build Tracker War Room
        </h1>
        <p className="text-xs text-white/45">
          Eén visuele kennisgraaf over het hele ecosysteem — entiteit → programma → project → milestone →
          build item → PR → resultaat. Afgeleide koppelingen zijn transparant gemarkeerd.
        </p>
      </div>
      <nav className="flex gap-1 border-b border-white/5 pb-0 overflow-x-auto">
        {TABS.map((t) => {
          const Icon = t.icon
          const active = pathname === t.href || (t.href !== BASE && pathname.startsWith(t.href))
          return (
            <Link key={t.href} href={t.href}
              className={clsx(
                'flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 -mb-px whitespace-nowrap transition-colors',
                active ? 'border-violet-400 text-violet-400' : 'border-transparent text-white/50 hover:text-white/60'
              )}>
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
