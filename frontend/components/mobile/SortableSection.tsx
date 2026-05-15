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
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {editing && (
            <div className="flex gap-0.5">
              <button
                onClick={onMoveUp}
                disabled={isFirst}
                className="w-6 h-6 flex items-center justify-center rounded-md bg-white/[0.06] text-white/40 hover:text-white/70 disabled:opacity-20 transition-colors"
              >
                <ArrowUp size={11} />
              </button>
              <button
                onClick={onMoveDown}
                disabled={isLast}
                className="w-6 h-6 flex items-center justify-center rounded-md bg-white/[0.06] text-white/40 hover:text-white/70 disabled:opacity-20 transition-colors"
              >
                <ArrowDown size={11} />
              </button>
            </div>
          )}
          <h2 className="text-[11px] text-white/38 font-semibold uppercase tracking-wider select-none">
            {label}
          </h2>
        </div>
        <button
          onClick={onToggleCollapse}
          className="w-7 h-7 flex items-center justify-center rounded-lg text-white/25 hover:text-white/55 hover:bg-white/[0.05] transition-colors"
          aria-label={collapsed ? 'Uitklappen' : 'Inklappen'}
        >
          <ChevronDown
            size={14}
            className={`transition-transform duration-200 ${collapsed ? '-rotate-90' : ''}`}
          />
        </button>
      </div>

      <div
        className={`overflow-hidden transition-all duration-200 ${
          collapsed ? 'max-h-0 opacity-0' : 'max-h-[9999px] opacity-100'
        }`}
      >
        {children}
      </div>
    </section>
  )
}
