'use client'

import { useState } from 'react'
import { ChevronDown, Check } from 'lucide-react'
import { COMPANIES } from '@/lib/companies'
import { Company } from '@/types'
import clsx from 'clsx'

const ROLE_LABEL: Record<Company['role'], string> = {
  persoon:          'Eigenaar',
  holding:          'Holding BV',
  werkmaatschappij: 'Werkmaatschappij',
}

const ROLE_ORDER: Company['role'][] = ['persoon', 'holding', 'werkmaatschappij']

interface Props {
  active: Company
  onChange: (company: Company) => void
}

export default function CompanySwitcher({ active, onChange }: Props) {
  const [open, setOpen] = useState(false)

  const grouped = ROLE_ORDER.reduce<Record<string, Company[]>>((acc, role) => {
    const items = COMPANIES.filter((c) => c.role === role)
    if (items.length) acc[role] = items
    return acc
  }, {})

  return (
    <div className="relative">
      {/* Trigger */}
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
          <p className="text-[10px] text-white/65 truncate leading-tight">
            {ROLE_LABEL[active.role]}
          </p>
        </div>
        <ChevronDown
          size={14}
          className={clsx('text-white/65 flex-shrink-0 transition-transform', open && 'rotate-180')}
        />
      </button>

      {/* Dropdown */}
      {open && (
        <>
          {/* Backdrop — sluit dropdown bij klik buiten */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />

          <div className="absolute top-full left-0 right-0 mt-1 bg-[#222240] border border-white/10 rounded-lg z-50 shadow-2xl overflow-hidden max-h-[320px] overflow-y-auto">
            {ROLE_ORDER.map((role) => {
              const items = grouped[role]
              if (!items) return null
              return (
                <div key={role}>
                  <p className="px-3 pt-2.5 pb-1 text-[9px] uppercase tracking-widest text-white/45 font-semibold select-none">
                    {ROLE_LABEL[role]}
                  </p>
                  {items.map((company) => (
                    <button
                      key={company.id}
                      onClick={() => { onChange(company); setOpen(false) }}
                      className="flex items-center gap-2 w-full px-3 py-2 text-left hover:bg-white/5 transition-colors"
                    >
                      <span
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: company.color }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-white truncate font-medium">{company.short}</p>
                        <p className="text-[10px] text-white/50 truncate leading-tight">{company.name}</p>
                      </div>
                      {active.id === company.id && (
                        <Check size={12} className="text-indigo-400 flex-shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
