import { createClient } from '@/lib/supabase/server'
import { Bot, Zap, CheckCircle2, XCircle } from 'lucide-react'
import AgentGrid from './AgentGrid'

export default async function AgentsPage() {
  const supabase = await createClient()

  const { data: agents } = await supabase
    .from('oc_ai_agents')
    .select('*')
    .order('naam', { ascending: true })

  const totaal = agents?.length ?? 0
  const running = agents?.filter(a => a.status === 'running').length ?? 0
  const totalRuns = agents?.reduce((s, a) => s + (a.run_count ?? 0), 0) ?? 0
  const totalSuccess = agents?.reduce((s, a) => s + (a.success_count ?? 0), 0) ?? 0
  const successRate = totalRuns > 0 ? Math.round((totalSuccess / totalRuns) * 100) : 0

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center">
          <Bot size={16} className="text-pink-400" />
        </div>
        <div>
          <h1 className="text-base font-semibold text-white">AI Agents</h1>
          <p className="text-xs text-white/50">Autonome AI-workers voor elke taak in het ecosysteem</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Agents Totaal', value: totaal, icon: Bot, color: 'text-pink-400', border: 'border-pink-500/20' },
          { label: 'Running', value: running, icon: Zap, color: running > 0 ? 'text-indigo-400' : 'text-white/38', border: running > 0 ? 'border-indigo-500/20' : 'border-white/5' },
          { label: 'Totale Runs', value: totalRuns, icon: CheckCircle2, color: 'text-emerald-400', border: 'border-emerald-500/20' },
          { label: 'Succes Rate', value: `${successRate}%`, icon: XCircle, color: successRate >= 80 ? 'text-green-400' : 'text-amber-400', border: successRate >= 80 ? 'border-green-500/20' : 'border-amber-500/20' },
        ].map(s => {
          const Icon = s.icon
          return (
            <div key={s.label} className={`bg-white/[0.06] border ${s.border} rounded-xl p-4`}>
              <Icon size={13} className={`${s.color} mb-2`} />
              <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-[11px] text-white/50 mt-0.5">{s.label}</p>
            </div>
          )
        })}
      </div>

      <AgentGrid agents={agents ?? []} />
    </div>
  )
}
