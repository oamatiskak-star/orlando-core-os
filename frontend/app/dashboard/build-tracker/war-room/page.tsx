import { createClient } from '@/lib/supabase/server'
import { getActiveCompanyId } from '@/lib/active-company-server'
import SystemHealthBoard from '@/components/build-war-room/roadmap/health/SystemHealthBoard'
import CeoMinutesGauge from '@/components/build-war-room/roadmap/CeoMinutesGauge'
import CertificationCard from '@/components/build-war-room/roadmap/CertificationCard'
import ExecutiveStatusBar from '@/components/build-war-room/roadmap/ExecutiveStatusBar'
import StatusColumns from '@/components/build-war-room/roadmap/StatusColumns'
import PriorityDistribution from '@/components/build-war-room/roadmap/PriorityDistribution'
import RoadmapTimeline from '@/components/build-war-room/roadmap/RoadmapTimeline'
import TodayAgenda from '@/components/build-war-room/roadmap/TodayAgenda'
import UpcomingMilestones from '@/components/build-war-room/roadmap/UpcomingMilestones'
import OpenBuildItems from '@/components/build-war-room/roadmap/OpenBuildItems'
import ActivityFeed from '@/components/build-war-room/roadmap/ActivityFeed'
import DependencyOverview from '@/components/build-war-room/roadmap/DependencyOverview'
import IncidentLifecycle from '@/components/build-war-room/roadmap/IncidentLifecycle'
import RevenueLayer from '@/components/build-war-room/roadmap/RevenueLayer'

export const dynamic = 'force-dynamic'

type Proj = {
  id: string; name: string; status_norm: string; priority_norm: string | null
  progress: number | null; start_at: string | null; end_at: string | null; end_source: string; program: string
}

export default async function RoadmapCommandCenterPage() {
  const supabase = await createClient()
  const slug = await getActiveCompanyId()

  const [health, minutes, cert, completion, projects, blockers, milestones, agenda, items, activity, incidents, revPosition, revByEntity] = await Promise.all([
    supabase.from('v_ceo_system_health').select('*'),
    supabase.from('v_ceo_minutes_daily').select('*').maybeSingle(),
    supabase.from('v_media_factory_certification').select('*').maybeSingle(),
    supabase.from('v_build_entity_completion').select('*').eq('entity_slug', slug).maybeSingle(),
    supabase.from('v_build_roadmap_projects').select('id,name,status_norm,priority_norm,progress,start_at,end_at,end_source,program').eq('entity_slug', slug),
    supabase.from('v_build_blockers').select('title,reason,entity_slug,code,waiting_on').eq('entity_slug', slug),
    supabase.from('v_build_upcoming_milestones').select('id,milestone_nr,naam,status,progress_pct,value_stage,target_date'),
    supabase.from('v_build_today_agenda').select('*').eq('entity_slug', slug),
    supabase.from('v_build_war_room_nodes').select('node_id,label,status,payload').eq('node_type', 'build_item').eq('entity_slug', slug),
    supabase.from('v_build_activity_feed').select('*').eq('entity_slug', slug).order('ts', { ascending: false }).limit(30),
    supabase.from('infra_watchdog_incidents').select('service_name,service_type,failure_kind,failure_summary,proposed_actions,status,opened_at,resolved_at,incident_kind').order('opened_at', { ascending: false }).limit(20),
    supabase.from('v_ceo_revenue_position').select('*').maybeSingle(),
    supabase.from('v_ceo_revenue_by_entity').select('*'),
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

  const incRows = (incidents.data ?? []) as Array<{ status: string | null; resolved_at: string | null }>
  const openInc = incRows.filter((i) => !(i.status === 'resolved' || i.resolved_at)).length
  const resolvedInc = incRows.length - openInc
  const openItems = ((items.data ?? []) as Array<{ status: string | null }>)
    .filter((i) => !['done', 'merged', 'closed'].includes((i.status ?? '').toLowerCase()))

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

      {/* F4 — dagsturing */}
      <div className="grid gap-3 lg:grid-cols-2">
        <TodayAgenda items={(agenda.data ?? []) as never} />
        <UpcomingMilestones milestones={(milestones.data ?? []) as never} />
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <OpenBuildItems items={openItems as never} />
        <ActivityFeed initial={(activity.data ?? []) as never} />
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <DependencyOverview blockers={(blockers.data ?? []) as never} />
        <IncidentLifecycle incidents={(incidents.data ?? []) as never} openCount={openInc} resolvedCount={resolvedInc} />
      </div>

      {/* F6 — omzet-laag */}
      <RevenueLayer position={revPosition.data as never} byEntity={(revByEntity.data ?? []) as never} />

      <p className="text-[10px] text-white/30">
        Roadmap Command Center — operatie + autonomie holding-breed; strategie/dagsturing per actieve entiteit.
        De volledige node-graaf staat onder de tab "Knowledge Graph".
      </p>
    </div>
  )
}
