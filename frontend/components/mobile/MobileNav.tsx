'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Play, GitBranch, Bell, Settings, Mail, Terminal } from 'lucide-react'
import clsx from 'clsx'

const TABS = [
  { href: '/mobile',               exact: true,  label: 'Home',       icon: Home },
  { href: '/mobile/youtube',       exact: false, label: 'YouTube',    icon: Play },
  { href: '/mobile/workflows',     exact: false, label: 'Flows',      icon: GitBranch },
  { href: '/mobile/mail',          exact: false, label: 'Mail',       icon: Mail },
  { href: '/mobile/notifications', exact: false, label: 'Meldingen',  icon: Bell },
  { href: '/car',                  exact: false, label: 'Terminal',    icon: Terminal },
  { href: '/mobile/settings',      exact: false, label: 'Instellingen', icon: Settings },
]

export default function MobileNav() {
  const path = usePathname()

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 bg-[#0d0d1a]/95 backdrop-blur-xl border-t border-white/[0.08]"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex items-center justify-around h-[3.75rem] max-w-lg mx-auto px-1">
        {TABS.map(tab => {
          const active = tab.exact
            ? path === tab.href
            : path === tab.href || path.startsWith(tab.href + '/')
          const Icon = tab.icon

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={clsx(
                'flex flex-col items-center justify-center gap-0.5 flex-1 h-full px-1 transition-colors',
                active ? 'text-indigo-400' : 'text-white/35 hover:text-white/60'
              )}
            >
              <Icon
                size={20}
                className={clsx(active && 'drop-shadow-[0_0_8px_rgba(99,102,241,0.7)]')}
                strokeWidth={active ? 2.5 : 1.75}
              />
              <span className="text-[10px] font-medium leading-none">{tab.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
