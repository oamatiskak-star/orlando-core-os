import { Building2, Bot, CheckSquare, Settings } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type Company = {
  id: string
  name: string
  type: string | null
  kvk_number: string | null
  description: string | null
  parent_id: string | null
}

const TYPE_BADGE: Record<string, { label: string; className: string }> = {
  holding:          { label: 'Holding',          className: 'bg-indigo-500/10 text-indigo-400' },
  werkmaatschappij: { label: 'Werkmaatschappij', className: 'bg-sky-500/10 text-sky-400' },
  holding_persoon:  { label: 'Holding / Persoon', className: 'bg-violet-500/10 text-violet-400' },
  persoon:          { label: 'Eigenaar',          className: 'bg-violet-500/10 text-violet-400' },
}

const COMPANY_COLORS: Record<string, string> = {
  MODIWÉ: '#6366f1', MODIWE: '#6366f1', MEDIA: '#8b5cf6',
  BEHEER: '#0ea5e9', BOUW: '#f59e0b', PROFFS: '#10b981',
}

function colorFor(name: string) {
  const upper = name.toUpperCase()
  for (const [key, color] of Object.entries(COMPANY_COLORS)) {
    if (upper.includes(key)) return color
  }
  return '#6366f1'
}

export default async function CompaniesPage() {
  const supabase = await createClient()

  const [
    { data: companies },
    { data: agentData },
    { data: taskData },
  ] = await Promise.all([
    supabase.from('companies').select('*').order('name', { ascending: true }),
    supabase.from('agents').select('company_id').not('company_id', 'is', null),
    supabase.from('planning_items').select('company_id').not('company_id', 'is', null).neq('status', 'gereed'),
  ])

  const agentCounts: Record<string, number> = {}
  for (const row of agentData ?? []) {
    agentCounts[row.company_id] = (agentCounts[row.company_id] ?? 0) + 1
  }

  const taskCounts: Record<string, number> = {}
  for (const row of taskData ?? []) {
    taskCounts[row.company_id] = (taskCounts[row.company_id] ?? 0) + 1
  }

  const rows = (companies ?? []) as Company[]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
            <Building2 size={16} className="text-indigo-400" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-white">Bedrijven</h1>
            <p className="text-xs text-white/50">Beheer alle BV&apos;s, holdings en werkmaatschappijen binnen het ecosysteem.</p>
          </div>
        </div>
        <span className="text-[11px] text-white/40">{rows.length} bedrijf{rows.length !== 1 ? 'ven' : ''}</span>
      </div>

      {rows.length === 0 ? (
        <div className="bg-white/[0.06] border border-white/5 rounded-xl p-10 flex flex-col items-center gap-3">
          <Building2 size={28} className="text-white/20" />
          <p className="text-xs text-white/40">Geen bedrijven gevonden in de database</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {rows.map((company) => {
            const badge = TYPE_BADGE[company.type ?? '']
            const color = colorFor(company.name)
            const agents = agentCounts[company.id] ?? 0
            const tasks  = taskCounts[company.id] ?? 0
            return (
              <div key={company.id} className="bg-white/[0.06] border border-white/5 rounded-xl p-5 flex flex-col gap-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                    <div>
                      <p className="text-sm font-semibold text-white">{company.name}</p>
                      {company.kvk_number && (
                        <p className="text-[11px] text-white/40 mt-0.5">KvK {company.kvk_number}</p>
                      )}
                    </div>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${badge?.className ?? 'bg-white/5 text-white/50'}`}>
                    {badge?.label ?? company.type ?? 'Onbekend'}
                  </span>
                </div>

                {company.description && (
                  <p className="text-[11px] text-white/50 leading-relaxed">{company.description}</p>
                )}

                <div className="flex items-center gap-4 pt-1 border-t border-white/5">
                  <div className="flex items-center gap-1.5 text-[11px] text-white/65">
                    <Bot size={12} />
                    <span>{agents} agent{agents !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] text-white/65">
                    <CheckSquare size={12} />
                    <span>{tasks} open {tasks !== 1 ? 'taken' : 'taak'}</span>
                  </div>
                  <div className="ml-auto">
                    <Link href={`/dashboard/taken`} className="flex items-center gap-1.5 border border-white/10 text-white/50 hover:text-white hover:border-white/20 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors">
                      <Settings size={11} />
                      Beheer
                    </Link>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
