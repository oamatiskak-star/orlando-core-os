import { Workflow, Activity, CheckCircle, XCircle, Clock } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import WorkflowControls from './WorkflowControls'
import RunHistory from './RunHistory'

export default async function WorkflowsPage() {
  const supabase = await createClient()

  const { data: workflows } = await supabase
    .from('oc_workflows')
    .select('*')
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
            <Workflow size={16} className="text-emerald-400" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-white">Workflow Engine</h1>
            <p className="text-xs text-white/50">Automatiseer elke taak — cron, webhook, event of handmatig</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Workflows', value: stats.totaal, icon: Workflow, color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
          { label: 'Actief', value: stats.actief, icon: Activity, color: 'text-green-400 bg-green-500/10 border-green-500/20' },
          { label: 'Runs (24u)', value: stats.runs24h, icon: Clock, color: 'text-sky-400 bg-sky-500/10 border-sky-500/20' },
          { label: 'Geslaagd', value: stats.success24h, icon: CheckCircle, color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20' },
          { label: 'Mislukt', value: stats.failed24h, icon: XCircle, color: stats.failed24h > 0 ? 'text-red-400 bg-red-500/10 border-red-500/20' : 'text-white/38 bg-white/5 border-white/5' },
        ].map(s => {
          const Icon = s.icon
          const [textC, bgC, borderC] = s.color.split(' ')
          return (
            <div key={s.label} className={`bg-white/[0.06] border ${borderC} rounded-xl p-4`}>
              <div className={`w-7 h-7 rounded-lg border ${bgC} ${borderC} flex items-center justify-center mb-3`}>
                <Icon size={13} className={textC} />
              </div>
              <p className={`text-xl font-bold ${textC}`}>{s.value}</p>
              <p className="text-[11px] text-white/50 mt-0.5">{s.label}</p>
            </div>
          )
        })}
      </div>

      {/* Workflow lijst + controls */}
      <div className="bg-white/[0.06] border border-white/5 rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">Workflows</h2>
          <WorkflowControls workflows={(workflows ?? []) as Parameters<typeof WorkflowControls>[0]['workflows']} />
        </div>
      </div>

      {/* Run history — realtime via client component */}
      <div className="bg-white/[0.06] border border-white/5 rounded-xl p-5 space-y-3">
        <h2 className="text-sm font-semibold text-white">Run History</h2>
        <p className="text-[11px] text-white/45">Realtime updates — elke workflow run verschijnt hier direct</p>
        <RunHistory />
      </div>
    </div>
  )
}
