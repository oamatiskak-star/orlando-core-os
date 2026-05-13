import { createClient } from '@/lib/supabase/server'
import { GitBranch, Activity, CheckCircle2, XCircle, Clock } from 'lucide-react'
import WorkflowList from './WorkflowList'

export default async function WorkflowsPage() {
  const supabase = await createClient()

  const { data: workflows } = await supabase
    .from('oc_workflows')
    .select('*')
    .neq('status', 'uitgeschakeld')
    .order('status', { ascending: true })
    .order('naam', { ascending: true })

  const { data: recentRuns } = await supabase
    .from('oc_workflow_runs')
    .select('status')
    .gte('started_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())

  const stats = {
    totaal: workflows?.length ?? 0,
    actief: workflows?.filter(w => w.status === 'actief').length ?? 0,
    runs24h: recentRuns?.length ?? 0,
    success24h: recentRuns?.filter(r => r.status === 'success').length ?? 0,
    failed24h: recentRuns?.filter(r => r.status === 'failed').length ?? 0,
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
          <GitBranch size={16} className="text-emerald-400" />
        </div>
        <div>
          <h1 className="text-base font-semibold text-white">Workflow Engine</h1>
          <p className="text-xs text-white/50">Automatiseer elke taak — cron, webhook, event of handmatig</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Workflows', value: stats.totaal, icon: GitBranch, color: 'text-emerald-400', border: 'border-emerald-500/20', bg: 'bg-emerald-500/10' },
          { label: 'Actief', value: stats.actief, icon: Activity, color: 'text-green-400', border: 'border-green-500/20', bg: 'bg-green-500/10' },
          { label: 'Runs (24u)', value: stats.runs24h, icon: Clock, color: 'text-sky-400', border: 'border-sky-500/20', bg: 'bg-sky-500/10' },
          { label: 'Geslaagd', value: stats.success24h, icon: CheckCircle2, color: 'text-indigo-400', border: 'border-indigo-500/20', bg: 'bg-indigo-500/10' },
          { label: 'Mislukt', value: stats.failed24h, icon: XCircle, color: stats.failed24h > 0 ? 'text-red-400' : 'text-white/38', border: stats.failed24h > 0 ? 'border-red-500/20' : 'border-white/5', bg: stats.failed24h > 0 ? 'bg-red-500/10' : 'bg-white/5' },
        ].map(s => {
          const Icon = s.icon
          return (
            <div key={s.label} className={`bg-white/[0.06] border ${s.border} rounded-xl p-4`}>
              <div className={`w-7 h-7 rounded-lg border ${s.bg} ${s.border} flex items-center justify-center mb-3`}>
                <Icon size={13} className={s.color} />
              </div>
              <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-[11px] text-white/50 mt-0.5">{s.label}</p>
            </div>
          )
        })}
      </div>

      <WorkflowList workflows={workflows ?? []} />
    </div>
  )
}
