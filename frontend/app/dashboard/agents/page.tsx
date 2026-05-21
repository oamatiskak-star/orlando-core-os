import { Bot, Activity, CheckCircle, XCircle, Clock } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import TabContainer from './TabContainer'

export default async function AgentsPage() {
  const supabase = await createClient()

  const { data: agents } = await supabase
    .from('oc_agents')
    .select('*')
    .order('status', { ascending: true })
    .order('naam', { ascending: true })

  const { data: recentTasks } = await supabase
    .from('oc_agent_tasks')
    .select('status')
    .gte('queued_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())

  const stats = {
    totaal: agents?.length ?? 0,
    online: agents?.filter(a => a.status === 'online' || a.status === 'processing').length ?? 0,
    tasks24h: recentTasks?.length ?? 0,
    success24h: recentTasks?.filter(t => t.status === 'success').length ?? 0,
    failed24h: recentTasks?.filter(t => t.status === 'failed').length ?? 0,
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
          <Bot size={16} className="text-cyan-400" />
        </div>
        <div>
          <h1 className="text-base font-semibold text-white">Agent OS</h1>
          <p className="text-xs text-white/50">Beheer en monitor alle AI-agents — dispatch taken, bekijk queue en realtime status</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Agents', value: stats.totaal, icon: Bot, color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20' },
          { label: 'Online', value: stats.online, icon: Activity, color: 'text-green-400 bg-green-500/10 border-green-500/20' },
          { label: 'Taken (24u)', value: stats.tasks24h, icon: Clock, color: 'text-sky-400 bg-sky-500/10 border-sky-500/20' },
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

      {/* Tab Container */}
      <TabContainer initialAgents={(agents ?? []) as Parameters<typeof TabContainer>[0]['initialAgents']} />
    </div>
  )
}
