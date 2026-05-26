import Link from 'next/link'
import { Workflow, Activity, PlusCircle, BarChart3, Bot, ShieldAlert, GitMerge, Terminal, SlidersHorizontal, Brain } from 'lucide-react'
import { getActiveCompany } from '@/lib/active-company-server'
import type { ReactNode } from 'react'

type SubNavEntry = {
  href: string
  label: string
  icon: typeof Workflow
  status: 'live' | 'planned'
  phase?: number
}

const SUB_NAV: SubNavEntry[] = [
  { href: '/dashboard/build-tracker/routines',              label: 'Overview',        icon: Workflow,           status: 'live' },
  { href: '/dashboard/build-tracker/routines/live',         label: 'Live Operations', icon: Activity,           status: 'live' },
  { href: '/dashboard/build-tracker/routines/agents',       label: 'Agents',          icon: Bot,                status: 'live' },
  { href: '/dashboard/build-tracker/routines/logs',         label: 'Audit Log',       icon: Terminal,           status: 'live' },
  { href: '/dashboard/build-tracker/routines/builder',      label: 'Builder',         icon: PlusCircle,         status: 'live' },
  { href: '/dashboard/build-tracker/routines/recovery',     label: 'Recovery',        icon: ShieldAlert,        status: 'live' },
  { href: '/dashboard/build-tracker/routines/workflows',    label: 'Workflows',       icon: GitMerge,           status: 'live' },
  { href: '/dashboard/build-tracker/routines/settings',     label: 'Settings',        icon: SlidersHorizontal,  status: 'live' },
  { href: '/dashboard/build-tracker/routines/intelligence', label: 'Intelligence',    icon: Brain,              status: 'live' },
  { href: '/dashboard/build-tracker/routines/analytics',    label: 'Analytics',       icon: BarChart3,          status: 'live' },
]

export default async function RoutinesLayout({ children }: { children: ReactNode }) {
  const company = await getActiveCompany()

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ backgroundColor: `${company.color}1a`, border: `1px solid ${company.color}33`, color: company.color }}
        >
          <Workflow size={16} />
        </div>
        <div className="flex-1">
          <h1 className="text-base font-semibold text-white">Routines Control Center</h1>
          <p className="text-xs text-white/50">Meta-supervisor over alle agents, workers, queues en automations · {company.name}</p>
        </div>
      </div>

      <nav className="flex flex-wrap gap-1.5 border-b border-white/[0.06] pb-3">
        {SUB_NAV.map((entry) => {
          const Icon = entry.icon
          const isLive = entry.status === 'live'
          return (
            <Link
              key={entry.href}
              href={isLive ? entry.href : '#'}
              aria-disabled={!isLive}
              className={
                isLive
                  ? 'inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-white/80 border border-white/[0.06] transition-colors'
                  : 'inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] rounded-lg bg-white/[0.02] text-white/25 border border-dashed border-white/10 cursor-not-allowed'
              }
              title={isLive ? entry.label : `Komt in Fase ${entry.phase}`}
            >
              <Icon size={11} />
              <span>{entry.label}</span>
              {!isLive && (
                <span className="text-[9px] uppercase tracking-wide text-white/30 ml-0.5">F{entry.phase}</span>
              )}
            </Link>
          )
        })}
      </nav>

      {children}
    </div>
  )
}
