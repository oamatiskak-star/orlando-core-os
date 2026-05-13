import { createClient } from '@/lib/supabase/server'
import { Zap, GitBranch, ListChecks, Activity, Plus } from 'lucide-react'
import Link from 'next/link'

type AutomatedWorkflow = {
  id: string
  naam: string
  company: string
  trigger_type: string
  trigger_config: Record<string, string>
  status: string
  run_count: number
  last_run_at: string | null
  last_run_status: string | null
  category: string | null
}

type AutomatedRoutine = {
  id: string
  naam: string
  company: string
  schedule: string
  status: string
  run_count: number
  last_run_at: string | null
  last_run_status: string | null
  category: string | null
}

const STATUS_COLORS: Record<string, string> = {
  actief: 'text-green-400 bg-green-500/10',
  gepauzeerd: 'text-amber-400 bg-amber-500/10',
  uitgeschakeld: 'text-white/25 bg-white/5',
}

const TRIGGER_ICONS: Record<string, string> = {
  webhook: '🪝',
  event: '⚡',
  cron: '⏰',
  manual: '👆',
}

export default async function AutomationsPage() {
  const supabase = await createClient()

  const [
    { data: automatedWorkflows },
    { data: routines },
  ] = await Promise.all([
    supabase.from('oc_workflows')
      .select('id, naam, company, trigger_type, trigger_config, status, run_count, last_run_at, last_run_status, category')
      .in('trigger_type', ['webhook', 'event', 'cron'])
      .neq('status', 'uitgeschakeld')
      .order('run_count', { ascending: false }),
    supabase.from('oc_routines')
      .select('id, naam, company, schedule, status, run_count, last_run_at, last_run_status, category')
      .neq('status', 'uitgeschakeld')
      .order('run_count', { ascending: false }),
  ])

  const totalAutomations = (automatedWorkflows?.length ?? 0) + (routines?.length ?? 0)
  const activeAutomations = [
    ...(automatedWorkflows?.filter(w => w.status === 'actief') ?? []),
    ...(routines?.filter(r => r.status === 'actief') ?? []),
  ].length

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
            <Zap size={16} className="text-violet-400" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-white">Automations</h1>
            <p className="text-xs text-white/50">Alle automatisch getriggerde workflows en routines</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/operations/workflows" className="flex items-center gap-2 border border-white/10 text-white/60 hover:text-white text-xs px-3 py-1.5 rounded-lg transition-colors">
            <GitBranch size={11} /> Workflow
          </Link>
          <Link href="/dashboard/operations/routines" className="flex items-center gap-2 border border-white/10 text-white/60 hover:text-white text-xs px-3 py-1.5 rounded-lg transition-colors">
            <ListChecks size={11} /> Routine
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Totaal', value: totalAutomations, icon: Zap, color: 'text-violet-400', border: 'border-violet-500/20' },
          { label: 'Actief', value: activeAutomations, icon: Activity, color: 'text-green-400', border: 'border-green-500/20' },
          { label: 'Gepauzeerd', value: totalAutomations - activeAutomations, icon: Activity, color: 'text-amber-400', border: 'border-amber-500/20' },
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

      {(automatedWorkflows?.length ?? 0) > 0 && (
        <div className="bg-white/[0.06] border border-white/5 rounded-xl overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-3 border-b border-white/5">
            <GitBranch size={13} className="text-emerald-400" />
            <h3 className="text-xs font-semibold text-white">Geautomatiseerde Workflows</h3>
            <span className="ml-auto text-[10px] text-white/38">{automatedWorkflows?.length}</span>
          </div>
          <div className="divide-y divide-white/[0.03]">
            {(automatedWorkflows as AutomatedWorkflow[]).map(wf => {
              const lastRun = wf.last_run_at
                ? new Date(wf.last_run_at).toLocaleString('nl-NL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
                : '—'
              const triggerLabel = wf.trigger_config?.schedule ?? wf.trigger_config?.event_name ?? wf.trigger_config?.webhook_secret?.slice(0, 8) ?? wf.trigger_type
              return (
                <div key={wf.id} className="flex items-center gap-3 px-5 py-3">
                  <span className="text-base flex-shrink-0">{TRIGGER_ICONS[wf.trigger_type] ?? '⚙️'}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-white truncate">{wf.naam}</span>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${STATUS_COLORS[wf.status] ?? 'text-white/50 bg-white/5'}`}>{wf.status}</span>
                    </div>
                    <p className="text-[10px] text-white/38 mt-0.5 font-mono">{triggerLabel} · {wf.company}</p>
                  </div>
                  <div className="hidden md:flex items-center gap-4 text-[11px] text-white/38 flex-shrink-0">
                    <span>{wf.run_count}x</span>
                    <span>{lastRun}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {(routines?.length ?? 0) > 0 && (
        <div className="bg-white/[0.06] border border-white/5 rounded-xl overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-3 border-b border-white/5">
            <ListChecks size={13} className="text-amber-400" />
            <h3 className="text-xs font-semibold text-white">Routines</h3>
            <span className="ml-auto text-[10px] text-white/38">{routines?.length}</span>
          </div>
          <div className="divide-y divide-white/[0.03]">
            {(routines as AutomatedRoutine[]).map(r => {
              const lastRun = r.last_run_at
                ? new Date(r.last_run_at).toLocaleString('nl-NL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
                : '—'
              return (
                <div key={r.id} className="flex items-center gap-3 px-5 py-3">
                  <span className="text-base flex-shrink-0">⏰</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-white truncate">{r.naam}</span>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${STATUS_COLORS[r.status] ?? 'text-white/50 bg-white/5'}`}>{r.status}</span>
                    </div>
                    <p className="text-[10px] text-white/38 mt-0.5 font-mono">{r.schedule} · {r.company}</p>
                  </div>
                  <div className="hidden md:flex items-center gap-4 text-[11px] text-white/38 flex-shrink-0">
                    <span>{r.run_count}x</span>
                    <span>{lastRun}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {totalAutomations === 0 && (
        <div className="flex flex-col items-center justify-center py-20 gap-4 bg-white/[0.02] border border-white/5 rounded-xl">
          <div className="w-12 h-12 rounded-full bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
            <Zap size={20} className="text-violet-400" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-white">Geen automatiseringen</p>
            <p className="text-xs text-white/45 mt-1">Maak workflows met trigger type webhook, event of cron</p>
          </div>
          <div className="flex gap-3">
            <Link href="/dashboard/operations/workflows" className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs px-4 py-2 rounded-lg transition-colors">
              <Plus size={12} /> Workflow aanmaken
            </Link>
            <Link href="/dashboard/operations/routines" className="flex items-center gap-2 border border-white/10 text-white/60 hover:text-white text-xs px-4 py-2 rounded-lg transition-colors">
              <Plus size={12} /> Routine aanmaken
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
