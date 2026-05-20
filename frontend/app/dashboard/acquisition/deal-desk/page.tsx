import { Target, Radar, MapPin, ScrollText, UserPlus, TrendingUp, Bot, Clock, AlertCircle, Zap } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getAcqDealStats, getHotZones, getAcqAgents, getAcqScanJobs } from '@/lib/supabase/acquisition'
import type { AcqDeal } from '@/lib/supabase/acquisition'

function fmt(n: number) {
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)
}

async function getTopDeals(): Promise<AcqDeal[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('acq_deals')
    .select('*')
    .eq('status', 'actief')
    .not('pipeline_stage', 'in', '("gewonnen","verloren")')
    .order('ai_score', { ascending: false })
    .limit(5)
  return (data ?? []) as AcqDeal[]
}

const PIPELINE_COLORS: Record<string, string> = {
  radar: 'text-sky-400 bg-sky-500/10',
  analyse: 'text-amber-400 bg-amber-500/10',
  due_diligence: 'text-violet-400 bg-violet-500/10',
  bod: 'text-orange-400 bg-orange-500/10',
  gewonnen: 'text-emerald-400 bg-emerald-500/10',
  verloren: 'text-red-400 bg-red-500/10',
}

const AGENT_STATUS_COLORS: Record<string, string> = {
  idle: 'text-white/40 bg-white/5',
  running: 'text-emerald-400 bg-emerald-500/10',
  error: 'text-red-400 bg-red-500/10',
  disabled: 'text-white/20 bg-white/3',
}

export default async function DealDeskPage() {
  const [stats, hotZones, topDeals, agents, scanJobs] = await Promise.all([
    getAcqDealStats(),
    getHotZones(5),
    getTopDeals(),
    getAcqAgents(),
    getAcqScanJobs(5),
  ])

  const statCards: Array<{ label: string; value: string | number; icon: React.ComponentType<{size?: number; className?: string}>; color: string }> = [
    { label: 'Actieve Deals', value: stats.actief, icon: Radar, color: 'indigo' },
    { label: 'OffMarket Leads', value: stats.offmarket_total, icon: MapPin, color: 'rose' },
    { label: 'Permit Alerts', value: stats.permit_total, icon: ScrollText, color: 'violet' },
    { label: 'Investor Matches', value: stats.investor_total, icon: UserPlus, color: 'emerald' },
    { label: 'Pipeline Waarde', value: fmt(stats.pipeline_waarde), icon: TrendingUp, color: 'amber' },
    { label: 'Gem. AI Score', value: stats.avg_score > 0 ? `${stats.avg_score}/100` : '—', icon: Target, color: 'sky' },
  ]

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
          <Target size={16} className="text-amber-400" />
        </div>
        <div>
          <h1 className="text-base font-semibold text-white">Executive Deal Desk</h1>
          <p className="text-xs text-white/50">Realtime acquisitie command center — alle kansen op één plek</p>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {statCards.map((card) => (
          <div key={card.label} className="bg-white/[0.03] border border-white/5 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <card.icon size={12} className="text-white/40" />
              <p className="text-[11px] text-white/40">{card.label}</p>
            </div>
            <p className="text-xl font-bold text-white">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Top deals */}
        <div className="xl:col-span-2 bg-white/[0.02] border border-white/5 rounded-xl">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
            <p className="text-xs font-semibold text-white/70">Top Deals — Hoogste AI Score</p>
            <a href="/dashboard/acquisition/deals" className="text-[11px] text-indigo-400 hover:text-indigo-300">Alle deals →</a>
          </div>
          <div className="divide-y divide-white/[0.04]">
            {topDeals.length === 0 ? (
              <EmptyState icon={Radar} label="Geen deals in de pipeline" />
            ) : topDeals.map(deal => (
              <a key={deal.id} href={`/dashboard/acquisition/deals/${deal.id}`}
                className="flex items-center justify-between px-4 py-3 hover:bg-white/[0.02] transition-colors group">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-white truncate group-hover:text-amber-300 transition-colors">{deal.title}</p>
                  <p className="text-[11px] text-white/40 mt-0.5">{deal.city ?? '—'} · {deal.object_type ?? '—'}</p>
                </div>
                <div className="flex items-center gap-2 ml-3 shrink-0">
                  {deal.ai_score !== null && (
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                      deal.ai_score >= 70 ? 'bg-emerald-500/15 text-emerald-400' :
                      deal.ai_score >= 40 ? 'bg-amber-500/15 text-amber-400' :
                      'bg-red-500/15 text-red-400'
                    }`}>{deal.ai_score}</span>
                  )}
                  <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${PIPELINE_COLORS[deal.pipeline_stage] ?? 'text-white/40 bg-white/5'}`}>
                    {deal.pipeline_stage}
                  </span>
                  {deal.asking_price && (
                    <span className="text-[11px] text-white/50">{fmt(deal.asking_price)}</span>
                  )}
                </div>
              </a>
            ))}
          </div>
        </div>

        {/* Hot zones */}
        <div className="bg-white/[0.02] border border-white/5 rounded-xl">
          <div className="px-4 py-3 border-b border-white/5">
            <p className="text-xs font-semibold text-white/70">Hot Zones — Meeste Activiteit</p>
          </div>
          <div className="p-4">
            {hotZones.length === 0 ? (
              <EmptyState icon={MapPin} label="Geen data" />
            ) : (
              <div className="space-y-2">
                {hotZones.map((zone, i) => (
                  <div key={zone.city} className="flex items-center gap-3">
                    <span className="text-[11px] text-white/30 w-4 text-right">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-white truncate">{zone.city}</span>
                        <span className="text-[11px] text-white/50 ml-2">{zone.count} deals</span>
                      </div>
                      <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-amber-500/60 rounded-full"
                          style={{ width: `${Math.min(100, (zone.count / (hotZones[0]?.count || 1)) * 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* Agent status */}
        <div className="bg-white/[0.02] border border-white/5 rounded-xl">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
            <p className="text-xs font-semibold text-white/70">Acquisition Agents</p>
            <a href="/dashboard/acquisition/agents" className="text-[11px] text-indigo-400 hover:text-indigo-300">Beheer →</a>
          </div>
          <div className="p-3 grid grid-cols-2 gap-2">
            {agents.map(agent => (
              <div key={agent.id} className="bg-white/[0.02] border border-white/[0.04] rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Bot size={11} className="text-white/40 shrink-0" />
                  <span className="text-[11px] text-white/70 truncate">{agent.name}</span>
                </div>
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${AGENT_STATUS_COLORS[agent.status] ?? 'text-white/40 bg-white/5'}`}>
                  {agent.status}
                </span>
                <div className="mt-1.5 flex items-center gap-3">
                  <span className="text-[10px] text-white/30">✓ {agent.tasks_done}</span>
                  {agent.tasks_failed > 0 && <span className="text-[10px] text-red-400/60">✗ {agent.tasks_failed}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Scan jobs queue */}
        <div className="bg-white/[0.02] border border-white/5 rounded-xl">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
            <p className="text-xs font-semibold text-white/70">Recente Scan Jobs</p>
            <a href="/dashboard/acquisition/scaling" className="text-[11px] text-indigo-400 hover:text-indigo-300">Scaling →</a>
          </div>
          <div className="divide-y divide-white/[0.04]">
            {scanJobs.length === 0 ? (
              <EmptyState icon={Zap} label="Geen scan jobs" />
            ) : scanJobs.map(job => (
              <div key={job.id} className="flex items-center justify-between px-4 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] text-white/70 truncate">{job.agent_name} — {job.job_type}</p>
                  <p className="text-[10px] text-white/30 mt-0.5">{new Date(job.created_at).toLocaleString('nl-NL')}</p>
                </div>
                <div className="flex items-center gap-2 ml-2 shrink-0">
                  {job.result_count > 0 && <span className="text-[10px] text-white/40">{job.result_count} resultaten</span>}
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                    job.status === 'done' ? 'text-emerald-400 bg-emerald-500/10' :
                    job.status === 'running' ? 'text-amber-400 bg-amber-500/10' :
                    job.status === 'failed' ? 'text-red-400 bg-red-500/10' :
                    'text-white/40 bg-white/5'
                  }`}>{job.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function EmptyState({ icon: Icon, label }: { icon: React.ComponentType<{ size?: number; className?: string }>, label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 gap-2">
      <div className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center">
        <Icon size={13} className="text-white/30" />
      </div>
      <p className="text-[11px] text-white/30">{label}</p>
    </div>
  )
}
