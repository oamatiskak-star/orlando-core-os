'use client'

import { ChevronDown, ArrowUp, ArrowDown } from 'lucide-react'

interface Props {
  label: string
  collapsed: boolean
  editing: boolean
  isFirst: boolean
  isLast: boolean
  onToggleCollapse: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  children: React.ReactNode
}

export default function SortableSection({
  label, collapsed, editing, isFirst, isLast,
  onToggleCollapse, onMoveUp, onMoveDown, children,
}: Props) {
  return (
    <section>
      {editing ? (
        /* ── Edit mode: full-width bar with large tap zones ── */
        <div className="flex items-stretch h-12 bg-indigo-600/20 border border-indigo-500/30 rounded-xl mb-3 overflow-hidden">
          <button
            onTouchEnd={e => { e.preventDefault(); if (!isFirst) onMoveUp() }}
            onClick={() => { if (!isFirst) onMoveUp() }}
            disabled={isFirst}
            aria-label="Omhoog"
            className="flex items-center justify-center w-14 flex-shrink-0 text-indigo-300 disabled:text-white/15 disabled:bg-transparent active:bg-indigo-500/30 transition-colors"
          >
            <ArrowUp size={18} />
          </button>
          <div className="flex-1 flex items-center justify-center px-2">
            <span className="text-[11px] text-indigo-200 font-semibold uppercase tracking-wider text-center leading-tight select-none">
              {label}
            </span>
          </div>
          <button
            onTouchEnd={e => { e.preventDefault(); if (!isLast) onMoveDown() }}
            onClick={() => { if (!isLast) onMoveDown() }}
            disabled={isLast}
            aria-label="Omlaag"
            className="flex items-center justify-center w-14 flex-shrink-0 text-indigo-300 disabled:text-white/15 disabled:bg-transparent active:bg-indigo-500/30 transition-colors"
          >
            <ArrowDown size={18} />
          </button>
        </div>
      ) : (
        /* ── Normal mode: label + collapse chevron ── */
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[11px] text-white/38 font-semibold uppercase tracking-wider select-none pl-1">
            {label}
          </h2>
          <button
            onTouchEnd={e => { e.preventDefault(); onToggleCollapse() }}
            onClick={onToggleCollapse}
            aria-label={collapsed ? 'Uitklappen' : 'Inklappen'}
            className="flex items-center justify-center w-11 h-11 rounded-xl text-white/30 active:text-white/60 active:bg-white/[0.06] transition-colors"
          >
            <ChevronDown
              size={16}
              className={`transition-transform duration-200 ${collapsed ? '-rotate-90' : ''}`}
            />
          </button>
        </div>
      )}

      <div className={`overflow-hidden transition-[max-height,opacity] duration-200 ${
        collapsed ? 'max-h-0 opacity-0' : 'max-h-[9999px] opacity-100'
      }`}>
        {children}
      </div>
    </section>
  )
}
