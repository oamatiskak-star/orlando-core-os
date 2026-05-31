'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import clsx from 'clsx'

// 4 logische clusters i.p.v. een platte rij met main/CFO/main door elkaar.
const FINANCE_NAV = [
  { label: 'Dashboard',    href: '/dashboard/finance',               group: 'Overzicht' },
  { label: 'Facturen',     href: '/dashboard/finance/facturen',      group: 'Facturatie' },
  { label: 'Debiteuren',   href: '/dashboard/finance/debiteuren',    group: 'Facturatie' },
  { label: 'Incasso',      href: '/dashboard/finance/incasso',       group: 'Facturatie' },
  { label: 'Juridisch',    href: '/dashboard/finance/juridisch',     group: 'Facturatie' },
  { label: 'CFO Cockpit',  href: '/dashboard/finance/cfo',           group: 'CFO' },
  { label: 'Cashflow',     href: '/dashboard/finance/cfo/cashflow',  group: 'CFO' },
  { label: 'Belasting',    href: '/dashboard/finance/cfo/belasting', group: 'CFO' },
  { label: 'AI Inzichten', href: '/dashboard/finance/cfo/inzichten', group: 'CFO' },
  { label: 'CFO Rapport',  href: '/dashboard/finance/cfo/rapport',   group: 'CFO' },
  { label: 'Moneybird',    href: '/dashboard/finance/moneybird',     group: 'Beheer' },
  { label: 'Workflows',    href: '/dashboard/finance/workflows',     group: 'Beheer' },
  { label: 'Rapportages',  href: '/dashboard/finance/rapportages',   group: 'Beheer' },
  { label: 'Templates',    href: '/dashboard/finance/templates',     group: 'Beheer' },
  { label: 'Instellingen', href: '/dashboard/finance/instellingen',  group: 'Beheer' },
]

const GROUPS = ['Overzicht', 'Facturatie', 'CFO', 'Beheer']

export default function FinanceLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Secondary nav — gegroepeerd per cluster */}
      <div className="flex items-center gap-3 px-1 pb-4 border-b border-white/5 flex-shrink-0 flex-wrap">
        <Link href="/dashboard" className="flex items-center text-white/40 hover:text-white/70" title="Terug naar dashboard">
          <ChevronLeft size={16} />
        </Link>
        <div className="flex items-center gap-1.5">
          <div className="w-5 h-5 rounded bg-emerald-500/20 flex items-center justify-center">
            <span className="text-emerald-400 text-[10px] font-bold">F</span>
          </div>
          <span className="text-white/50 text-[10px] font-semibold uppercase tracking-wider">Finance OS</span>
        </div>
        {GROUPS.map((g) => (
          <div key={g} className="flex items-center gap-1">
            <span className="text-white/25 text-[9px] font-semibold uppercase tracking-wider mr-0.5">{g}</span>
            {FINANCE_NAV.filter((i) => i.group === g).map((item) => {
              const active =
                item.href === '/dashboard/finance'
                  ? pathname === '/dashboard/finance'
                  : pathname.startsWith(item.href)
              const isCfo = item.group === 'CFO'
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
                      : 'text-white/65 hover:text-white/70 hover:bg-white/5',
                  )}
                >
                  {item.label}
                </Link>
              )
            })}
          </div>
        ))}
      </div>

      {/* Page content */}
      <div className="flex-1 min-h-0 overflow-y-auto pt-5">
        {children}
      </div>
    </div>
  )
}
