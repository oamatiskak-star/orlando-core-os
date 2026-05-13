import { createClient } from '@/lib/supabase/server'
import { Settings, GitBranch, Bot, Clock, Package, Webhook, PlugZap, ListChecks } from 'lucide-react'

export default async function GlobalSettingsPage() {
  const supabase = await createClient()

  const [
    { count: wfCount },
    { count: agentCount },
    { count: schedulerCount },
    { count: queueCount },
    { count: webhookCount },
    { count: connectionCount },
    { count: routineCount },
    { count: templateCount },
  ] = await Promise.all([
    supabase.from('oc_workflows').select('*', { count: 'exact', head: true }),
    supabase.from('oc_ai_agents').select('*', { count: 'exact', head: true }),
    supabase.from('oc_scheduler_tasks').select('*', { count: 'exact', head: true }),
    supabase.from('oc_queue_jobs').select('*', { count: 'exact', head: true }),
    supabase.from('oc_webhooks').select('*', { count: 'exact', head: true }),
    supabase.from('oc_api_connections').select('*', { count: 'exact', head: true }),
    supabase.from('oc_routines').select('*', { count: 'exact', head: true }),
    supabase.from('oc_automation_templates').select('*', { count: 'exact', head: true }),
  ])

  const MODULES = [
    { label: 'Workflows', count: wfCount ?? 0, icon: GitBranch, color: 'text-emerald-400', desc: 'Geconfigureerde workflow definities' },
    { label: 'Routines', count: routineCount ?? 0, icon: ListChecks, color: 'text-amber-400', desc: 'Terugkerende geplande taken' },
    { label: 'AI Agents', count: agentCount ?? 0, icon: Bot, color: 'text-pink-400', desc: 'Actieve AI-worker definities' },
    { label: 'Scheduler Tasks', count: schedulerCount ?? 0, icon: Clock, color: 'text-sky-400', desc: 'Geplande tijdgestuurde taken' },
    { label: 'Queue Jobs (totaal)', count: queueCount ?? 0, icon: Package, color: 'text-indigo-400', desc: 'Alle queue jobs in de database' },
    { label: 'Webhooks', count: webhookCount ?? 0, icon: Webhook, color: 'text-violet-400', desc: 'Inkomende webhook endpoints' },
    { label: 'API Connections', count: connectionCount ?? 0, icon: PlugZap, color: 'text-amber-400', desc: 'Externe API koppelingen' },
    { label: 'Templates', count: templateCount ?? 0, icon: Settings, color: 'text-white/50', desc: 'Opgeslagen automatiseringssjablonen' },
  ]

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
          <Settings size={16} className="text-white/60" />
        </div>
        <div>
          <h1 className="text-base font-semibold text-white">Global Settings</h1>
          <p className="text-xs text-white/50">Systeembrede configuratie en statusoverzicht van het Operations Center</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {MODULES.map(m => {
          const Icon = m.icon
          return (
            <div key={m.label} className="bg-white/[0.06] border border-white/5 rounded-xl p-4">
              <Icon size={13} className={`${m.color} mb-2`} />
              <p className={`text-xl font-bold ${m.color}`}>{m.count}</p>
              <p className="text-[11px] text-white/60 mt-0.5">{m.label}</p>
              <p className="text-[10px] text-white/30 mt-1">{m.desc}</p>
            </div>
          )
        })}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white/[0.06] border border-white/5 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Systeem Configuratie</h3>
          <div className="space-y-3">
            {[
              { key: 'Standaard Timezone', value: 'Europe/Amsterdam' },
              { key: 'Queue Retry Max', value: '3' },
              { key: 'Queue Timeout', value: '300 seconden' },
              { key: 'Log Retention', value: '90 dagen' },
              { key: 'Realtime Updates', value: 'Supabase Realtime' },
              { key: 'Worker Backend', value: 'Render.com' },
            ].map(item => (
              <div key={item.key} className="flex items-center justify-between py-2 border-b border-white/[0.03]">
                <span className="text-xs text-white/50">{item.key}</span>
                <span className="text-xs text-white/80 font-mono">{item.value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white/[0.06] border border-white/5 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Database Tabellen</h3>
          <div className="space-y-1.5">
            {[
              'oc_workflows', 'oc_workflow_nodes', 'oc_workflow_runs', 'oc_workflow_logs',
              'oc_routines', 'oc_routine_runs', 'oc_scheduler_tasks',
              'oc_queue_jobs', 'oc_queue_logs',
              'oc_ai_agents', 'oc_agent_runs',
              'oc_automation_templates', 'oc_webhooks',
              'oc_api_connections', 'oc_workflow_metrics', 'oc_ai_suggestions',
            ].map(table => (
              <div key={table} className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0" />
                <code className="text-[11px] text-white/55 font-mono">{table}</code>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-indigo-500/5 border border-indigo-500/20 rounded-xl p-4">
        <p className="text-xs text-indigo-400 font-semibold mb-1">Operations Center v1.0</p>
        <p className="text-[11px] text-white/45">Gebouwd op Supabase, Next.js App Router en Render.com executors. Alle wijzigingen zijn real-time via Supabase Realtime en server actions.</p>
      </div>
    </div>
  )
}
