import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Mail, Bot, GitMerge, Filter, Scale, Inbox, Activity, AlertTriangle, CheckCircle, Clock, Shield } from 'lucide-react'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function MailDashboardPage() {
  const supabase = await createClient()

  const [
    { data: agents },
    { data: workflows },
    { data: rules },
    { data: recentMessages },
    { data: dossiers },
    { data: deadlines },
  ] = await Promise.all([
    supabase.from('mail_agents').select('agent_type, name, enabled, stats').order('name'),
    supabase.from('mail_workflows').select('name, enabled, run_count, last_run_at').order('priority', { ascending: false }),
    supabase.from('mail_routing_rules').select('id, enabled, agent_type').eq('enabled', true),
    supabase.from('mail_messages').select('id, priority, category, company, received_at').order('received_at', { ascending: false }).limit(100),
    supabase.from('mail_legal_dossiers').select('id, risk_level, status').in('status', ['open', 'in_behandeling']),
    supabase.from('mail_legal_deadlines').select('deadline_at').eq('status', 'open').lte('deadline_at', new Date(Date.now() + 7 * 86400000).toISOString()),
  ])

  const stats = {
    agents: { total: agents?.length ?? 0, active: agents?.filter(a => a.enabled).length ?? 0 },
    workflows: { total: workflows?.length ?? 0, active: workflows?.filter(w => w.enabled).length ?? 0 },
    rules: { total: rules?.length ?? 0, legal: rules?.filter(r => r.agent_type === 'legal').length ?? 0 },
    messages: {
      total: recentMessages?.length ?? 0,
      urgent: recentMessages?.filter(m => m.priority === 'urgent').length ?? 0,
    },
    dossiers: {
      total: dossiers?.length ?? 0,
      critical: dossiers?.filter(d => d.risk_level === 'critical').length ?? 0,
      high: dossiers?.filter(d => d.risk_level === 'high').length ?? 0,
    },
    deadlines: deadlines?.length ?? 0,
  }

  const modules = [
    {
      href: '/dashboard/mail/agents',
      icon: Bot,
      color: 'text-cyan-400',
      bg: 'bg-cyan-500/10 border-cyan-500/20',
      title: 'Mail Agents',
      desc: `${stats.agents.active}/${stats.agents.total} actief — configureer AI-agents per type`,
      badge: null,
    },
    {
      href: '/dashboard/mail/workflows',
      icon: GitMerge,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10 border-emerald-500/20',
      title: 'Mail Workflows',
      desc: `${stats.workflows.active}/${stats.workflows.total} actief — pipelines per mailtype`,
      badge: null,
    },
    {
      href: '/dashboard/mail/rules',
      icon: Filter,
      color: 'text-indigo-400',
      bg: 'bg-indigo-500/10 border-indigo-500/20',
      title: 'Routing Rules',
      desc: `${stats.rules.total} regels — ${stats.rules.legal} juridisch`,
      badge: null,
    },
    {
      href: '/dashboard/mail/dossiers',
      icon: Scale,
      color: 'text-amber-400',
      bg: 'bg-amber-500/10 border-amber-500/20',
      title: 'Juridische Dossiers',
      desc: `${stats.dossiers.total} open — ${stats.dossiers.critical} kritiek`,
      badge: stats.dossiers.critical > 0 ? stats.dossiers.critical : null,
    },
    {
      href: '/mobile/mail',
      icon: Inbox,
      color: 'text-white/60',
      bg: 'bg-white/5 border-white/10',
      title: 'Mail Inbox',
      desc: `${stats.messages.urgent > 0 ? `${stats.messages.urgent} urgent · ` : ''}Inkomende mail overzicht`,
      badge: stats.messages.urgent > 0 ? stats.messages.urgent : null,
    },
  ]

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
          <Mail size={16} className="text-indigo-400" />
        </div>
        <div>
          <h1 className="text-base font-semibold text-white">Mail Engine</h1>
          <p className="text-xs text-white/50">Beheer AI-agents, workflows, routing en juridische dossiers</p>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[11px] text-white/40">Live</span>
        </div>
      </div>

      {/* Alerts */}
      {(stats.dossiers.critical > 0 || stats.deadlines > 0) && (
        <div className="p-3 bg-red-500/8 border border-red-500/20 rounded-xl flex items-start gap-3">
          <AlertTriangle size={15} className="text-red-400 flex-shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            {stats.dossiers.critical > 0 && (
              <p className="text-[12px] text-red-400 font-semibold">{stats.dossiers.critical}× KRITIEK juridisch dossier — directe actie vereist</p>
            )}
            {stats.deadlines > 0 && (
              <p className="text-[11px] text-orange-400">{stats.deadlines} juridische termijn(en) binnen 7 dagen</p>
            )}
          </div>
          <Link href="/dashboard/mail/dossiers" className="ml-auto text-[10px] text-red-400 hover:text-red-300 flex-shrink-0">
            Bekijk →
          </Link>
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Agents actief', value: `${stats.agents.active}/${stats.agents.total}`, icon: Bot, color: 'text-cyan-400', bg: 'border-cyan-500/20' },
          { label: 'Routing rules', value: stats.rules.total, icon: Filter, color: 'text-indigo-400', bg: 'border-indigo-500/20' },
          { label: 'Dossiers open', value: stats.dossiers.total, icon: Scale, color: 'text-amber-400', bg: 'border-amber-500/20' },
          { label: 'Termijnen (<7d)', value: stats.deadlines, icon: Clock, color: stats.deadlines > 0 ? 'text-red-400' : 'text-white/30', bg: stats.deadlines > 0 ? 'border-red-500/20' : 'border-white/5' },
        ].map(s => {
          const Icon = s.icon
          return (
            <div key={s.label} className={`bg-white/[0.04] border ${s.bg} rounded-xl p-4`}>
              <Icon size={13} className={`${s.color} mb-2`} />
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-[11px] text-white/40 mt-0.5">{s.label}</p>
            </div>
          )
        })}
      </div>

      {/* Module grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {modules.map(m => {
          const Icon = m.icon
          return (
            <Link
              key={m.href}
              href={m.href}
              className="group p-4 bg-white/[0.04] border border-white/[0.06] rounded-xl hover:border-white/10 hover:bg-white/[0.06] transition-all flex items-start gap-3"
            >
              <div className={`w-8 h-8 rounded-lg border ${m.bg} flex items-center justify-center flex-shrink-0`}>
                <Icon size={14} className={m.color} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-[13px] font-medium text-white">{m.title}</p>
                  {m.badge != null && (
                    <span className="px-1.5 py-0.5 rounded-full bg-red-500 text-white text-[9px] font-bold">{m.badge}</span>
                  )}
                </div>
                <p className="text-[11px] text-white/40 mt-0.5">{m.desc}</p>
              </div>
              <span className="text-white/20 group-hover:text-white/40 transition-colors text-sm">→</span>
            </Link>
          )
        })}
      </div>

      {/* Agent status tabel */}
      <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[13px] font-semibold text-white">Agent Status</h2>
          <Link href="/dashboard/mail/agents" className="text-[11px] text-indigo-400 hover:text-indigo-300">
            Beheren →
          </Link>
        </div>
        <div className="space-y-2">
          {(agents ?? []).map(a => {
            const stats = a.stats as { processed?: number; errors?: number; last_run?: string | null } | null
            return (
              <div key={a.agent_type} className="flex items-center gap-3 py-2 border-b border-white/[0.04] last:border-0">
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${a.enabled ? 'bg-emerald-400' : 'bg-white/20'}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] text-white/80">{a.name}</p>
                  <p className="text-[10px] text-white/30">{a.agent_type}</p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] text-white/50">{stats?.processed ?? 0} verwerkt</p>
                  {(stats?.errors ?? 0) > 0 && (
                    <p className="text-[10px] text-red-400">{stats?.errors} fouten</p>
                  )}
                </div>
                <span className={`text-[9px] px-1.5 py-0.5 rounded border ${a.enabled ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' : 'text-white/25 bg-white/[0.03] border-white/5'}`}>
                  {a.enabled ? 'Actief' : 'Uit'}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
