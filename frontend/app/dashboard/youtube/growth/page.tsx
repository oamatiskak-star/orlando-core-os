import { createAdminClient } from '@/lib/supabase/admin'
import { TrendingUp, CheckCircle, AlertCircle, XCircle } from 'lucide-react'
import GrowthClient from './GrowthClient'
import AgentControls from './AgentControls'

export const revalidate = 0

function VerdictBadge({ verdict }: { verdict: string }) {
  if (verdict === 'publish') return (
    <span className="flex items-center gap-1 text-[9px] px-2 py-0.5 rounded-full bg-green-500/15 text-green-400 font-medium">
      <CheckCircle size={8} /> Publiceer
    </span>
  )
  if (verdict === 'improve') return (
    <span className="flex items-center gap-1 text-[9px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 font-medium">
      <AlertCircle size={8} /> Verbeter
    </span>
  )
  return (
    <span className="flex items-center gap-1 text-[9px] px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 font-medium">
      <XCircle size={8} /> Afgewezen
    </span>
  )
}

function ScoreBar({ score }: { score: number }) {
  const color = score >= 75 ? 'bg-green-500' : score >= 50 ? 'bg-amber-500' : 'bg-red-500'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${score}%` }} />
      </div>
      <span className="text-[11px] font-mono text-white/50 w-7 text-right">{score}</span>
    </div>
  )
}

interface DeepDiveReport {
  id: string
  title: string | null
  summary_md: string | null
  generated_at: string
  generated_by_agent: string | null
  scope: { channel_id?: string } | null
}

export default async function GrowthPage() {
  const admin = createAdminClient()
  const since7d = new Date(Date.now() - 7 * 86_400_000).toISOString()

  const [
    { data: scores },
    { data: channels },
    { data: mhChannels },
    { data: reportsRaw },
    { data: agentRows },
  ] = await Promise.all([
    admin.from('youtube_quality_scores')
      .select('id, channel_id, total_score, verdict, feedback, created_at, youtube_upload_queue(title, channel_id)')
      .gte('created_at', since7d)
      .order('created_at', { ascending: false })
      .limit(100),
    admin.from('youtube_channels')
      .select('id, naam, name, view_count, subscriber_count, video_count, research_ideas, oauth_status, last_sync')
      .not('channel_id', 'is', null)
      .order('view_count', { ascending: false, nullsFirst: false }),
    admin.from('media_holding_channels')
      .select('id, name, youtube_channel_id')
      .not('youtube_channel_id', 'is', null),
    admin.from('executive_reports')
      .select('id, title, summary_md, generated_at, generated_by_agent, scope')
      .eq('report_kind', 'channel_deep_dive')
      .order('generated_at', { ascending: false })
      .limit(200),
    admin.from('executive_agents')
      .select('agent_key, name, last_run_at, last_run_status, enabled')
      .in('agent_key', ['atlas', 'channel_manager', 'algorithm_strategist', 'content_fund_manager', 'retention_scientist', 'viral_analyst']),
  ])

  const publishCount = (scores ?? []).filter(s => s.verdict === 'publish').length
  const improveCount = (scores ?? []).filter(s => s.verdict === 'improve').length
  const rejectCount  = (scores ?? []).filter(s => s.verdict === 'reject').length

  // youtube_channels.id → media_holding_channels.id (executive engine target)
  const ytToMh = new Map<string, string>()
  for (const m of mhChannels ?? []) {
    if (m.youtube_channel_id) ytToMh.set(m.youtube_channel_id as string, m.id as string)
  }

  // Latest deep-dive report per media_holding channel
  const latestReportByMh = new Map<string, DeepDiveReport>()
  for (const r of (reportsRaw ?? []) as DeepDiveReport[]) {
    const mhId = r.scope?.channel_id
    if (!mhId) continue
    if (!latestReportByMh.has(mhId)) latestReportByMh.set(mhId, r)
  }

  const channelRows = (channels ?? []).map(c => {
    const mhId = ytToMh.get(c.id as string) ?? null
    const report = mhId ? latestReportByMh.get(mhId) ?? null : null
    return {
      ytId:           c.id as string,
      mhId,
      naam:           (c.naam ?? c.name ?? '—') as string,
      viewCount:      Number(c.view_count ?? 0),
      subscriberCount: Number(c.subscriber_count ?? 0),
      videoCount:     Number(c.video_count ?? 0),
      oauthStatus:    (c.oauth_status ?? 'unknown') as string,
      lastSync:       (c.last_sync ?? null) as string | null,
      ideas:          (c.research_ideas?.ideas ?? []) as Array<{ title: string; hook_15s: string; thumbnail_concept: string; viral_trigger: string }>,
      ideasGeneratedAt: (c.research_ideas?.generated_at ?? null) as string | null,
      report: report ? {
        id: report.id,
        title: report.title,
        summaryMd: report.summary_md,
        generatedAt: report.generated_at,
        agent: report.generated_by_agent,
      } : null,
    }
  })

  const agentMap = new Map((agentRows ?? []).map(a => [a.agent_key, a]))

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
          <TrendingUp size={16} className="text-emerald-400" />
        </div>
        <div>
          <h1 className="text-base font-semibold text-white">Growth & Kwaliteit</h1>
          <p className="text-[11px] text-white/40">AI Analyst & Marketing Agent · {channelRows.length} kanalen</p>
        </div>
      </div>

      {/* Agent controls — Analyst + Marketing Strategy */}
      <AgentControls
        agents={Array.from(agentMap.values()).map(a => ({
          key: a.agent_key as string,
          name: a.name as string,
          lastRunAt: (a.last_run_at ?? null) as string | null,
          lastRunStatus: (a.last_run_status ?? null) as string | null,
          enabled: Boolean(a.enabled),
        }))}
      />

      {/* Stats deze week */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-green-500/5 border border-green-500/15 rounded-xl p-4">
          <CheckCircle size={14} className="text-green-400 mb-2" />
          <p className="text-2xl font-bold text-green-400">{publishCount}</p>
          <p className="text-[11px] text-white/40 mt-1">Gepubliceerd (≥75)</p>
        </div>
        <div className="bg-amber-500/5 border border-amber-500/15 rounded-xl p-4">
          <AlertCircle size={14} className="text-amber-400 mb-2" />
          <p className="text-2xl font-bold text-amber-400">{improveCount}</p>
          <p className="text-[11px] text-white/40 mt-1">Verbeteren (50-74)</p>
        </div>
        <div className="bg-red-500/5 border border-red-500/15 rounded-xl p-4">
          <XCircle size={14} className="text-red-400 mb-2" />
          <p className="text-2xl font-bold text-red-400">{rejectCount}</p>
          <p className="text-[11px] text-white/40 mt-1">Afgewezen (&lt;50)</p>
        </div>
      </div>

      {/* Recente scores tabel */}
      <div className="bg-white/[0.04] border border-white/5 rounded-xl p-4">
        <h2 className="text-[11px] font-semibold text-white/40 uppercase tracking-wide mb-3">
          Laatste scores — 7 dagen ({(scores ?? []).length} videos)
        </h2>
        {!(scores ?? []).length ? (
          <p className="text-xs text-white/30 text-center py-6">Nog geen kwaliteitsscores. Start de pipeline om scores te genereren.</p>
        ) : (
          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {(scores ?? []).map(s => {
              const queue = Array.isArray(s.youtube_upload_queue) ? s.youtube_upload_queue[0] : s.youtube_upload_queue
              const title = (queue as { title?: string } | undefined)?.title ?? '(geen titel)'
              return (
                <div key={s.id} className="flex items-center gap-3 py-2 border-b border-white/[0.04] last:border-0">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-white/65 truncate">{title}</p>
                    <p className="text-[10px] text-white/30 mt-0.5">
                      {new Date(s.created_at).toLocaleDateString('nl-NL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <div className="w-32 shrink-0">
                    <ScoreBar score={s.total_score ?? 0} />
                  </div>
                  <VerdictBadge verdict={s.verdict ?? 'improve'} />
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Per-kanaal — Analyst report, virale ideeën, run-knop */}
      <div className="space-y-3">
        <h2 className="text-[11px] font-semibold text-white/40 uppercase tracking-wide">
          Kanalen ({channelRows.length}) — Analyst report & virale ideeën
        </h2>
        {channelRows.map(row => (
          <GrowthClient
            key={row.ytId}
            channelNaam={row.naam}
            channelId={row.ytId}
            mediaHoldingId={row.mhId}
            viewCount={row.viewCount}
            subscriberCount={row.subscriberCount}
            videoCount={row.videoCount}
            oauthStatus={row.oauthStatus}
            lastSync={row.lastSync}
            initialIdeas={row.ideas}
            generatedAt={row.ideasGeneratedAt}
            report={row.report}
          />
        ))}
      </div>
    </div>
  )
}
