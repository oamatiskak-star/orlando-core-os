'use client'

import { useEffect, useState } from 'react'
import { Search, Menu, Sun, Moon } from 'lucide-react'
import NotificationBell from './NotificationBell'

interface Props {
  title: string
  onMenuOpen: () => void
}

export default function Topbar({ title, onMenuOpen }: Props) {
  const [day, setDay] = useState(false)

  useEffect(() => {
    setDay(document.documentElement.getAttribute('data-theme') === 'day')
  }, [])

  function toggleTheme() {
    const next = !day
    setDay(next)
    document.documentElement.setAttribute('data-theme', next ? 'day' : 'night')
    try { localStorage.setItem('oc-theme', next ? 'day' : 'night') } catch {}
  }

  return (
    <header className="h-12 flex items-center justify-between px-4 border-b border-white/5 bg-[#181830] flex-shrink-0">
      <div className="flex items-center gap-3">
        {/* Hamburger — mobile only */}
        <button
          onClick={onMenuOpen}
          className="md:hidden p-1.5 rounded-lg hover:bg-white/5 text-white/65 hover:text-white/70 transition-colors"
          aria-label="Menu openen"
        >
          <Menu size={18} />
        </button>
        <h1 className="text-sm font-semibold text-white">{title}</h1>
      </div>
      <div className="flex items-center gap-3">
        {/* Search — hidden on mobile */}
        <div className="hidden sm:flex items-center gap-2 bg-white/5 rounded-lg px-3 py-1.5">
          <Search size={13} className="text-white/50" />
          <input
            type="text"
            placeholder="Zoeken..."
            className="bg-transparent text-xs text-white/60 placeholder-white/25 outline-none w-36"
          />
        </div>
        <button
          onClick={toggleTheme}
          className="p-1.5 rounded-lg hover:bg-white/5 text-white/65 hover:text-white transition-colors"
          aria-label={day ? 'Naar nachtmodus' : 'Naar daglichtmodus'}
          title={day ? 'Daglichtmodus aan — klik voor nacht' : 'Daglichtmodus (beter leesbaar in de zon)'}
        >
          {day ? <Sun size={16} className="text-amber-400" /> : <Moon size={16} />}
        </button>
        <NotificationBell />
        <div className="w-7 h-7 rounded-full bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 text-xs font-bold">
          O
        </div>
      </div>
    </header>
  )
}
