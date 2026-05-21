import {
  Bot,
  TrendingUp,
  FolderKanban,
  Home,
  CheckSquare,
  Activity,
  ArrowUpRight,
  Euro,
  Mail,
  Upload,
  Eye,
  HardDrive,
} from 'lucide-react'
import clsx from 'clsx'
import Link from 'next/link'
import { getDashboardStats } from '@/lib/supabase/queries'
import { getStorageStats, getMailStats, getUploadStats, getViewStats } from '@/lib/supabase/storage-queries'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const colorMap: Record<string, string> = {
  indigo:  'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
  amber:   'bg-amber-500/10 text-amber-400 border-amber-500/20',
  sky:     'bg-sky-500/10 text-sky-400 border-sky-500/20',
  emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  violet:  'bg-violet-500/10 text-violet-400 border-violet-500/20',
  green:   'bg-green-500/10 text-green-400 border-green-500/20',
}

const COMPANY_COLORS: Record<string, string> = {
  MODIWÉ: '#6366f1', MODIWE: '#6366f1', MEDIA: '#8b5cf6',
  BEHEER: '#0ea5e9', BOUW: '#f59e0b', PROFFS: '#10b981',
}

function colorFor(name: string) {
  const upper = name.toUpperCase()
  for (const [key, color] of Object.entries(COMPANY_COLORS)) {
    if (upper.includes(key)) return color
  }
  return '#6366f1'
}

function fmtEur(n: number) {
  if (n >= 1_000_000) return `€${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `€${(n / 1_000).toFixed(0)}k`
  return `€${n}`
}

function fmtBytes(bytes: number) {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)}GB`
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)}KB`
  return `${bytes}B`
}

export default async function DashboardPage() {
  const supabase = await createClient()

  const [stats, notifRes, agentsRes, companiesRes, agentCountRes, taskCountRes, storageStats, mailStats, uploadStats, viewStats] = await Promise.all([
    getDashboardStats(),
    supabase.from('notifications')
      .select('titel, bericht, created_at, type')
      .order('created_at', { ascending: false })
      .limit(5),
    supabase.from('agents')
      .select('id, name, role, status, current_load')
      .order('status', { ascending: false })
      .limit(6),
    supabase.from('companies')
      .select('id, name, type')
      .order('name', { ascending: true }),
    supabase.from('agents').select('company_id').not('company_id', 'is', null),
    supabase.from('planning_items').select('company_id').not('company_id', 'is', null).neq('status', 'gereed'),
    getStorageStats(),
    getMailStats(),
    getUploadStats(7),
    getViewStats(),
  ])

  const agentCounts: Record<string, number> = {}
  for (const r of agentCountRes.data ?? []) {
    agentCounts[r.company_id] = (agentCounts[r.company_id] ?? 0) + 1
  }
  const taskCounts: Record<string, number> = {}
  for (const r of taskCountRes.data ?? []) {
    taskCounts[r.company_id] = (taskCounts[r.company_id] ?? 0) + 1
  }

  const companies = companiesRes.data ?? []
  const recentNotifs = notifRes.data ?? []
  const agentsData = agentsRes.data ?? []

  const totalStorage = storageStats.reduce((sum, s) => sum + s.usedStorage, 0)
  const totalMails = mailStats.reduce((sum, m) => sum + m.todayCount, 0)
  const totalUploads = uploadStats.length
  const totalViews = viewStats.reduce((sum, v) => sum + v.pageViews, 0)

  const STAT_CARDS = [
    { label: 'Actieve Agents',     value: String(stats.actieve_agents),    sub: 'Live monitoring',       icon: Bot,          color: 'indigo'  },
    { label: 'Open Taken',         value: String(stats.open_taken),        sub: 'In queue / verwerking', icon: CheckSquare,  color: 'amber'   },
    { label: 'Mails Vandaag',      value: String(totalMails),              sub: 'Alle bedrijven',        icon: Mail,         color: 'sky'     },
    { label: 'Opslag Gebruik',     value: fmtBytes(totalStorage),          sub: 'Totaal',                icon: HardDrive,    color: 'emerald' },
    { label: 'Views Vandaag',      value: String(totalViews),              sub: 'Alle bedrijven',        icon: Eye,          color: 'violet'  },
    { label: 'System Health',      value: `${stats.system_health}%`,       sub: 'Worker uptime',         icon: Activity,     color: 'green'   },
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
        {/* BV Overzicht — live */}
        <div className="bg-white/[0.06] border border-white/5 rounded-xl p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-white">Bedrijven</h2>
            <Link href="/dashboard/companies" className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1">
              Beheer <ArrowUpRight size={11} />
            </Link>
          </div>
          <div className="space-y-2">
            {companies.length === 0 ? (
              <p className="text-xs text-white/40 py-4 text-center">Geen bedrijven gevonden</p>
            ) : companies.map((company) => (
              <div key={company.id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-white/5 transition-colors">
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: colorFor(company.name) }} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-white/80 truncate">{company.name}</p>
                </div>
                <div className="flex items-center gap-3 text-[11px] text-white/50 flex-shrink-0">
                  <span>{agentCounts[company.id] ?? 0} agents</span>
                  <span>{taskCounts[company.id] ?? 0} taken</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-500/10 text-green-400">
                    actief
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recente activiteit — live */}
        <div className="bg-white/[0.06] border border-white/5 rounded-xl p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-white">Recente Activiteit</h2>
            <Link href="/dashboard/meldingen" className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1">
              Alle logs <ArrowUpRight size={11} />
            </Link>
          </div>
          <div className="space-y-2">
            {recentNotifs.length > 0 ? recentNotifs.map((item, i) => (
              <div key={i} className="flex items-start gap-3 py-1.5">
                <span className="text-[10px] text-white/45 font-mono flex-shrink-0 mt-0.5">
                  {new Date(item.created_at).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}
                </span>
                <div className={clsx('w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0',
                  item.type === 'error'   ? 'bg-red-500' :
                  item.type === 'warning' ? 'bg-amber-500' : 'bg-green-500'
                )} />
                <p className="text-xs text-white/50 leading-relaxed">{item.titel ?? item.bericht}</p>
              </div>
            )) : (
              <p className="text-xs text-white/30 py-4 text-center">Geen recente meldingen</p>
            )}
          </div>
        </div>
      </div>

      {/* Agent cluster — live */}
      <div className="bg-white/[0.06] border border-white/5 rounded-xl p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-white">Agent Cluster</h2>
          <Link href="/dashboard/agents" className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1">
            Agent OS <ArrowUpRight size={11} />
          </Link>
        </div>
        {agentsData.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 gap-2">
            <Bot size={24} className="text-white/20" />
            <p className="text-xs text-white/40">Geen agents geregistreerd</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
            {agentsData.map((agent) => (
              <div key={agent.id} className="bg-white/[0.06] border border-white/5 rounded-lg p-3 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className={clsx('w-1.5 h-1.5 rounded-full',
                    agent.status === 'active'     ? 'bg-green-500' :
                    agent.status === 'idle'        ? 'bg-amber-500' : 'bg-white/15'
                  )} />
                  <span className="text-[9px] text-white/38 font-mono truncate">{agent.role}</span>
                </div>
                <p className="text-[11px] text-white/60 font-medium leading-tight">{agent.name}</p>
                <div className="flex items-center justify-between">
                  <p className={clsx('text-[10px] font-medium',
                    agent.status === 'active' ? 'text-green-400' :
                    agent.status === 'idle'   ? 'text-amber-400' : 'text-white/38'
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
        )}
      </div>

      {/* Storage Overview — live */}
      <div className="bg-white/[0.06] border border-white/5 rounded-xl p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-white">📦 Opslag Overzicht</h2>
          <span className="text-[11px] text-white/40">Real-time</span>
        </div>
        <div className="space-y-3">
          {storageStats.length === 0 ? (
            <p className="text-xs text-white/40 py-4 text-center">Geen opslag data</p>
          ) : (
            storageStats.map((s) => (
              <div key={s.companyId} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-white">{s.companyName}</span>
                  <span className="text-[10px] text-white/50">{fmtBytes(s.usedStorage)} / {fmtBytes(s.totalStorage)}</span>
                </div>
                <div className="w-full bg-white/5 rounded-full h-2 overflow-hidden">
                  <div
                    className={clsx('h-full transition-all',
                      s.percentage > 80 ? 'bg-red-500' :
                      s.percentage > 60 ? 'bg-amber-500' : 'bg-green-500'
                    )}
                    style={{ width: `${s.percentage}%` }}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-white/40">{s.fileCount} bestanden</span>
                  <span className="text-[10px] font-medium text-white">{s.percentage}%</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Mail Stats — today */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white/[0.06] border border-white/5 rounded-xl p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-white">📧 Mail Activiteit (Vandaag)</h2>
            <span className="text-[11px] text-white/40">Live</span>
          </div>
          <div className="space-y-2">
            {mailStats.length === 0 ? (
              <p className="text-xs text-white/40 py-4 text-center">Geen mail data</p>
            ) : (
              mailStats.map((m) => (
                <div key={m.companyId} className="flex items-center justify-between p-2.5 rounded-lg hover:bg-white/5 transition-colors">
                  <div className="flex-1">
                    <p className="text-xs font-medium text-white/80">{m.companyName}</p>
                    <p className="text-[10px] text-white/40">Gem. response: {m.averageResponseTime}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold text-indigo-400">{m.todayCount}</p>
                    <p className="text-[10px] text-white/40">{m.totalUnread} ongelezen</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Views Stats — today */}
        <div className="bg-white/[0.06] border border-white/5 rounded-xl p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-white">👁️ Views (Vandaag)</h2>
            <span className="text-[11px] text-white/40">Live</span>
          </div>
          <div className="space-y-2">
            {viewStats.length === 0 ? (
              <p className="text-xs text-white/40 py-4 text-center">Geen view data</p>
            ) : (
              viewStats.map((v) => (
                <div key={v.companyId} className="flex items-center justify-between p-2.5 rounded-lg hover:bg-white/5 transition-colors">
                  <div className="flex-1">
                    <p className="text-xs font-medium text-white/80">{v.companyName}</p>
                    <p className="text-[10px] text-white/40">Bounce: {v.bounceRate}% | {v.avgSessionDuration} avg</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold text-sky-400">{v.pageViews}</p>
                    <p className="text-[10px] text-white/40">{v.uniqueVisitors} bezoekers</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Upload Timeline */}
      <div className="bg-white/[0.06] border border-white/5 rounded-xl p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-white">⬆️ Upload Activiteit (7 dagen)</h2>
          <span className="text-[11px] text-white/40">{uploadStats.length} dagen actief</span>
        </div>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {uploadStats.length === 0 ? (
            <p className="text-xs text-white/40 py-4 text-center">Geen upload data</p>
          ) : (
            uploadStats.map((u, i) => (
              <div key={i} className="flex items-center justify-between p-2.5 rounded-lg hover:bg-white/5 transition-colors">
                <div className="flex-1">
                  <p className="text-xs font-medium text-white/80">{new Date(u.date).toLocaleDateString('nl-NL', { weekday: 'short', month: 'short', day: 'numeric' })}</p>
                  <p className="text-[10px] text-white/40">{fmtBytes(u.totalSize)}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold text-amber-400">{u.count}</p>
                  <p className="text-[10px] text-white/40">uploads</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
