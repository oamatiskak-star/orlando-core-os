'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import clsx from 'clsx'

const FINANCE_NAV = [
  { label: 'Dashboard', href: '/dashboard/finance' },
  { label: 'Facturen', href: '/dashboard/finance/facturen' },
  { label: 'Debiteuren', href: '/dashboard/finance/debiteuren' },
  { label: 'Workflows', href: '/dashboard/finance/workflows' },
  { label: 'Incasso', href: '/dashboard/finance/incasso' },
  { label: 'Juridisch', href: '/dashboard/finance/juridisch' },
  { label: 'Rapportages', href: '/dashboard/finance/rapportages' },
  { label: 'Templates', href: '/dashboard/finance/templates' },
  { label: 'Instellingen', href: '/dashboard/finance/instellingen' },
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
          <span className="text-white/30 text-[10px] font-semibold uppercase tracking-wider">Finance OS</span>
        </div>
        {FINANCE_NAV.map((item) => {
          const active =
            item.href === '/dashboard/finance'
              ? pathname === '/dashboard/finance'
              : pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                active
                  ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/20'
                  : 'text-white/40 hover:text-white/70 hover:bg-white/5'
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
