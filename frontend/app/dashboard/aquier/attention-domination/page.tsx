import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import {
  TrendingUp, ChevronLeft, Database, Plug, AlertTriangle,
  CheckCircle2, Zap, Circle, Clock,
} from 'lucide-react'
import { WAITING_LABEL } from '@/lib/aquier/liveOrWaiting'
import ContinueInClaude from '@/components/build/ContinueInClaude'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const PROJECT_CODE = 'AQUIER_ATTENTION_DOMINATION_ENGINE'

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

// Command-groepen op section_key-prefix (geen metadata-kolom op aquier_project_sections)
const GROUPS: Array<{ key: string; title: string; hint: string }> = [
  { key: 'g1', title: 'Command 1 · Attention & Growth Intelligence Engine', hint: 'Dagelijkse machine: scrape → score → genereer → publiceer → meet → optimaliseer' },
  { key: 'g2', title: 'Command 2 · Hero Product Portfolio', hint: 'Ssemble-model: hero-producten + splits (bestaande engines) + conversiefunnel' },
  { key: 'g3', title: 'Executie-tracks', hint: '30-dagen agressief + viral push, parallel (90d-scope gecomprimeerd)' },
]

function fmtMetricKey(k: string) {
  return k.replace(/_/g, ' ')
}

function SectionCard({ s, conns }: { s: Section; conns: Connector[] }) {
  const st = SECTION_STATUS[s.status] ?? SECTION_STATUS.pending
  const StIcon = st.Icon
  const growth = s.growth_metrics ?? {}
  const growthEntries = Object.entries(growth)
  return (
    <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-3.5">
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

      {/* Growth metrics (echte cijfers of waiting) */}
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

      {/* Live data sources */}
      {Array.isArray(s.live_data_sources) && s.live_data_sources.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {s.live_data_sources.map(src => (
            <span key={src.name} className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-300/80">
              {src.name}{typeof src.objects === 'number' ? ` ${src.objects}` : ''}
            </span>
          ))}
        </div>
      )}

      {/* Connectors voor deze sectie */}
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
          companyColor="#a78bfa"
          context={{
            tracker: 'Aquier Attention Domination',
            itemType: 'sectie',
            name: s.name,
            statusLabel: st.label,
            company: 'Aquier',
            route: '/dashboard/aquier/attention-domination',
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
}

export default async function AttentionDominationPage() {
  const supabase = await createClient()

  const { data: parent } = await supabase
    .from('aquier_projects')
    .select('id,code,name,status,progress_pct,owner_agent,parent_project_id')
    .eq('code', PROJECT_CODE)
    .maybeSingle()

  const project = (parent ?? null) as Project | null

  const [{ data: sectionRows }, { data: connectorRows }] = await Promise.all([
    project
      ? supabase.from('aquier_project_sections').select('*').eq('project_id', project.id).order('position', { ascending: true })
      : Promise.resolve({ data: [] }),
    supabase.from('aquier_data_connectors').select('*').order('status', { ascending: true }).order('name', { ascending: true }),
  ])

  const sections = (sectionRows ?? []) as Section[]
  const allConnectors = (connectorRows ?? []) as Connector[]

  // Alleen connectors die bij dit project horen (section_keys zijn uniek per project)
  const ourKeys = new Set(sections.map(s => s.section_key))
  const connectors = allConnectors.filter(c => ourKeys.has(c.section_key))

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
        <TrendingUp size={28} className="text-white/15 mx-auto mb-3" />
        <p className="text-[12px] text-white/30">Attention Domination Engine niet geregistreerd</p>
        <p className="text-[10px] text-white/20 mt-1">Seed project {PROJECT_CODE} in aquier_projects + aquier_project_sections</p>
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
        <div className="w-9 h-9 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
          <TrendingUp size={16} className="text-violet-400" />
        </div>
        <div className="flex-1">
          <h1 className="text-base font-semibold text-white">{project.name}</h1>
          <p className="text-xs text-white/50">
            Attention & Growth Intelligence · NL-first · {liveSections}/{sections.length} secties live ·
            owner {project.owner_agent ?? '—'}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xl font-bold text-violet-400 leading-none">{project.progress_pct}%</p>
          <p className="text-[10px] text-white/40 mt-1">voortgang</p>
        </div>
      </div>

      {/* No-mock banner */}
      <div className="p-3 bg-amber-500/8 border border-amber-500/20 rounded-xl flex items-center gap-3">
        <Database size={14} className="text-amber-400 flex-shrink-0" />
        <p className="text-[11.5px] text-amber-300/90">
          No-mock policy actief — {liveConnectors} bronnen live, {waitingConnectors}× <span className="font-mono">{WAITING_LABEL}</span> (wachten op API-keys/route). Subagent <span className="font-mono">attention-engine-daily</span> gated tot executie-route bestaat.
        </p>
      </div>

      {/* Groepen per command */}
      {GROUPS.map(group => {
        const groupSections = sections.filter(s => s.section_key.startsWith(`${group.key}_`))
        if (groupSections.length === 0) return null
        return (
          <div key={group.key} className="space-y-2.5">
            <div className="flex items-baseline gap-2 pt-1">
              <h2 className="text-[13px] font-semibold text-white">{group.title}</h2>
              <span className="text-[10px] text-white/35">{groupSections.length} secties</span>
            </div>
            <p className="text-[11px] text-white/45 -mt-1">{group.hint}</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {groupSections.map(s => (
                <SectionCard key={s.id} s={s} conns={connectorsBySection[s.section_key] ?? []} />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
