import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import {
  Crosshair, ChevronLeft, Database, Plug, AlertTriangle,
  CheckCircle2, Zap, Circle, Clock, Telescope,
} from 'lucide-react'
import { WAITING_LABEL } from '@/lib/aquier/liveOrWaiting'
import ContinueInClaude from '@/components/build/ContinueInClaude'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type Section = {
  id: string
  section_key: string
  name: string
  position: number
  status: string
  error_count: number
  live_workers: number
  active_tasks: number
  pending_tasks: number
  failed_tasks: number
  success_ratio: number
  live_data_sources: Array<{ name: string; objects?: number; active?: boolean }> | null
  api_status: Record<string, unknown> | null
  growth_metrics: Record<string, number> | null
  updated_at: string
}

type Connector = {
  id: string
  section_key: string
  name: string
  category: string
  status: string
  requires: string[] | null
  last_run_at: string | null
  objects_count: number
  notes: string | null
}

type Project = {
  id: string
  code: string | null
  name: string
  status: string
  progress_pct: number
  owner_agent: string | null
  parent_project_id: string | null
}

const SECTION_STATUS: Record<string, { label: string; color: string; Icon: typeof Circle }> = {
  live:               { label: 'Live',    color: 'text-emerald-400', Icon: CheckCircle2 },
  building:           { label: 'Bouwen',  color: 'text-blue-400',    Icon: Zap },
  pending:            { label: 'Wachtrij', color: 'text-white/40',   Icon: Circle },
  blocked:            { label: 'Geblokt', color: 'text-orange-400',  Icon: AlertTriangle },
  waiting_for_source: { label: 'Wacht op bron', color: 'text-amber-400', Icon: Clock },
}

const CONNECTOR_STATUS: Record<string, { label: string; color: string }> = {
  live:                    { label: 'Live',            color: 'bg-emerald-500/15 text-emerald-400' },
  waiting_for_credentials: { label: WAITING_LABEL,     color: 'bg-amber-500/15 text-amber-300' },
  error:                   { label: 'Error',           color: 'bg-red-500/15 text-red-400' },
  disabled:                { label: 'Uit',             color: 'bg-white/10 text-white/40' },
}

function fmtMetricKey(k: string) {
  return k.replace(/_/g, ' ')
}

export default async function UsaDominationPage() {
  const supabase = await createClient()

  const { data: parent } = await supabase
    .from('aquier_projects')
    .select('id,code,name,status,progress_pct,owner_agent,parent_project_id')
    .eq('code', 'AQUIER_USA_DOMINATION_ENGINE')
    .maybeSingle()

  const project = (parent ?? null) as Project | null

  const [{ data: sectionRows }, { data: connectorRows }, { data: children }] = await Promise.all([
    project
      ? supabase.from('aquier_project_sections').select('*').eq('project_id', project.id).order('position', { ascending: true })
      : Promise.resolve({ data: [] }),
    supabase.from('aquier_data_connectors').select('*').order('status', { ascending: true }).order('name', { ascending: true }),
    project
      ? supabase.from('aquier_projects').select('id,code,name,status,progress_pct,owner_agent,parent_project_id').eq('parent_project_id', project.id)
      : Promise.resolve({ data: [] }),
  ])

  const sections = (sectionRows ?? []) as Section[]
  const connectors = (connectorRows ?? []) as Connector[]
  const childProjects = (children ?? []) as Project[]

  // Competitor intelligence — laatste snapshot per platform (vastgoed_core schema)
  type Platform = { id: string; slug: string; name: string }
  type Snapshot = {
    platform_id: string
    captured_at: string
    http_status: number | null
    ctas: unknown[] | null
    acquisition_focus: Record<string, unknown> | null
    meta: { title?: string } | null
  }
  const [{ data: platformRows }, { data: snapshotRows }] = await Promise.all([
    supabase.schema('vastgoed_core').from('competitor_platforms').select('id,slug,name'),
    supabase.schema('vastgoed_core').from('competitor_seo_snapshots')
      .select('platform_id,captured_at,http_status,ctas,acquisition_focus,meta')
      .order('captured_at', { ascending: false }).limit(60),
  ])
  const platforms = (platformRows ?? []) as Platform[]
  const latestByPlatform = new Map<string, Snapshot>()
  for (const s of (snapshotRows ?? []) as Snapshot[]) {
    if (!latestByPlatform.has(s.platform_id)) latestByPlatform.set(s.platform_id, s)
  }
  const competitorRows = platforms
    .map(p => ({ platform: p, snap: latestByPlatform.get(p.id) ?? null }))
    .sort((a, b) => (b.snap?.ctas?.length ?? 0) - (a.snap?.ctas?.length ?? 0))

  const connectorsBySection = connectors.reduce<Record<string, Connector[]>>((acc, c) => {
    (acc[c.section_key] ??= []).push(c)
    return acc
  }, {})

  const liveConnectors = connectors.filter(c => c.status === 'live').length
  const waitingConnectors = connectors.filter(c => c.status === 'waiting_for_credentials').length
  const liveSections = sections.filter(s => s.status === 'live').length

  if (!project) {
    return (
      <div className="py-12 text-center bg-white/[0.02] border border-dashed border-white/10 rounded-xl">
        <Crosshair size={28} className="text-white/15 mx-auto mb-3" />
        <p className="text-[12px] text-white/30">USA Domination Engine niet geregistreerd</p>
        <p className="text-[10px] text-white/20 mt-1">Run migration 086_aquier_usa_domination.sql</p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard/aquier" className="text-white/40 hover:text-white/70">
          <ChevronLeft size={16} />
        </Link>
        <div className="w-9 h-9 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
          <Crosshair size={16} className="text-red-400" />
        </div>
        <div className="flex-1">
          <h1 className="text-base font-semibold text-white">{project.name}</h1>
          <p className="text-xs text-white/50">
            AI Acquisition Operating System · {liveSections}/{sections.length} secties live ·
            owner {project.owner_agent ?? '—'}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xl font-bold text-red-400 leading-none">{project.progress_pct}%</p>
          <p className="text-[10px] text-white/40 mt-1">voortgang</p>
        </div>
      </div>

      {/* No-mock banner */}
      <div className="p-3 bg-amber-500/8 border border-amber-500/20 rounded-xl flex items-center gap-3">
        <Database size={14} className="text-amber-400 flex-shrink-0" />
        <p className="text-[11.5px] text-amber-300/90">
          No-mock policy actief — {liveConnectors} bronnen live, {waitingConnectors}× <span className="font-mono">{WAITING_LABEL}</span> (wachten op API-keys/proxy).
        </p>
      </div>

      {/* Child projects */}
      {childProjects.length > 0 && (
        <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-3.5">
          <h2 className="text-[12px] font-semibold text-white mb-2">Sub-projecten</h2>
          <div className="space-y-1.5">
            {childProjects.map(c => (
              <div key={c.id} className="flex items-center gap-3 p-2 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                <span className="text-[10px] font-mono text-white/35 flex-shrink-0">{c.code}</span>
                <span className="text-[12px] text-white/75 flex-1 truncate">{c.name}</span>
                <div className="w-16 h-1 rounded-full bg-white/[0.06] overflow-hidden">
                  <div className="h-full bg-emerald-400/70" style={{ width: `${c.progress_pct}%` }} />
                </div>
                <span className="text-[10px] text-white/40 w-8 text-right">{c.progress_pct}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 11 sections */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
        {sections.map(s => {
          const st = SECTION_STATUS[s.status] ?? SECTION_STATUS.pending
          const StIcon = st.Icon
          const conns = connectorsBySection[s.section_key] ?? []
          const growth = s.growth_metrics ?? {}
          const growthEntries = Object.entries(growth)
          return (
            <div key={s.id} className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-3.5">
              <div className="flex items-center gap-2 mb-2">
                <StIcon size={13} className={st.color} />
                <span className="text-[13px] text-white/85 font-medium flex-1">{s.name}</span>
                <span className={`text-[9px] font-semibold ${st.color}`}>{st.label}</span>
              </div>

              {/* Worker/task line */}
              <div className="flex items-center gap-3 text-[10px] text-white/45 mb-2">
                <span>workers {s.live_workers}</span>
                <span>actief {s.active_tasks}</span>
                <span>wachtrij {s.pending_tasks}</span>
                <span className={s.failed_tasks > 0 ? 'text-orange-400' : ''}>fout {s.failed_tasks}</span>
                <span>{s.success_ratio}% ok</span>
              </div>

              {/* Growth metrics (echte live cijfers of waiting) */}
              {growthEntries.length > 0 ? (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {growthEntries.map(([k, v]) => (
                    <span key={k} className="text-[9.5px] px-1.5 py-0.5 rounded bg-white/[0.05] text-white/55">
                      {fmtMetricKey(k)}: <span className={v > 0 ? 'text-white/85 font-medium' : 'text-amber-300/80'}>{v > 0 ? v : WAITING_LABEL}</span>
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-[10px] text-amber-300/70 mb-2 font-mono">{WAITING_LABEL}</p>
              )}

              {/* Live data sources (scrapers) */}
              {Array.isArray(s.live_data_sources) && s.live_data_sources.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-2">
                  {s.live_data_sources.map(src => (
                    <span key={src.name} className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-300/80">
                      {src.name}{typeof src.objects === 'number' ? ` ${src.objects}` : ''}
                    </span>
                  ))}
                </div>
              )}

              {/* Connectors for this section */}
              {conns.length > 0 && (
                <div className="mt-2 pt-2 border-t border-white/[0.05] space-y-1">
                  {conns.map(c => {
                    const cs = CONNECTOR_STATUS[c.status] ?? CONNECTOR_STATUS.disabled
                    return (
                      <div key={c.id} className="flex items-center gap-2">
                        <Plug size={9} className="text-white/30 flex-shrink-0" />
                        <span className="text-[10px] text-white/60 flex-1 truncate">{c.name}</span>
                        {c.objects_count > 0 && <span className="text-[9px] text-white/40">{c.objects_count}</span>}
                        <span className={`text-[8.5px] font-semibold px-1.5 py-0.5 rounded ${cs.color}`}>{cs.label}</span>
                      </div>
                    )
                  })}
                </div>
              )}

              <div className="mt-2.5 pt-2.5 border-t border-white/[0.05]">
                <ContinueInClaude
                  companyColor="#f87171"
                  context={{
                    tracker: 'Aquier USA Domination',
                    itemType: 'sectie',
                    name: s.name,
                    statusLabel: st.label,
                    company: 'Aquier',
                    route: '/dashboard/aquier/usa-domination',
                    extra: [
                      { label: 'Sectie-key', value: s.section_key },
                      { label: 'Workers', value: String(s.live_workers) },
                      { label: 'Actieve taken', value: String(s.active_tasks) },
                      { label: 'Wachtrij', value: String(s.pending_tasks) },
                      { label: 'Mislukte taken', value: String(s.failed_tasks) },
                      { label: 'Succes ratio', value: `${s.success_ratio}%` },
                    ],
                  }}
                />
              </div>
            </div>
          )
        })}
      </div>

      {/* Competitor Intelligence — echte snapshots (Spyglass / SPYGLASS-CI) */}
      <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Telescope size={14} className="text-violet-400" />
          <h2 className="text-[13px] font-semibold text-white flex-1">Competitor Intelligence</h2>
          <span className="text-[10px] text-white/40">
            {latestByPlatform.size}/{platforms.length} geanalyseerd
          </span>
        </div>
        {competitorRows.length === 0 ? (
          <p className="text-[11px] text-amber-300/70 py-3 text-center font-mono">{WAITING_LABEL}</p>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-1.5">
            {competitorRows.map(({ platform, snap }) => {
              const focus = snap?.acquisition_focus ? Object.keys(snap.acquisition_focus) : []
              const blocked = snap?.http_status != null && snap.http_status >= 400
              return (
                <div key={platform.id} className="flex items-start gap-2.5 p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                  <span className="text-[10px] font-mono text-white/35 w-20 flex-shrink-0 pt-0.5">{platform.slug}</span>
                  <div className="flex-1 min-w-0">
                    {snap ? (
                      <>
                        <p className="text-[11.5px] text-white/75 truncate">{snap.meta?.title || platform.name}</p>
                        <div className="flex flex-wrap items-center gap-1 mt-1">
                          {blocked && <span className="text-[8.5px] px-1.5 py-0.5 rounded bg-orange-500/15 text-orange-400">HTTP {snap.http_status}</span>}
                          <span className="text-[8.5px] px-1.5 py-0.5 rounded bg-white/[0.05] text-white/45">{snap.ctas?.length ?? 0} CTA</span>
                          {focus.map(f => (
                            <span key={f} className="text-[8.5px] px-1.5 py-0.5 rounded bg-violet-500/10 text-violet-300/80">{f.replace(/_/g, ' ')}</span>
                          ))}
                        </div>
                      </>
                    ) : (
                      <p className="text-[10px] text-amber-300/70 font-mono pt-0.5">{WAITING_LABEL}</p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
