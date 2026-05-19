import { createAdminClient } from '@/lib/supabase/admin'
import { TrendingUp, CheckCircle, AlertCircle, XCircle } from 'lucide-react'
import GrowthClient from './GrowthClient'

export const revalidate = 0

const CHANNELS = [
  'VermogenTv', 'SpaarTv', 'VastgoedTv',
  'CryptoVermogen', 'BeleggingsTv', 'PropertyInvestorTv',
]

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

export default async function GrowthPage() {
  const admin = createAdminClient()
  const since7d = new Date(Date.now() - 7 * 86_400_000).toISOString()

  const [
    { data: scores },
    { data: channels },
  ] = await Promise.all([
    admin.from('youtube_quality_scores')
      .select('id, channel_id, total_score, verdict, feedback, created_at, youtube_upload_queue(title, channel_id)')
      .gte('created_at', since7d)
      .order('created_at', { ascending: false })
      .limit(100),
    admin.from('youtube_channels')
      .select('id, naam, research_ideas')
      .in('naam', CHANNELS)
      .order('naam'),
  ])

  const publishCount = (scores ?? []).filter(s => s.verdict === 'publish').length
  const improveCount = (scores ?? []).filter(s => s.verdict === 'improve').length
  const rejectCount  = (scores ?? []).filter(s => s.verdict === 'reject').length

  const channelMap = new Map((channels ?? []).map(c => [c.naam, c]))

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
          <TrendingUp size={16} className="text-emerald-400" />
        </div>
        <div>
          <h1 className="text-base font-semibold text-white">Growth & Kwaliteit</h1>
          <p className="text-[11px] text-white/40">AI kwaliteitsscoring + virale research per kanaal</p>
        </div>
      </div>

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
            {(scores ?? []).map((s: any) => {
              const title = s.youtube_upload_queue?.title ?? '(geen titel)'
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

      {/* Research ideeën per kanaal */}
      <div className="space-y-3">
        <h2 className="text-[11px] font-semibold text-white/40 uppercase tracking-wide">
          Virale video-ideeën per kanaal
        </h2>
        {CHANNELS.map(naam => {
          const ch = channelMap.get(naam)
          const ideas: any[] = ch?.research_ideas?.ideas ?? []
          const generatedAt: string | null = ch?.research_ideas?.generated_at ?? null
          return (
            <GrowthClient
              key={naam}
              channelNaam={naam}
              channelId={ch?.id ?? null}
              initialIdeas={ideas}
              generatedAt={generatedAt}
            />
          )
        })}
      </div>
    </div>
  )
}
