import {
  Bot,
  TrendingUp,
  FolderKanban,
  Home,
  CheckSquare,
  Activity,
  ArrowUpRight,
  Euro,
} from 'lucide-react'
import clsx from 'clsx'
import { getDashboardStats } from '@/lib/supabase/queries'
import { createClient } from '@/lib/supabase/server'

const COMPANIES_STATUS = [
  { name: 'Modiwerijo Financial Management BV', short: 'MODIWÉ', color: '#6366f1', agents: 2, tasks: 4, status: 'actief' },
  { name: 'Modiwe Media BV', short: 'MEDIA', color: '#8b5cf6', agents: 2, tasks: 3, status: 'actief' },
  { name: 'STRKBEHEER BV', short: 'BEHEER', color: '#0ea5e9', agents: 1, tasks: 5, status: 'actief' },
  { name: 'STRKBOUW BV', short: 'BOUW', color: '#f59e0b', agents: 1, tasks: 2, status: 'actief' },
  { name: 'Bouwproffs BV', short: 'PROFFS', color: '#6b7280', agents: 0, tasks: 0, status: 'slapend' },
]

const colorMap: Record<string, string> = {
  indigo: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
  amber: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  sky: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
  emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  violet: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
  green: 'bg-green-500/10 text-green-400 border-green-500/20',
}

export default async function DashboardPage() {
  const [stats, supabase] = await Promise.all([
    getDashboardStats(),
    createClient(),
  ])

  // Recent activity from notifications
  const { data: recentNotifs } = await supabase
    .from('notifications')
    .select('title, message, created_at, type')
    .order('created_at', { ascending: false })
    .limit(5)

  // Agents live
  const { data: agentsData } = await supabase
    .from('agents')
    .select('id, name, role, status, current_load')
    .order('status', { ascending: false })
    .limit(6)

  const STAT_CARDS = [
    { label: 'Actieve Agents', value: String(stats.actieve_agents || 0), sub: 'Live monitoring', icon: Bot, color: 'indigo' },
    { label: 'Open Taken', value: String(stats.open_taken || 0), sub: 'In queue / verwerking', icon: CheckSquare, color: 'amber' },
    { label: 'Lopende Projecten', value: String(stats.lopende_projecten || 0), sub: 'STRKBOUW + BEHEER', icon: FolderKanban, color: 'sky' },
    { label: 'Vastgoed Deals', value: String(stats.vastgoed_deals || 0), sub: 'Actief in pipeline', icon: Home, color: 'emerald' },
    { label: 'Maandomzet', value: stats.maandomzet > 0 ? `€${(stats.maandomzet / 1000).toFixed(0)}k` : '€0', sub: 'Lopende maand', icon: Euro, color: 'violet' },
    { label: 'System Health', value: `${stats.system_health}%`, sub: 'Alle services OK', icon: Activity, color: 'green' },
  ]

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        {STAT_CARDS.map((card) => {
          const Icon = card.icon
          const colors = colorMap[card.color]
          return (
            <div key={card.label} className="bg-white/[0.06] border border-white/5 rounded-xl p-4 flex flex-col gap-3">
              <div className={clsx('w-8 h-8 rounded-lg border flex items-center justify-center', colors)}>
                <Icon size={15} />
              </div>
              <div>
                <p className="text-xl font-bold text-white leading-none">{card.value}</p>
                <p className="text-[11px] text-white/65 mt-1">{card.label}</p>
                <p className="text-[10px] text-white/45 mt-0.5">{card.sub}</p>
              </div>
            </div>
          )
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* BV Overzicht */}
        <div className="bg-white/[0.06] border border-white/5 rounded-xl p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-white">Bedrijven</h2>
            <button className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1">
              Beheer <ArrowUpRight size={11} />
            </button>
          </div>
          <div className="space-y-2">
            {COMPANIES_STATUS.map((company) => (
              <div key={company.short} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-white/5 transition-colors">
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: company.color }} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-white/80 truncate">{company.name}</p>
                </div>
                <div className="flex items-center gap-3 text-[11px] text-white/50 flex-shrink-0">
                  <span>{company.agents} agents</span>
                  <span>{company.tasks} taken</span>
                  <span className={clsx('px-2 py-0.5 rounded-full text-[10px] font-medium',
                    company.status === 'actief' ? 'bg-green-500/10 text-green-400' : 'bg-white/5 text-white/38'
                  )}>
                    {company.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recente activiteit — live vanuit notifications */}
        <div className="bg-white/[0.06] border border-white/5 rounded-xl p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-white">Recente Activiteit</h2>
            <button className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1">
              Alle logs <ArrowUpRight size={11} />
            </button>
          </div>
          <div className="space-y-2">
            {recentNotifs && recentNotifs.length > 0 ? recentNotifs.map((item, i) => (
              <div key={i} className="flex items-start gap-3 py-1.5">
                <span className="text-[10px] text-white/45 font-mono flex-shrink-0 mt-0.5">
                  {new Date(item.created_at).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}
                </span>
                <div className={clsx('w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0',
                  item.type === 'error' ? 'bg-red-500' : item.type === 'warning' ? 'bg-amber-500' : 'bg-green-500'
                )} />
                <p className="text-xs text-white/50 leading-relaxed">{item.title ?? item.message}</p>
              </div>
            )) : (
              // Fallback static activity
              [
                { time: '12:41', msg: 'sync-pull uitgevoerd — 7/7 repos up to date', type: 'ok' },
                { time: '12:00', msg: 'orlando-core-os: commit gepushed', type: 'ok' },
                { time: '11:55', msg: 'SSH key toegevoegd aan GitHub', type: 'ok' },
                { time: '11:30', msg: 'Mac Mini 2 sync setup voltooid', type: 'ok' },
                { time: '09:00', msg: 'Launchd auto-pull geactiveerd (5 min interval)', type: 'ok' },
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-3 py-1.5">
                  <span className="text-[10px] text-white/45 font-mono flex-shrink-0 mt-0.5">{item.time}</span>
                  <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 bg-green-500" />
                  <p className="text-xs text-white/50 leading-relaxed">{item.msg}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Agent cluster — live */}
      <div className="bg-white/[0.06] border border-white/5 rounded-xl p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-white">Agent Cluster</h2>
          <button className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1">
            Agent OS <ArrowUpRight size={11} />
          </button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
          {(agentsData && agentsData.length > 0 ? agentsData : [
            { id: '1', name: 'Sync Agent', role: 'sync', status: 'active', current_load: 0 },
            { id: '2', name: 'YouTube Agent', role: 'media', status: 'active', current_load: 3 },
            { id: '3', name: 'Mail Agent', role: 'mail', status: 'active', current_load: 12 },
            { id: '4', name: 'VastgoedScalper', role: 'vastgoed', status: 'idle', current_load: 0 },
            { id: '5', name: 'Calculatie Agent', role: 'calc', status: 'idle', current_load: 1 },
            { id: '6', name: 'PDF Generator', role: 'pdf', status: 'offline', current_load: 0 },
          ]).map((agent) => (
            <div key={agent.id} className="bg-white/[0.06] border border-white/5 rounded-lg p-3 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className={clsx('w-1.5 h-1.5 rounded-full',
                  agent.status === 'active' ? 'bg-green-500' :
                  agent.status === 'idle' ? 'bg-amber-500' : 'bg-white/15'
                )} />
                <span className="text-[9px] text-white/38 font-mono truncate">{agent.role}</span>
              </div>
              <p className="text-[11px] text-white/60 font-medium leading-tight">{agent.name}</p>
              <div className="flex items-center justify-between">
                <p className={clsx('text-[10px] font-medium',
                  agent.status === 'active' ? 'text-green-400' :
                  agent.status === 'idle' ? 'text-amber-400' : 'text-white/38'
                )}>
                  {agent.status === 'active' ? 'online' : agent.status}
                </p>
                {(agent.current_load ?? 0) > 0 && (
                  <span className="text-[9px] text-white/45">{agent.current_load}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
