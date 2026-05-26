import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'
import { Company } from '@/types'
import { getCompanyNav, NAV_MODULES } from '@/lib/nav-config'

type Props = {
  company: Company
  tagline: string
}

const ROLE_LABEL: Record<Company['role'], string> = {
  persoon:          'Eigenaar',
  holding:          'Holding BV',
  werkmaatschappij: 'Werkmaatschappij',
}

// Server component — entity-specifieke snelkoppelingen op basis van COMPANY_NAV
export default async function EntityLanding({ company, tagline }: Props) {
  const nav = getCompanyNav(company.id)
  const sections = nav.sections.filter((s) => s.title) // skip dashboard-only

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center text-lg font-bold text-white"
          style={{ backgroundColor: company.color }}
        >
          {company.short.charAt(0)}
        </div>
        <div className="flex-1">
          <p className="text-[10px] uppercase tracking-widest text-white/45 font-semibold">
            {ROLE_LABEL[company.role]}
          </p>
          <h1 className="text-2xl font-bold text-white leading-tight">{company.name}</h1>
          <p className="text-sm text-white/55 mt-1">{tagline}</p>
        </div>
      </div>

      {/* Quick-access tiles per nav-sectie */}
      <div>
        <h2 className="text-sm font-semibold text-white mb-3">Snel naar</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {sections.map((section) => {
            const moduleObjs = section.modules
              .map((key) => NAV_MODULES[key])
              .filter(Boolean)
            const primary = moduleObjs[0]
            if (!primary) return null
            const Icon = primary.icon
            return (
              <Link
                key={section.title}
                href={primary.href}
                target={primary.external ? '_blank' : undefined}
                rel={primary.external ? 'noopener noreferrer' : undefined}
                className="bg-white/[0.04] border border-white/[0.06] hover:border-white/15 hover:bg-white/[0.06] rounded-xl p-4 transition-colors flex items-start gap-3"
              >
                <div
                  className="w-9 h-9 rounded-lg border flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: `${company.color}1a`, borderColor: `${company.color}33`, color: company.color }}
                >
                  <Icon size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-white truncate">{section.title}</p>
                    <ArrowUpRight size={12} className="text-white/35 flex-shrink-0" />
                  </div>
                  <p className="text-[11px] text-white/45 mt-0.5">
                    {moduleObjs.length} module{moduleObjs.length === 1 ? '' : 's'}
                  </p>
                  <p className="text-[11px] text-white/55 mt-2 line-clamp-1">
                    {moduleObjs.slice(0, 3).map((m) => m.label).join(' · ')}
                    {moduleObjs.length > 3 ? ' …' : ''}
                  </p>
                </div>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
