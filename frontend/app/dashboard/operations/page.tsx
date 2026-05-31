import { createClient } from '@/lib/supabase/server'
import { Cpu, GitBranch, CheckCircle2, XCircle, Package, Bot, ListChecks, Activity, ArrowRight, Layers, PlugZap, AlertTriangle, Shield } from 'lucide-react'
import Link from 'next/link'

export default async function OperationsDashboard() {
  const supabase = await createClient()
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()

  const [
    { count: wfTotal },
    { count: wfActief },
    { count: runsVandaag },
    { count: runsSuccess },
    { count: runsFailed },
    { count: queuePending },
    { count: queueRunning },
    { count: queueFailed },
    { count: agentsActief },
    { count: routinesActief },
    { data: recentRuns },
  ] = await Promise.all([
    supabase.from('oc_workflows').select('*', { count: 'exact', head: true }),
    supabase.from('oc_workflows').select('*', { count: 'exact', head: true }).eq('status', 'actief'),
    supabase.from('oc_workflow_runs').select('*', { count: 'exact', head: true }).gte('started_at', todayStart),
    supabase.from('oc_workflow_runs').select('*', { count: 'exact', head: true }).gte('started_at', todayStart).eq('status', 'success'),
    supabase.from('oc_workflow_runs').select('*', { count: 'exact', head: true }).gte('started_at', todayStart).eq('status', 'failed'),
    supabase.from('oc_queue_jobs').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('oc_queue_jobs').select('*', { count: 'exact', head: true }).eq('status', 'running'),
    supabase.from('oc_queue_jobs').select('*', { count: 'exact', head: true }).eq('status', 'failed'),
    supabase.from('oc_ai_agents').select('*', { count: 'exact', head: true }).eq('status', 'running'),
    supabase.from('oc_routines').select('*', { count: 'exact', head: true }).eq('status', 'actief'),
    supabase.from('oc_workflow_runs')
      .select('id, status, trigger_source, duration_ms, started_at, workflow_id, oc_workflows(naam)')
      .order('started_at', { ascending: false })
      .limit(8),
  ])

  const successRate = runsVandaag && runsVandaag > 0 ? Math.round(((runsSuccess ?? 0) / runsVandaag) * 100) : 100

  const STATS = [
    { label: 'Workflows Actief', value: wfActief ?? 0, total: wfTotal ?? 0, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20', icon: GitBranch, href: '/dashboard/operations/workflows' },
    { label: 'Runs Vandaag', value: runsVandaag ?? 0, color: 'text-sky-400', bg: 'bg-sky-500/10 border-sky-500/20', icon: Activity, href: '/dashboard/operations/logs' },
    { label: 'Succes Rate', value: `${successRate}%`, color: successRate >= 80 ? 'text-green-400' : 'text-amber-400', bg: successRate >= 80 ? 'bg-green-500/10 border-green-500/20' : 'bg-amber-500/10 border-amber-500/20', icon: CheckCircle2, href: '/dashboard/operations/analytics' },
    { label: 'Fouten Vandaag', value: runsFailed ?? 0, color: (runsFailed ?? 0) > 0 ? 'text-red-400' : 'text-white/38', bg: (runsFailed ?? 0) > 0 ? 'bg-red-500/10 border-red-500/20' : 'bg-white/5 border-white/5', icon: XCircle, href: '/dashboard/operations/errors' },
    { label: 'Queue Pending', value: queuePending ?? 0, color: 'text-indigo-400', bg: 'bg-indigo-500/10 border-indigo-500/20', icon: Package, href: '/dashboard/operations/queue' },
    { label: 'Queue Running', value: queueRunning ?? 0, color: 'text-violet-400', bg: 'bg-violet-500/10 border-violet-500/20', icon: Package, href: '/dashboard/operations/queue' },
    { label: 'Agents Actief', value: agentsActief ?? 0, color: 'text-pink-400', bg: 'bg-pink-500/10 border-pink-500/20', icon: Bot, href: '/dashboard/operations/agents' },
    { label: 'Routines Actief', value: routinesActief ?? 0, color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20', icon: ListChecks, href: '/dashboard/operations/routines' },
  ]

  const STATUS_COLOR: Record<string, string> = {
    success: 'text-green-400 bg-green-500/10',
    failed: 'text-red-400 bg-red-500/10',
    running: 'text-indigo-400 bg-indigo-500/10',
    cancelled: 'text-white/45 bg-white/5',
  }

  type RunRow = {
    id: string
    status: string
    trigger_source: string | null
    duration_ms: number | null
    started_at: string
    workflow_id: string | null
    oc_workflows: { naam: string } | { naam: string }[] | null
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
          <Cpu size={16} className="text-violet-400" />
        </div>
        <div>
          <h1 className="text-base font-semibold text-white">Operations Center</h1>
          <p className="text-xs text-white/50">Volledig overzicht van workflows, agents, queues en automatiseringen</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
        {STATS.map(s => {
          const Icon = s.icon
          return (
            <Link key={s.label} href={s.href} className={`bg-white/[0.06] border ${s.bg} rounded-xl p-4 hover:bg-white/[0.09] transition-colors`}>
              <Icon size={13} className={`${s.color} mb-2`} />
              <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
              {'total' in s && s.total !== undefined && <p className="text-[9px] text-white/38">van {s.total} totaal</p>}
              <p className="text-[10px] text-white/50 mt-0.5">{s.label}</p>
            </Link>
          )
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white/[0.06] border border-white/5 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-white">Recente Activiteit</h3>
            <Link href="/dashboard/operations/logs" className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1">Alle logs <ArrowRight size={10} /></Link>
          </div>
          {!recentRuns?.length ? (
            <p className="text-xs text-white/38 text-center py-8">Nog geen workflow runs</p>
          ) : (
            <table className="w-full text-xs">
              <thead><tr className="border-b border-white/5">
                <th className="text-left py-1.5 pr-3 text-white/45 font-medium">Workflow</th>
                <th className="text-left py-1.5 pr-3 text-white/45 font-medium">Status</th>
                <th className="text-left py-1.5 pr-3 text-white/45 font-medium">Trigger</th>
                <th className="text-right py-1.5 text-white/45 font-medium">Tijdstip</th>
              </tr></thead>
              <tbody>
                {(recentRuns as RunRow[]).map((run) => (
                  <tr key={run.id} className="border-b border-white/[0.03]">
                    <td className="py-2 pr-3 text-white/70 max-w-[140px] truncate">{Array.isArray(run.oc_workflows) ? run.oc_workflows[0]?.naam : run.oc_workflows?.naam ?? run.workflow_id?.slice(0, 8)}</td>
                    <td className="py-2 pr-3"><span className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${STATUS_COLOR[run.status] ?? 'text-white/50 bg-white/5'}`}>{run.status}</span></td>
                    <td className="py-2 pr-3 text-white/45 font-mono text-[10px]">{run.trigger_source ?? 'manual'}</td>
                    <td className="py-2 text-right text-white/38 font-mono text-[10px]">{new Date(run.started_at).toLocaleString('nl-NL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="bg-white/[0.06] border border-white/5 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white mb-3">Quick Actions</h3>
          <div className="space-y-2">
            {[
              { href: '/dashboard/operations/workflows', label: 'Workflow aanmaken', icon: GitBranch, color: 'text-emerald-400' },
              { href: '/dashboard/operations/scheduler', label: 'Taak inplannen', icon: Activity, color: 'text-sky-400' },
              { href: '/dashboard/operations/agents', label: 'Agent configureren', icon: Bot, color: 'text-pink-400' },
              { href: '/dashboard/operations/hermes', label: 'Hermes monitoren', icon: Shield, color: 'text-cyan-400' },
              { href: '/dashboard/operations/errors', label: 'Fouten & Recovery', icon: AlertTriangle, color: 'text-red-400' },
              { href: '/dashboard/operations/queue', label: 'Queue monitoren', icon: Package, color: 'text-indigo-400' },
              { href: '/dashboard/operations/templates', label: 'Template gebruiken', icon: Layers, color: 'text-violet-400' },
              { href: '/dashboard/operations/api-connections', label: 'API koppelen', icon: PlugZap, color: 'text-amber-400' },
            ].map(a => {
              const Icon = a.icon
              return (
                <Link key={a.href} href={a.href} className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-white/5 hover:bg-white/[0.09] transition-colors group">
                  <Icon size={13} className={a.color} />
                  <span className="text-xs text-white/70 group-hover:text-white/90 transition-colors">{a.label}</span>
                  <ArrowRight size={10} className="ml-auto text-white/20 group-hover:text-white/50 transition-colors" />
                </Link>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
