import { createClient } from '@/lib/supabase/server'
import { getActiveCompanyId } from '@/lib/active-company-server'
import SystemHealthBoard from '@/components/build-war-room/roadmap/health/SystemHealthBoard'
import CeoMinutesGauge from '@/components/build-war-room/roadmap/CeoMinutesGauge'
import CertificationCard from '@/components/build-war-room/roadmap/CertificationCard'
import ExecutiveStatusBar from '@/components/build-war-room/roadmap/ExecutiveStatusBar'
import StatusColumns from '@/components/build-war-room/roadmap/StatusColumns'
import PriorityDistribution from '@/components/build-war-room/roadmap/PriorityDistribution'
import RoadmapTimeline from '@/components/build-war-room/roadmap/RoadmapTimeline'

export const dynamic = 'force-dynamic'

type Proj = {
  id: string; name: string; status_norm: string; priority_norm: string | null
  progress: number | null; start_at: string | null; end_at: string | null; end_source: string; program: string
}

export default async function RoadmapCommandCenterPage() {
  const supabase = await createClient()
  const slug = await getActiveCompanyId()

  const [health, minutes, cert, completion, projects, blockers, milestones] = await Promise.all([
    supabase.from('v_ceo_system_health').select('*'),
    supabase.from('v_ceo_minutes_daily').select('*').maybeSingle(),
    supabase.from('v_media_factory_certification').select('*').maybeSingle(),
    supabase.from('v_build_entity_completion').select('*').eq('entity_slug', slug).maybeSingle(),
    supabase.from('v_build_roadmap_projects').select('id,name,status_norm,priority_norm,progress,start_at,end_at,end_source,program').eq('entity_slug', slug),
    supabase.from('v_build_blockers').select('title').eq('entity_slug', slug),
    supabase.from('v_build_upcoming_milestones').select('naam,target_date,status'),
  ])

  const proj = (projects.data ?? []) as Proj[]
  const statusCounts = {
    done: proj.filter((p) => p.status_norm === 'done').length,
    in_progress: proj.filter((p) => p.status_norm === 'in_progress').length,
    queued: proj.filter((p) => p.status_norm === 'queued').length,
    blocked: proj.filter((p) => p.status_norm === 'blocked').length,
  }
  const dist = {
    P0: proj.filter((p) => p.priority_norm === 'P0').length,
    P1: proj.filter((p) => p.priority_norm === 'P1').length,
    P2: proj.filter((p) => p.priority_norm === 'P2').length,
    P3: proj.filter((p) => p.priority_norm === 'P3').length,
    none: proj.filter((p) => !p.priority_norm).length,
  }
  const comp = completion.data as { completion_pct?: number; done?: number; total?: number } | null

  return (
    <div className="space-y-3">
      {/* CEO-OS kern: minuten + certificering (holding-breed) */}
      <div className="grid gap-3 lg:grid-cols-2">
        <CeoMinutesGauge data={minutes.data as never} />
        <CertificationCard data={cert.data as never} />
      </div>

      {/* operationele gezondheid (holding-breed) */}
      <SystemHealthBoard data={(health.data ?? []) as never} />

      {/* strategie (per actieve entiteit) */}
      <ExecutiveStatusBar
        completionPct={comp?.completion_pct ?? 0}
        done={comp?.done ?? statusCounts.done}
        total={comp?.total ?? proj.length}
        active={statusCounts.in_progress}
        queued={statusCounts.queued}
        blocked={statusCounts.blocked}
        openBlockers={(blockers.data ?? []).length}
        upcomingMilestones={(milestones.data ?? []).length}
      />

      {/* ② Roadmap Timeline (hero) */}
      <RoadmapTimeline projects={proj as never} milestones={(milestones.data ?? []) as never} />

      <div className="grid gap-3 lg:grid-cols-2">
        <StatusColumns counts={statusCounts} />
        <PriorityDistribution dist={dist} />
      </div>

      <p className="text-[10px] text-white/30">
        Roadmap Command Center (F2) — System Health + CEO Minutes + Certification holding-breed; status/prioriteit per
        actieve entiteit. Timeline/agenda/milestones/activiteit volgen in F3/F4.
      </p>
    </div>
  )
}
