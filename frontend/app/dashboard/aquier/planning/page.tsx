import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { GanttChart, ChevronLeft, CheckSquare, Square, AlertCircle } from 'lucide-react'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type Sprint = {
  id: string
  sprint_code: string
  starts_on: string
  ends_on: string
  theme: string | null
  status: string
  capacity_hours: number | null
}

type Task = {
  id: string
  sprint_id: string | null
  project_id: string | null
  title: string
  status: string
  priority: string
  owner_agent: string | null
  estimate_hours: number | null
  due_at: string | null
}

type Project = {
  id: string
  code: string | null
  name: string
}

const TASK_STATUS_ICON: Record<string, { Icon: typeof CheckSquare; color: string }> = {
  pending:     { Icon: Square, color: 'text-white/30' },
  in_progress: { Icon: Square, color: 'text-blue-400' },
  blocked:     { Icon: AlertCircle, color: 'text-orange-400' },
  completed:   { Icon: CheckSquare, color: 'text-emerald-400' },
  deferred:    { Icon: Square, color: 'text-amber-400' },
  cancelled:   { Icon: Square, color: 'text-red-400/50' },
}

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })
}

export default async function PlanningPage() {
  const supabase = await createClient()

  const [{ data: sprintsData }, { data: tasksData }, { data: projectsData }] = await Promise.all([
    supabase.from('aquier_sprints').select('*').order('starts_on', { ascending: false }).limit(12),
    supabase.from('aquier_tasks').select('*').order('priority', { ascending: false }).order('due_at', { ascending: true }),
    supabase.from('aquier_projects').select('id,code,name'),
  ])

  const sprints = (sprintsData ?? []) as Sprint[]
  const tasks = (tasksData ?? []) as Task[]
  const projectMap = new Map((projectsData ?? []).map((p: Project) => [p.id, p]))

  const activeSprint = sprints.find(s => s.status === 'active') ?? sprints.find(s => s.status === 'planned') ?? sprints[0]
  const tasksBySprint = new Map<string, Task[]>()
  tasks.forEach(t => {
    const key = t.sprint_id ?? 'unscoped'
    if (!tasksBySprint.has(key)) tasksBySprint.set(key, [])
    tasksBySprint.get(key)!.push(t)
  })

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/aquier" className="text-white/40 hover:text-white/70">
          <ChevronLeft size={16} />
        </Link>
        <div className="w-9 h-9 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
          <GanttChart size={16} className="text-violet-400" />
        </div>
        <div>
          <h1 className="text-base font-semibold text-white">Planning</h1>
          <p className="text-xs text-white/50">Sprints + taken — capaciteit & afhankelijkheden</p>
        </div>
      </div>

      {/* Active sprint banner */}
      {activeSprint && (
        <div className="bg-gradient-to-br from-violet-500/8 to-cyan-500/5 border border-violet-500/20 rounded-xl p-4">
          <div className="flex items-start justify-between gap-3 mb-2">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[9px] font-bold text-violet-400 uppercase tracking-wider">
                  {activeSprint.status === 'active' ? 'Lopende Sprint' : 'Aankomende Sprint'}
                </span>
                <span className="text-[10px] text-white/40 font-mono">{activeSprint.sprint_code}</span>
              </div>
              <p className="text-[13px] text-white/85 font-medium">{activeSprint.theme ?? 'Geen thema gezet'}</p>
              <p className="text-[10.5px] text-white/45 mt-0.5">
                {fmtDate(activeSprint.starts_on)} → {fmtDate(activeSprint.ends_on)}
                {activeSprint.capacity_hours ? ` · ${activeSprint.capacity_hours}u capaciteit` : ''}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* All sprints */}
      <div className="space-y-3">
        <h2 className="text-[12px] font-semibold text-white/70">Alle Sprints</h2>
        {sprints.length === 0 ? (
          <div className="py-10 text-center bg-white/[0.02] border border-dashed border-white/10 rounded-xl">
            <GanttChart size={24} className="text-white/15 mx-auto mb-2" />
            <p className="text-[11px] text-white/30">Geen sprints geconfigureerd</p>
          </div>
        ) : (
          sprints.map(sprint => {
            const sprintTasks = tasksBySprint.get(sprint.id) ?? []
            const done = sprintTasks.filter(t => t.status === 'completed').length
            return (
              <div key={sprint.id} className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono text-white/35">{sprint.sprint_code}</span>
                    <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded ${
                      sprint.status === 'active' ? 'bg-blue-500/15 text-blue-400'
                        : sprint.status === 'completed' ? 'bg-emerald-500/15 text-emerald-400'
                          : 'bg-white/10 text-white/50'
                    }`}>
                      {sprint.status}
                    </span>
                    <span className="text-[10.5px] text-white/55">{fmtDate(sprint.starts_on)} → {fmtDate(sprint.ends_on)}</span>
                  </div>
                  {sprintTasks.length > 0 && (
                    <span className="text-[10px] text-white/40">{done}/{sprintTasks.length} taken klaar</span>
                  )}
                </div>
                {sprint.theme && <p className="text-[11.5px] text-white/65 mb-2">{sprint.theme}</p>}

                {sprintTasks.length > 0 && (
                  <div className="space-y-1 mt-3 border-t border-white/[0.04] pt-3">
                    {sprintTasks.map(t => {
                      const cfg = TASK_STATUS_ICON[t.status] ?? TASK_STATUS_ICON.pending
                      const Icon = cfg.Icon
                      const proj = t.project_id ? projectMap.get(t.project_id) : null
                      return (
                        <div key={t.id} className="flex items-center gap-2 py-1.5 px-2 rounded bg-white/[0.02]">
                          <Icon size={12} className={cfg.color} />
                          <span className="text-[11.5px] text-white/70 flex-1 truncate">{t.title}</span>
                          {proj && <span className="text-[9px] text-white/30 font-mono">{proj.code}</span>}
                          {t.owner_agent && <span className="text-[9px] text-white/35">{t.owner_agent}</span>}
                          {t.estimate_hours && <span className="text-[9px] text-white/35">{t.estimate_hours}u</span>}
                        </div>
                      )
                    })}
                  </div>
                )}

                {sprintTasks.length === 0 && (
                  <p className="text-[10.5px] text-white/25 italic mt-2">Nog geen taken — AI Project Leider plant deze maandag</p>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
