import {
  Bot,
  TrendingUp,
  FolderKanban,
  Home,
  CheckSquare,
  Activity,
  AlertTriangle,
  ArrowUpRight,
} from 'lucide-react'
import clsx from 'clsx'

const STAT_CARDS = [
  { label: 'Actieve Agents', value: '6', sub: '2 in queue', icon: Bot, color: 'indigo', trend: null },
  { label: 'Open Taken', value: '14', sub: '3 urgent', icon: CheckSquare, color: 'amber', trend: null },
  { label: 'Lopende Projecten', value: '4', sub: 'STRKBOUW + BEHEER', icon: FolderKanban, color: 'sky', trend: null },
  { label: 'Vastgoed Deals', value: '2', sub: 'In analyse', icon: Home, color: 'emerald', trend: null },
  { label: 'Maandomzet', value: '€0', sub: 'Nog niet actief', icon: TrendingUp, color: 'violet', trend: null },
  { label: 'System Health', value: '98%', sub: 'Alle services OK', icon: Activity, color: 'green', trend: null },
]

const colorMap: Record<string, string> = {
  indigo: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
  amber: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  sky: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
  emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  violet: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
  green: 'bg-green-500/10 text-green-400 border-green-500/20',
}

const COMPANIES_STATUS = [
  { name: 'Modiwerijo Financial Management BV', short: 'MODIWÉ', color: '#6366f1', agents: 2, tasks: 4, status: 'actief' },
  { name: 'Modiwe Media BV', short: 'MEDIA', color: '#8b5cf6', agents: 2, tasks: 3, status: 'actief' },
  { name: 'STRKBEHEER BV', short: 'BEHEER', color: '#0ea5e9', agents: 1, tasks: 5, status: 'actief' },
  { name: 'STRKBOUW BV', short: 'BOUW', color: '#f59e0b', agents: 1, tasks: 2, status: 'actief' },
  { name: 'Bouwproffs BV', short: 'PROFFS', color: '#6b7280', agents: 0, tasks: 0, status: 'slapend' },
]

const RECENT_ACTIVITY = [
  { time: '12:41', msg: 'sync-pull uitgevoerd — 7/7 repos up to date', type: 'ok' },
  { time: '12:00', msg: 'orlando-core-os: init commit gepushed', type: 'ok' },
  { time: '11:55', msg: 'SSH key toegevoegd aan GitHub (Mac Mini 1)', type: 'ok' },
  { time: '11:30', msg: 'Mac Mini 2 sync setup voltooid', type: 'ok' },
  { time: '09:00', msg: 'Launchd auto-pull geactiveerd (5 min interval)', type: 'ok' },
]

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        {STAT_CARDS.map((card) => {
          const Icon = card.icon
          const colors = colorMap[card.color]
          return (
            <div
              key={card.label}
              className="bg-white/[0.03] border border-white/5 rounded-xl p-4 flex flex-col gap-3"
            >
              <div className={clsx('w-8 h-8 rounded-lg border flex items-center justify-center', colors)}>
                <Icon size={15} />
              </div>
              <div>
                <p className="text-xl font-bold text-white leading-none">{card.value}</p>
                <p className="text-[11px] text-white/40 mt-1">{card.label}</p>
                <p className="text-[10px] text-white/25 mt-0.5">{card.sub}</p>
              </div>
            </div>
          )
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* BV Overzicht */}
        <div className="bg-white/[0.03] border border-white/5 rounded-xl p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-white">Bedrijven</h2>
            <button className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1">
              Beheer <ArrowUpRight size={11} />
            </button>
          </div>
          <div className="space-y-2">
            {COMPANIES_STATUS.map((company) => (
              <div
                key={company.short}
                className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-white/5 transition-colors"
              >
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: company.color }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-white/80 truncate">{company.name}</p>
                </div>
                <div className="flex items-center gap-3 text-[11px] text-white/30 flex-shrink-0">
                  <span>{company.agents} agents</span>
                  <span>{company.tasks} taken</span>
                  <span
                    className={clsx(
                      'px-2 py-0.5 rounded-full text-[10px] font-medium',
                      company.status === 'actief'
                        ? 'bg-green-500/10 text-green-400'
                        : 'bg-white/5 text-white/20'
                    )}
                  >
                    {company.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recente activiteit */}
        <div className="bg-white/[0.03] border border-white/5 rounded-xl p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-white">Recente Activiteit</h2>
            <button className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1">
              Alle logs <ArrowUpRight size={11} />
            </button>
          </div>
          <div className="space-y-2">
            {RECENT_ACTIVITY.map((item, i) => (
              <div key={i} className="flex items-start gap-3 py-1.5">
                <span className="text-[10px] text-white/25 font-mono flex-shrink-0 mt-0.5">
                  {item.time}
                </span>
                <div
                  className={clsx(
                    'w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0',
                    item.type === 'ok' ? 'bg-green-500' : 'bg-amber-500'
                  )}
                />
                <p className="text-xs text-white/50 leading-relaxed">{item.msg}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Agent status strip */}
      <div className="bg-white/[0.03] border border-white/5 rounded-xl p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-white">Agent Cluster</h2>
          <button className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1">
            Agent OS <ArrowUpRight size={11} />
          </button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
          {[
            { name: 'Sync Agent', status: 'online', company: 'MODIWÉ' },
            { name: 'YouTube Agent', status: 'online', company: 'MEDIA' },
            { name: 'VastgoedScalper', status: 'idle', company: 'BEHEER' },
            { name: 'Calculatie Agent', status: 'idle', company: 'BOUW' },
            { name: 'PDF Generator', status: 'offline', company: 'BOUW' },
            { name: 'Mail Agent', status: 'online', company: 'MODIWÉ' },
          ].map((agent) => (
            <div
              key={agent.name}
              className="bg-white/[0.03] border border-white/5 rounded-lg p-3 flex flex-col gap-2"
            >
              <div className="flex items-center justify-between">
                <span
                  className={clsx(
                    'w-1.5 h-1.5 rounded-full',
                    agent.status === 'online' ? 'bg-green-500' :
                    agent.status === 'idle' ? 'bg-amber-500' : 'bg-white/15'
                  )}
                />
                <span className="text-[9px] text-white/20 font-mono">{agent.company}</span>
              </div>
              <p className="text-[11px] text-white/60 font-medium leading-tight">{agent.name}</p>
              <p className={clsx(
                'text-[10px] font-medium',
                agent.status === 'online' ? 'text-green-400' :
                agent.status === 'idle' ? 'text-amber-400' : 'text-white/20'
              )}>
                {agent.status}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
