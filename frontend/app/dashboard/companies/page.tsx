import { Building2, Bot, CheckSquare, Settings } from 'lucide-react'
import { COMPANIES } from '@/lib/companies'

const agentCounts: Record<string, number> = {
  modiwerijo: 3,
  'modiwe-media': 1,
  strkbeheer: 1,
  strkbouw: 2,
  bouwproffs: 0,
}

const taskCounts: Record<string, number> = {
  modiwerijo: 8,
  'modiwe-media': 3,
  strkbeheer: 2,
  strkbouw: 1,
  bouwproffs: 0,
}

const roleBadge: Record<string, { label: string; className: string }> = {
  persoon:          { label: 'Eigenaar',         className: 'bg-violet-500/10 text-violet-400' },
  holding:          { label: 'Holding',           className: 'bg-indigo-500/10 text-indigo-400' },
  werkmaatschappij: { label: 'Werkmaatschappij',  className: 'bg-sky-500/10 text-sky-400' },
}

export default function CompaniesPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
          <Building2 size={16} className="text-indigo-400" />
        </div>
        <div>
          <h1 className="text-base font-semibold text-white">Bedrijven</h1>
          <p className="text-xs text-white/30">Beheer alle BV&apos;s, holdings en werkmaatschappijen binnen het ecosysteem.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {COMPANIES.map((company) => {
          const badge = roleBadge[company.role]
          return (
            <div key={company.id} className="bg-white/[0.03] border border-white/5 rounded-xl p-5 flex flex-col gap-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: company.color }} />
                  <div>
                    <p className="text-sm font-semibold text-white">{company.short}</p>
                    <p className="text-[11px] text-white/30 leading-tight mt-0.5">{company.name}</p>
                  </div>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${badge?.className ?? 'bg-white/5 text-white/30'}`}>
                  {badge?.label ?? company.role}
                </span>
              </div>

              {company.modules.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {company.modules.map((mod) => (
                    <span key={mod} className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-white/5 text-white/40 border border-white/[0.06]">
                      {mod}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-white/20 italic">Geen actieve modules</p>
              )}

              <div className="flex items-center gap-4 pt-1 border-t border-white/5">
                <div className="flex items-center gap-1.5 text-[11px] text-white/40">
                  <Bot size={12} />
                  <span>{agentCounts[company.id] ?? 0} agents</span>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-white/40">
                  <CheckSquare size={12} />
                  <span>{taskCounts[company.id] ?? 0} taken</span>
                </div>
                <div className="ml-auto">
                  <button className="flex items-center gap-1.5 border border-white/10 text-white/50 hover:text-white hover:border-white/20 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors">
                    <Settings size={11} />
                    Beheer
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
