import { createClient } from '@/lib/supabase/server'
import { SlidersHorizontal, GitBranch, Bot, Webhook, PlugZap } from 'lucide-react'

export default async function CompanySettingsPage() {
  const supabase = await createClient()

  const [
    { data: workflows },
    { data: agents },
    { data: webhooks },
    { data: connections },
    { data: routines },
  ] = await Promise.all([
    supabase.from('oc_workflows').select('id, naam, company, status, trigger_type').order('company'),
    supabase.from('oc_ai_agents').select('id, naam, company, status, type').order('company'),
    supabase.from('oc_webhooks').select('id, naam, company, status, trigger_count').order('company'),
    supabase.from('oc_api_connections').select('id, naam, company, service, status').order('company'),
    supabase.from('oc_routines').select('id, naam, company, status, schedule').order('company'),
  ])

  const companies = Array.from(new Set([
    ...(workflows?.map(w => w.company) ?? []),
    ...(agents?.map(a => a.company) ?? []),
    ...(webhooks?.map(w => w.company) ?? []),
    ...(connections?.map(c => c.company) ?? []),
    ...(routines?.map(r => r.company) ?? []),
  ])).filter(Boolean).sort() as string[]

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-slate-500/10 border border-slate-500/20 flex items-center justify-center">
          <SlidersHorizontal size={16} className="text-slate-400" />
        </div>
        <div>
          <h1 className="text-base font-semibold text-white">Company Settings</h1>
          <p className="text-xs text-white/50">Overzicht van Operations Center configuratie per bedrijf</p>
        </div>
      </div>

      {companies.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 bg-white/[0.02] border border-white/5 rounded-xl">
          <SlidersHorizontal size={24} className="text-white/20" />
          <p className="text-sm text-white/50">Nog geen configuraties aangemaakt</p>
        </div>
      ) : (
        <div className="space-y-4">
          {companies.map(company => {
            const companyWorkflows = workflows?.filter(w => w.company === company) ?? []
            const companyAgents = agents?.filter(a => a.company === company) ?? []
            const companyWebhooks = webhooks?.filter(w => w.company === company) ?? []
            const companyConnections = connections?.filter(c => c.company === company) ?? []
            const companyRoutines = routines?.filter(r => r.company === company) ?? []

            return (
              <div key={company} className="bg-white/[0.06] border border-white/5 rounded-xl overflow-hidden">
                <div className="px-5 py-3 border-b border-white/5 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-white">{company}</h3>
                  <div className="flex items-center gap-2 text-[10px] text-white/38">
                    <span>{companyWorkflows.filter(w => w.status === 'actief').length} workflows actief</span>
                    <span>·</span>
                    <span>{companyAgents.length} agents</span>
                  </div>
                </div>
                <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                  {companyWorkflows.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <GitBranch size={12} className="text-emerald-400" />
                        <span className="text-[11px] font-semibold text-white/60">Workflows ({companyWorkflows.length})</span>
                      </div>
                      <div className="space-y-1">
                        {companyWorkflows.slice(0, 5).map(w => (
                          <div key={w.id} className="flex items-center gap-2">
                            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${w.status === 'actief' ? 'bg-green-500' : 'bg-white/20'}`} />
                            <span className="text-xs text-white/60 truncate">{w.naam}</span>
                            <span className="ml-auto text-[10px] text-white/30 flex-shrink-0">{w.trigger_type}</span>
                          </div>
                        ))}
                        {companyWorkflows.length > 5 && <p className="text-[10px] text-white/25">+{companyWorkflows.length - 5} meer</p>}
                      </div>
                    </div>
                  )}

                  {companyRoutines.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-[11px] font-semibold text-white/60">Routines ({companyRoutines.length})</span>
                      </div>
                      <div className="space-y-1">
                        {companyRoutines.slice(0, 5).map(r => (
                          <div key={r.id} className="flex items-center gap-2">
                            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${r.status === 'actief' ? 'bg-amber-500' : 'bg-white/20'}`} />
                            <span className="text-xs text-white/60 truncate">{r.naam}</span>
                            <code className="ml-auto text-[10px] text-white/25 flex-shrink-0 font-mono">{r.schedule}</code>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {companyAgents.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <Bot size={12} className="text-pink-400" />
                        <span className="text-[11px] font-semibold text-white/60">AI Agents ({companyAgents.length})</span>
                      </div>
                      <div className="space-y-1">
                        {companyAgents.map(a => (
                          <div key={a.id} className="flex items-center gap-2">
                            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${a.status === 'running' ? 'bg-indigo-500' : a.status === 'idle' ? 'bg-white/30' : 'bg-white/10'}`} />
                            <span className="text-xs text-white/60 truncate">{a.naam}</span>
                            <span className="ml-auto text-[10px] text-white/30 flex-shrink-0">{a.type}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {companyConnections.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <PlugZap size={12} className="text-amber-400" />
                        <span className="text-[11px] font-semibold text-white/60">API Connections ({companyConnections.length})</span>
                      </div>
                      <div className="space-y-1">
                        {companyConnections.map(c => (
                          <div key={c.id} className="flex items-center gap-2">
                            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${c.status === 'actief' ? 'bg-green-500' : 'bg-red-500'}`} />
                            <span className="text-xs text-white/60 truncate">{c.naam}</span>
                            <span className="ml-auto text-[10px] text-white/30 flex-shrink-0">{c.service}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {companyWebhooks.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <Webhook size={12} className="text-indigo-400" />
                        <span className="text-[11px] font-semibold text-white/60">Webhooks ({companyWebhooks.length})</span>
                      </div>
                      <div className="space-y-1">
                        {companyWebhooks.map(w => (
                          <div key={w.id} className="flex items-center gap-2">
                            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${w.status === 'actief' ? 'bg-green-500' : 'bg-white/20'}`} />
                            <span className="text-xs text-white/60 truncate">{w.naam}</span>
                            <span className="ml-auto text-[10px] text-white/30 flex-shrink-0">{w.trigger_count}x</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
