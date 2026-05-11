'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  LayoutDashboard,
  Building2,
  FileText,
  Bot,
  Workflow,
  FolderKanban,
  Home,
  Calculator,
  Users,
  CreditCard,
  Calendar,
  CheckSquare,
  Files,
  Bell,
  Settings,
  Activity,
  ChevronLeft,
  ChevronRight,
  LogOut,
  TrendingUp,
  Banknote,
} from 'lucide-react'
import CompanySwitcher from './CompanySwitcher'
import { COMPANIES } from '@/lib/companies'
import { Company } from '@/types'
import clsx from 'clsx'

const NAV_ITEMS = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Bedrijven', href: '/dashboard/companies', icon: Building2 },
  { label: 'Administratie', href: '/dashboard/admin', icon: FileText },
  { label: 'AI Agents', href: '/dashboard/agents', icon: Bot, badge: 3 },
  { label: 'Workflow Engine', href: '/dashboard/workflows', icon: Workflow },
  { label: 'Projecten', href: '/dashboard/projects', icon: FolderKanban },
  { label: 'Vastgoed Deals', href: '/dashboard/vastgoed', icon: Home },
  { label: 'Calculaties', href: '/dashboard/calculaties', icon: Calculator },
  { label: 'Finance OS', href: '/dashboard/finance', icon: Banknote },
  { label: 'CRM', href: '/dashboard/crm', icon: Users },
  { label: 'Agenda', href: '/dashboard/agenda', icon: Calendar },
  { label: 'Taken', href: '/dashboard/taken', icon: CheckSquare, badge: 7 },
  { label: 'Documenten', href: '/dashboard/documenten', icon: Files },
  { label: 'Abonnementen', href: '/dashboard/abonnementen', icon: CreditCard },
  { label: 'Financiën', href: '/dashboard/financien', icon: TrendingUp },
  { label: 'Gebruikers', href: '/dashboard/gebruikers', icon: Users },
  { label: 'Meldingen', href: '/dashboard/meldingen', icon: Bell, badge: 2 },
  { label: 'System Health', href: '/dashboard/health', icon: Activity },
  { label: 'Instellingen', href: '/dashboard/instellingen', icon: Settings },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [collapsed, setCollapsed] = useState(false)
  const [activeCompany, setActiveCompany] = useState<Company>(COMPANIES[0])

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.replace('/login')
  }

  return (
    <aside
      className={clsx(
        'flex flex-col h-screen bg-[#0f0f1a] border-r border-white/5 transition-all duration-200 flex-shrink-0',
        collapsed ? 'w-[60px]' : 'w-[220px]'
      )}
    >
      {/* Logo + collapse */}
      <div className="flex items-center justify-between px-3 py-4 border-b border-white/5">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-indigo-500 flex items-center justify-center text-white text-xs font-bold">
              O
            </div>
            <span className="text-white text-sm font-semibold tracking-tight">Orlando OS</span>
          </div>
        )}
        {collapsed && (
          <div className="w-7 h-7 rounded-lg bg-indigo-500 flex items-center justify-center text-white text-xs font-bold mx-auto">
            O
          </div>
        )}
        {!collapsed && (
          <button
            onClick={() => setCollapsed(true)}
            className="text-white/30 hover:text-white/60 transition-colors"
          >
            <ChevronLeft size={16} />
          </button>
        )}
      </div>

      {/* Company switcher */}
      {!collapsed && (
        <div className="px-3 py-3 border-b border-white/5">
          <CompanySwitcher active={activeCompany} onChange={setActiveCompany} />
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon
          const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))

          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={clsx(
                'flex items-center gap-2.5 px-2 py-1.5 rounded-md text-xs transition-colors group relative',
                active
                  ? 'bg-indigo-500/15 text-indigo-400'
                  : 'text-white/40 hover:text-white/70 hover:bg-white/5'
              )}
            >
              <Icon size={15} className="flex-shrink-0" />
              {!collapsed && (
                <>
                  <span className="flex-1 truncate">{item.label}</span>
                  {item.badge && (
                    <span className="ml-auto bg-indigo-500 text-white text-[10px] font-medium px-1.5 py-0.5 rounded-full leading-none">
                      {item.badge}
                    </span>
                  )}
                </>
              )}
              {collapsed && item.badge && (
                <span className="absolute top-0.5 right-0.5 w-2 h-2 bg-indigo-500 rounded-full" />
              )}
            </Link>
          )
        })}
      </nav>

      {/* Bottom: expand + logout */}
      <div className="px-2 py-3 border-t border-white/5 space-y-1">
        {collapsed && (
          <button
            onClick={() => setCollapsed(false)}
            className="flex items-center justify-center w-full py-1.5 text-white/30 hover:text-white/60 transition-colors"
          >
            <ChevronRight size={16} />
          </button>
        )}
        {!collapsed && (
          <button
            onClick={handleLogout}
            className="flex items-center gap-2.5 px-2 py-1.5 rounded-md text-xs text-white/30 hover:text-white/60 hover:bg-white/5 transition-colors w-full"
          >
            <LogOut size={15} />
            <span>Uitloggen</span>
          </button>
        )}
        {collapsed && (
          <button
            onClick={handleLogout}
            title="Uitloggen"
            className="flex items-center justify-center w-full py-1.5 text-white/30 hover:text-white/60 transition-colors"
          >
            <LogOut size={15} />
          </button>
        )}
      </div>
    </aside>
  )
}
