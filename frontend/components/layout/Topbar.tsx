'use client'

import { Bell, Search, Menu } from 'lucide-react'

interface Props {
  title: string
  onMenuOpen: () => void
}

export default function Topbar({ title, onMenuOpen }: Props) {
  return (
    <header className="h-12 flex items-center justify-between px-4 border-b border-white/5 bg-[#0f0f1a] flex-shrink-0">
      <div className="flex items-center gap-3">
        {/* Hamburger — mobile only */}
        <button
          onClick={onMenuOpen}
          className="md:hidden p-1.5 rounded-lg hover:bg-white/5 text-white/40 hover:text-white/70 transition-colors"
          aria-label="Menu openen"
        >
          <Menu size={18} />
        </button>
        <h1 className="text-sm font-semibold text-white">{title}</h1>
      </div>
      <div className="flex items-center gap-3">
        {/* Search — hidden on mobile */}
        <div className="hidden sm:flex items-center gap-2 bg-white/5 rounded-lg px-3 py-1.5">
          <Search size={13} className="text-white/30" />
          <input
            type="text"
            placeholder="Zoeken..."
            className="bg-transparent text-xs text-white/60 placeholder-white/25 outline-none w-36"
          />
        </div>
        <button className="relative p-1.5 rounded-lg hover:bg-white/5 text-white/40 hover:text-white/70 transition-colors">
          <Bell size={16} />
          <span className="absolute top-0.5 right-0.5 w-2 h-2 bg-indigo-500 rounded-full" />
        </button>
        <div className="w-7 h-7 rounded-full bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 text-xs font-bold">
          O
        </div>
      </div>
    </header>
  )
}
