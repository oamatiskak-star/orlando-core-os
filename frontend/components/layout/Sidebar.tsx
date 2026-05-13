'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ChevronLeft, ChevronRight, LogOut, X } from 'lucide-react'
import CompanySwitcher from './CompanySwitcher'
import { useCompany } from '@/lib/company-context'
import { getCompanyNav, NAV_MODULES, NavModuleDef } from '@/lib/nav-config'
import clsx from 'clsx'

export default function Sidebar({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const pathname = usePathname()
  const router = useRouter()
  const [collapsed, setCollapsed] = useState(false)
  const { activeCompany, setActiveCompany } = useCompany()

  const nav = getCompanyNav(activeCompany.id)

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.replace('/login')
  }

  function renderModule(mod: NavModuleDef) {
    const Icon = mod.icon
    const active =
      pathname === mod.href ||
      (mod.href !== '/dashboard' && pathname.startsWith(mod.href))

    return (
      <Link
        key={mod.key}
        href={mod.href}
        onClick={onClose}
        title={collapsed ? mod.label : undefined}
        className={clsx(
          'flex items-center gap-2.5 px-2 py-1.5 rounded-md text-xs transition-colors relative',
          active
            ? 'bg-indigo-500/15 text-indigo-400'
            : 'text-white/65 hover:text-white/70 hover:bg-white/5'
        )}
      >
        <Icon size={15} className="flex-shrink-0" />
        {!collapsed && <span className="flex-1 truncate">{mod.label}</span>}
        {collapsed && active && (
          <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 bg-indigo-500 rounded-full" />
        )}
      </Link>
    )
  }

  function renderSection(modules: string[], title?: string, idx?: number) {
    const defs = modules.map((k) => NAV_MODULES[k]).filter(Boolean) as NavModuleDef[]
    if (!defs.length) return null

    return (
      <div key={idx} className={idx && idx > 0 ? 'mt-0.5' : ''}>
        {title && !collapsed && (
          <p className="px-2 pt-3 pb-1 text-[9px] uppercase tracking-widest text-white/38 font-semibold select-none">
            {title}
          </p>
        )}
        {title && collapsed && <div className="mt-2 mx-2 h-px bg-white/5" />}
        {defs.map(renderModule)}
      </div>
    )
  }

  return (
    <aside
      className={clsx(
        'flex flex-col h-screen bg-[#181830] border-r border-white/5 flex-shrink-0',
        'fixed inset-y-0 left-0 z-50 transition-transform duration-200',
        isOpen ? 'translate-x-0' : '-translate-x-full',
        'md:static md:translate-x-0 md:z-auto',
        collapsed ? 'w-[60px]' : 'w-[220px]'
      )}
    >
      {/* Logo + collapse */}
      <div className="flex items-center justify-between px-3 py-4 border-b border-white/5">
        {!collapsed ? (
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-indigo-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
              O
            </div>
            <span className="text-white text-sm font-semibold tracking-tight">Orlando OS</span>
          </div>
        ) : (
          <div className="w-7 h-7 rounded-lg bg-indigo-500 flex items-center justify-center text-white text-xs font-bold mx-auto">
            O
          </div>
        )}
        <div className="flex items-center gap-1">
          <button
            onClick={onClose}
            className="md:hidden text-white/50 hover:text-white/60 transition-colors p-1"
          >
            <X size={16} />
          </button>
          {!collapsed && (
            <button
              onClick={() => setCollapsed(true)}
              className="hidden md:block text-white/50 hover:text-white/60 transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Company switcher */}
      {!collapsed ? (
        <div className="px-3 py-3 border-b border-white/5">
          <CompanySwitcher active={activeCompany} onChange={setActiveCompany} />
        </div>
      ) : (
        <div className="px-2 py-3 border-b border-white/5 flex justify-center">
          <span
            className="w-2.5 h-2.5 rounded-full"
            style={{ backgroundColor: activeCompany.color }}
            title={activeCompany.name}
          />
        </div>
      )}

      {/* Navigation — dynamic per company */}
      <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-0 scrollbar-none">
        {nav.sections.map((section, i) =>
          renderSection(section.modules, section.title, i)
        )}
      </nav>

      {/* Bottom: global items + collapse + logout */}
      <div className="px-2 py-3 border-t border-white/5 space-y-0.5">
        {nav.globalBottom.map((k) => {
          const mod = NAV_MODULES[k]
          return mod ? renderModule(mod) : null
        })}

        {collapsed && (
          <button
            onClick={() => setCollapsed(false)}
            className="hidden md:flex items-center justify-center w-full py-1.5 text-white/50 hover:text-white/60 transition-colors mt-1"
          >
            <ChevronRight size={16} />
          </button>
        )}

        <button
          onClick={handleLogout}
          title={collapsed ? 'Uitloggen' : undefined}
          className={clsx(
            'flex items-center gap-2.5 px-2 py-1.5 rounded-md text-xs text-white/50 hover:text-white/60 hover:bg-white/5 transition-colors w-full mt-1',
            collapsed && 'justify-center'
          )}
        >
          <LogOut size={15} />
          {!collapsed && <span>Uitloggen</span>}
        </button>
      </div>
    </aside>
  )
}
