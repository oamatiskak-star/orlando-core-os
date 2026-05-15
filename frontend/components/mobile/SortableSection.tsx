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
        <div className="flex items-center gap-1">
          {editing && (
            <div className="flex gap-1 mr-1">
              <button
                onClick={onMoveUp}
                disabled={isFirst}
                aria-label="Omhoog"
                className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl bg-white/[0.08] text-white/50 hover:text-white/80 hover:bg-white/[0.12] disabled:opacity-20 disabled:pointer-events-none active:scale-95 transition-all"
              >
                <ArrowUp size={14} />
              </button>
              <button
                onClick={onMoveDown}
                disabled={isLast}
                aria-label="Omlaag"
                className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl bg-white/[0.08] text-white/50 hover:text-white/80 hover:bg-white/[0.12] disabled:opacity-20 disabled:pointer-events-none active:scale-95 transition-all"
              >
                <ArrowDown size={14} />
              </button>
            </div>
          )}
          <h2 className="text-[11px] text-white/38 font-semibold uppercase tracking-wider select-none">
            {label}
          </h2>
        </div>
        <button
          onClick={onToggleCollapse}
          aria-label={collapsed ? 'Uitklappen' : 'Inklappen'}
          className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-white/30 hover:text-white/60 hover:bg-white/[0.05] active:scale-95 transition-all"
        >
          <ChevronDown
            size={16}
            className={`transition-transform duration-200 ${collapsed ? '-rotate-90' : ''}`}
          />
        </button>
      </div>

      <div
        className={`overflow-hidden transition-[max-height,opacity] duration-200 ease-in-out ${
          collapsed ? 'max-h-0 opacity-0' : 'max-h-[9999px] opacity-100'
        }`}
      >
        {children}
      </div>
    </section>
  )
}
