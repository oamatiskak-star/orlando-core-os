'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import clsx from 'clsx'

const FINANCE_NAV = [
  { label: 'Dashboard',  href: '/dashboard/finance',              group: 'main' },
  { label: 'Facturen',   href: '/dashboard/finance/facturen',     group: 'main' },
  { label: 'Debiteuren', href: '/dashboard/finance/debiteuren',   group: 'main' },
  { label: 'Workflows',  href: '/dashboard/finance/workflows',    group: 'main' },
  { label: 'Incasso',    href: '/dashboard/finance/incasso',      group: 'main' },
  { label: 'Juridisch',  href: '/dashboard/finance/juridisch',    group: 'main' },
  { label: '─',          href: '',                                group: 'sep' },
  { label: 'CFO Cockpit',href: '/dashboard/finance/cfo',          group: 'cfo' },
  { label: 'Cashflow',   href: '/dashboard/finance/cfo/cashflow', group: 'cfo' },
  { label: 'Belasting',  href: '/dashboard/finance/cfo/belasting',group: 'cfo' },
  { label: 'AI Inzichten',href: '/dashboard/finance/cfo/inzichten',group: 'cfo' },
  { label: 'CFO Rapport',href: '/dashboard/finance/cfo/rapport',  group: 'cfo' },
  { label: '─',          href: '',                                group: 'sep' },
  { label: 'Rapportages',href: '/dashboard/finance/rapportages',  group: 'main' },
  { label: 'Templates',  href: '/dashboard/finance/templates',    group: 'main' },
  { label: 'Instellingen',href: '/dashboard/finance/instellingen',group: 'main' },
]

export default function FinanceLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Secondary nav */}
      <div className="flex items-center gap-1 px-1 pb-4 border-b border-white/5 flex-shrink-0 flex-wrap">
        <div className="flex items-center gap-1.5 mr-3">
          <div className="w-5 h-5 rounded bg-emerald-500/20 flex items-center justify-center">
            <span className="text-emerald-400 text-[10px] font-bold">F</span>
          </div>
          <span className="text-white/50 text-[10px] font-semibold uppercase tracking-wider">Finance OS</span>
        </div>
        {FINANCE_NAV.map((item, i) => {
          if (item.group === 'sep') {
            return <span key={`sep-${i}`} className="text-white/10 text-xs px-1">|</span>
          }
          const active =
            item.href === '/dashboard/finance'
              ? pathname === '/dashboard/finance'
              : item.href
                ? pathname.startsWith(item.href)
                : false
          const isCfo = item.group === 'cfo'
          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                active
                  ? isCfo
                    ? 'bg-purple-600/20 text-purple-400 border border-purple-500/20'
                    : 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/20'
                  : 'text-white/65 hover:text-white/70 hover:bg-white/5'
              )}
            >
              {item.label}
            </Link>
          )
        })}
      </div>

      {/* Page content */}
      <div className="flex-1 min-h-0 overflow-y-auto pt-5">
        {children}
      </div>
    </div>
  )
}
