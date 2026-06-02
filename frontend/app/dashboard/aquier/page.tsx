import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import {
  Globe, Briefcase, GanttChart, Calendar, UserCog, Gauge, ThumbsUp,
  ChevronRight, Target, TrendingUp, AlertTriangle, CheckCircle2,
  Clock, Sparkles, Crosshair, ShieldCheck,
} from 'lucide-react'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type Project = {
  id: string
  code: string | null
  name: string
  status: string
  priority: string
  progress_pct: number
  owner_agent: string | null
  due_at: string | null
  module_ref: string | null
}

type Brief = {
  id: string
  brief_type: string
  generated_at: string
  for_date: string
  headline: string
  summary: string | null
}

type Approval = {
  id: string
  requested_at: string
  category: string
  title: string
  status: string
}

type MonitorEvent = {
  id: string
  event_at: string
  severity: string
  category: string
  title: string
}

type AgendaItem = {
  id: string
  title: string
  type: string
  starts_at: string
}

type AiState = {
  agent_name: string
  status: string
  next_brief_at: string | null
  current_sprint_id: string | null
}

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })
}

function fmtDateTime(s: string) {
  return new Date(s).toLocaleString('nl-NL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

const STATUS_BADGE: Record<string, { label: string; color: string }> = {
  planned:     { label: 'Gepland',    color: 'bg-white/10 text-white/60' },
  in_progress: { label: 'Loopt',      color: 'bg-blue-500/15 text-blue-400' },
  blocked:     { label: 'Geblokt',    color: 'bg-orange-500/15 text-orange-400' },
  completed:   { label: 'Klaar',      color: 'bg-emerald-500/15 text-emerald-400' },
  on_hold:     { label: 'On hold',    color: 'bg-amber-500/15 text-amber-400' },
  cancelled:   { label: 'Gestopt',    color: 'bg-red-500/15 text-red-400' },
}

const PRIORITY_COLOR: Record<string, string> = {
  critical: 'text-red-400',
  high:     'text-orange-400',
  medium:   'text-yellow-400',
  low:      'text-white/40',
}

const SEVERITY_COLOR: Record<string, string> = {
  info:     'text-blue-400',
  success:  'text-emerald-400',
  warning:  'text-yellow-400',
  error:    'text-orange-400',
  critical: 'text-red-400',
}

export default async function AquierHubPage() {
  const supabase = await createClient()

  const [
    { data: projects },
    { data: briefs },
    { data: approvals },
    { data: monitorEvents },
    { data: upcoming },
    { data: aiState },
  ] = await Promise.all([
    supabase
      .from('aquier_projects')
      .select('id,code,name,status,priority,progress_pct,owner_agent,due_at,module_ref')
      .order('priority', { ascending: false })
      .order('progress_pct', { ascending: false }),
    supabase
      .from('aquier_ai_lead_briefs')
      .select('id,brief_type,generated_at,for_date,headline,summary')
      .order('generated_at', { ascending: false })
      .limit(1),
    supabase
      .from('aquier_approvals')
      .select('id,requested_at,category,title,status')
      .eq('status', 'pending')
      .order('requested_at', { ascending: false })
      .limit(5),
    supabase
      .from('aquier_monitor_events')
      .select('id,event_at,severity,category,title')
      .order('event_at', { ascending: false })
      .limit(6),
    supabase
      .from('aquier_agenda')
      .select('id,title,type,starts_at')
      .gte('starts_at', new Date().toISOString())
      .eq('status', 'scheduled')
      .order('starts_at', { ascending: true })
      .limit(5),
    supabase
      .from('aquier_ai_lead_state')
      .select('agent_name,status,next_brief_at,current_sprint_id')
      .eq('id', 'singleton')
      .maybeSingle(),
  ])

  const projectList = (projects ?? []) as Project[]
  const latestBrief = (briefs?.[0] ?? null) as Brief | null
  const approvalList = (approvals ?? []) as Approval[]
  const eventList = (monitorEvents ?? []) as MonitorEvent[]
  const agendaList = (upcoming ?? []) as AgendaItem[]
  const ai = (aiState ?? null) as AiState | null

  const total = projectList.length
  const completed = projectList.filter(p => p.status === 'completed').length
  const inProgress = projectList.filter(p => p.status === 'in_progress').length
  const blocked = projectList.filter(p => p.status === 'blocked').length
  const avgProgress = total > 0 ? Math.round(projectList.reduce((s, p) => s + p.progress_pct, 0) / total) : 0

  const KPI_CARDS = [
    { label: 'Projecten', value: String(total), icon: Briefcase, color: 'text-cyan-400', bg: 'bg-cyan-500/10 border-cyan-500/20' },
    { label: 'Voltooid', value: `${completed}/${total}`, icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
    { label: 'Loopt', value: String(inProgress), icon: TrendingUp, color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
    { label: 'Voortgang', value: `${avgProgress}%`, icon: Target, color: 'text-violet-400', bg: 'bg-violet-500/10 border-violet-500/20' },
  ]

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
          <Globe size={16} className="text-cyan-400" />
        </div>
        <div className="flex-1">
          <h1 className="text-base font-semibold text-white">Aquier Command Center</h1>
          <p className="text-xs text-white/50">AI-gedreven vastgoed intelligence — internationale schaalstrategie</p>
        </div>
        <div className="flex items-center gap-2 text-[11px]">
          <div className={`w-2 h-2 rounded-full ${ai?.status === 'ready' ? 'bg-emerald-400' : ai?.status === 'running' ? 'bg-blue-400 animate-pulse' : 'bg-orange-400'}`} />
          <span className="text-white/60">{ai?.agent_name ?? 'CHRONOS-AQ'}</span>
          <span className="text-white/30">·</span>
          <span className="text-white/40">{ai?.status ?? 'pending'}</span>
        </div>
      </div>

      {/* Blocked alert */}
      {blocked > 0 && (
        <div className="p-3 bg-orange-500/8 border border-orange-500/20 rounded-xl flex items-center gap-3">
          <AlertTriangle size={14} className="text-orange-400 flex-shrink-0" />
          <p className="text-[12px] text-orange-400">{blocked}× project geblokt — vereist actie</p>
        </div>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {KPI_CARDS.map(card => {
          const Icon = card.icon
          return (
            <div key={card.label} className="bg-white/[0.06] border border-white/5 rounded-xl p-4 flex flex-col gap-3">
              <div className={`w-8 h-8 rounded-lg border flex items-center justify-center ${card.bg}`}>
                <Icon size={15} className={card.color} />
              </div>
              <div>
                <p className={`text-xl font-bold ${card.color} leading-none`}>{card.value}</p>
                <p className="text-[11px] text-white/50 mt-1">{card.label}</p>
              </div>
            </div>
          )
        })}
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 lg:grid-cols-7 gap-2">
        {[
          { href: '/dashboard/aquier/usa-domination', icon: Crosshair, label: 'USA Domination', color: 'text-red-400' },
          { href: '/dashboard/aquier/attention-domination', icon: TrendingUp, label: 'Attention Engine', color: 'text-violet-400' },
          { href: '/dashboard/aquier/projecten', icon: Briefcase, label: 'Projecten', color: 'text-cyan-400' },
          { href: '/dashboard/aquier/planning', icon: GanttChart, label: 'Planning', color: 'text-violet-400' },
          { href: '/dashboard/aquier/agenda', icon: Calendar, label: 'Agenda', color: 'text-indigo-400' },
          { href: '/dashboard/aquier/ai-lead', icon: UserCog, label: 'AI Lead', color: 'text-fuchsia-400' },
          { href: '/dashboard/aquier/monitor', icon: Gauge, label: 'Monitoring', color: 'text-blue-400' },
          { href: '/dashboard/aquier/audit', icon: ShieldCheck, label: 'Audit', color: 'text-indigo-400' },
          { href: '/dashboard/aquier/approvals', icon: ThumbsUp, label: 'Approvals', color: 'text-emerald-400', badge: approvalList.length },
        ].map(action => {
          const Icon = action.icon
          return (
            <Link
              key={action.href}
              href={action.href}
              className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-3 flex items-center gap-2 hover:bg-white/[0.07] transition-colors relative"
            >
              <Icon size={14} className={action.color} />
              <span className="text-[11.5px] text-white/70 font-medium truncate flex-1">{action.label}</span>
              {action.badge ? (
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-300">{action.badge}</span>
              ) : null}
              <ChevronRight size={12} className="text-white/25 flex-shrink-0" />
            </Link>
          )
        })}
      </div>

      {/* Latest brief */}
      {latestBrief && (
        <div className="bg-gradient-to-br from-fuchsia-500/5 to-cyan-500/5 border border-fuchsia-500/15 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-fuchsia-500/15 border border-fuchsia-500/25 flex items-center justify-center flex-shrink-0">
              <Sparkles size={14} className="text-fuchsia-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[9px] font-bold text-fuchsia-400 uppercase tracking-wider">{latestBrief.brief_type} brief</span>
                <span className="text-[9px] text-white/30">{fmtDateTime(latestBrief.generated_at)}</span>
              </div>
              <p className="text-[13px] text-white/90 font-medium">{latestBrief.headline}</p>
              {latestBrief.summary && <p className="text-[11.5px] text-white/55 mt-1.5 leading-relaxed">{latestBrief.summary}</p>}
              <Link href="/dashboard/aquier/ai-lead" className="text-[10.5px] text-fuchsia-400 hover:text-fuchsia-300 mt-2 inline-block">
                Volledige brief →
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Two-column: Projects + Right sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Projects (2 cols) */}
        <div className="lg:col-span-2 bg-white/[0.04] border border-white/[0.06] rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[13px] font-semibold text-white">Project Status (25 modules)</h2>
            <Link href="/dashboard/aquier/projecten" className="text-[11px] text-cyan-400 hover:text-cyan-300">Alle →</Link>
          </div>

          <div className="space-y-1.5">
            {projectList.slice(0, 12).map(p => {
              const badge = STATUS_BADGE[p.status] ?? STATUS_BADGE.planned
              return (
                <Link
                  key={p.id}
                  href={`/dashboard/aquier/projecten#${p.code ?? p.id}`}
                  className="flex items-center gap-3 p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.05] transition-colors"
                >
                  <span className={`text-[9px] font-bold ${PRIORITY_COLOR[p.priority] ?? PRIORITY_COLOR.medium} w-3 flex-shrink-0`}>
                    {p.priority === 'critical' ? '◉' : p.priority === 'high' ? '●' : '·'}
                  </span>
                  <span className="text-[10px] font-mono text-white/35 w-14 flex-shrink-0">{p.code}</span>
                  <span className="text-[12px] text-white/75 flex-1 truncate">{p.name}</span>
                  <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded ${badge.color}`}>{badge.label}</span>
                  <div className="w-16 h-1 rounded-full bg-white/[0.06] overflow-hidden">
                    <div className="h-full bg-cyan-400/70" style={{ width: `${p.progress_pct}%` }} />
                  </div>
                  <span className="text-[10px] text-white/40 w-8 text-right">{p.progress_pct}%</span>
                </Link>
              )
            })}
          </div>
        </div>

        {/* Right sidebar: Agenda + Monitoring + Approvals (1 col) */}
        <div className="space-y-4">

          {/* Agenda */}
          <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-[13px] font-semibold text-white">Komende Agenda</h2>
              <Link href="/dashboard/aquier/agenda" className="text-[11px] text-indigo-400 hover:text-indigo-300">Alle →</Link>
            </div>
            {agendaList.length === 0 ? (
              <p className="text-[11px] text-white/30 py-3 text-center">Geen geplande items</p>
            ) : (
              <div className="space-y-2">
                {agendaList.map(a => (
                  <div key={a.id} className="flex items-start gap-2 p-2 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                    <Clock size={11} className="text-indigo-400 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[11.5px] text-white/75 truncate">{a.title}</p>
                      <p className="text-[10px] text-white/35">{fmtDateTime(a.starts_at)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Monitoring */}
          <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-[13px] font-semibold text-white">Recente Signalen</h2>
              <Link href="/dashboard/aquier/monitor" className="text-[11px] text-blue-400 hover:text-blue-300">Alle →</Link>
            </div>
            {eventList.length === 0 ? (
              <p className="text-[11px] text-white/30 py-3 text-center">Nog geen events</p>
            ) : (
              <div className="space-y-1.5">
                {eventList.map(ev => (
                  <div key={ev.id} className="flex items-start gap-2 p-2 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                    <span className={`text-[8px] font-bold uppercase ${SEVERITY_COLOR[ev.severity] ?? 'text-white/40'} w-12 flex-shrink-0 pt-0.5`}>
                      {ev.severity}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] text-white/70 truncate">{ev.title}</p>
                      <p className="text-[9px] text-white/30">{fmtDate(ev.event_at)} · {ev.category}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Approvals */}
          {approvalList.length > 0 && (
            <div className="bg-emerald-500/5 border border-emerald-500/15 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-[13px] font-semibold text-white">Open Approvals</h2>
                <Link href="/dashboard/aquier/approvals" className="text-[11px] text-emerald-400 hover:text-emerald-300">Bekijk →</Link>
              </div>
              <div className="space-y-1.5">
                {approvalList.slice(0, 4).map(a => (
                  <div key={a.id} className="p-2 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[8px] font-bold uppercase text-emerald-400">{a.category}</span>
                      <span className="text-[9px] text-white/30">{fmtDate(a.requested_at)}</span>
                    </div>
                    <p className="text-[11px] text-white/75 truncate">{a.title}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
