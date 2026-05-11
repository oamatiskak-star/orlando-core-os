'use client'

import { useState } from 'react'
import { ChevronDown, Building2, Check } from 'lucide-react'
import { COMPANIES } from '@/lib/companies'
import { Company } from '@/types'
import clsx from 'clsx'

interface Props {
  active: Company
  onChange: (company: Company) => void
}

export default function CompanySwitcher({ active, onChange }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 w-full px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors text-left"
      >
        <span
          className="w-2 h-2 rounded-full flex-shrink-0"
          style={{ backgroundColor: active.color }}
        />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-white truncate">{active.short}</p>
          <p className="text-[10px] text-white/40 truncate leading-tight">{active.role}</p>
        </div>
        <ChevronDown
          size={14}
          className={clsx('text-white/40 flex-shrink-0 transition-transform', open && 'rotate-180')}
        />
      </button>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-[#1a1a2e] border border-white/10 rounded-lg overflow-hidden z-50 shadow-xl">
          {COMPANIES.map((company) => (
            <button
              key={company.id}
              onClick={() => {
                onChange(company)
                setOpen(false)
              }}
              className={clsx(
                'flex items-center gap-2 w-full px-3 py-2 text-left hover:bg-white/5 transition-colors',
                company.role === 'reserve' && 'opacity-40'
              )}
            >
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: company.color }}
              />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-white truncate">{company.short}</p>
                <p className="text-[10px] text-white/30 truncate">{company.name}</p>
              </div>
              {active.id === company.id && (
                <Check size={12} className="text-white/60 flex-shrink-0" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
