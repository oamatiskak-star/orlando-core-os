import { notFound } from 'next/navigation'
import { Radar, MapPin, TrendingUp, Target, ArrowLeft, ExternalLink, Calculator } from 'lucide-react'
import { getAcqDealById } from '@/lib/supabase/acquisition'
import { createClient } from '@/lib/supabase/server'

function fmt(n: number | null) {
  if (!n) return '—'
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)
}

const PIPELINE_COLORS: Record<string, string> = {
  radar: 'text-sky-400 bg-sky-500/10',
  analyse: 'text-amber-400 bg-amber-500/10',
  due_diligence: 'text-violet-400 bg-violet-500/10',
  bod: 'text-orange-400 bg-orange-500/10',
  gewonnen: 'text-emerald-400 bg-emerald-500/10',
  verloren: 'text-red-400 bg-red-500/10',
}

export default async function DealDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const deal = await getAcqDealById(id)
  if (!deal) notFound()

  const supabase = await createClient()
  const { data: scores } = await supabase
    .from('acq_deal_scores')
    .select('*')
    .eq('deal_id', id)
    .order('scored_at', { ascending: false })
    .limit(5)

  const financials = [
    { label: 'Vraagprijs', value: fmt(deal.asking_price) },
    { label: 'Geschatte Waarde', value: fmt(deal.estimated_value) },
    { label: 'ROI', value: deal.roi_pct ? `${deal.roi_pct.toFixed(1)}%` : '—' },
    { label: 'Marge', value: deal.margin_pct ? `${deal.margin_pct.toFixed(1)}%` : '—' },
    { label: 'Winst Prognose', value: fmt(deal.profit_est) },
    { label: 'Oppervlak', value: deal.area_m2 ? `${deal.area_m2} m²` : '—' },
  ]

  return (
    <div className="space-y-5 max-w-4xl">
      {/* Header */}
      <div>
        <a href="/dashboard/acquisition/deals" className="flex items-center gap-1 text-xs text-white/40 hover:text-white/70 mb-3 w-fit">
          <ArrowLeft size={12} /> Terug naar DealRadar
        </a>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mt-0.5">
              <Radar size={16} className="text-indigo-400" />
            </div>
            <div>
              <h1 className="text-base font-semibold text-white">{deal.title}</h1>
              <div className="flex items-center gap-2 mt-1">
                {deal.address && <span className="text-xs text-white/50">{deal.address}</span>}
                {deal.city && <span className="text-xs text-white/30">· {deal.city}</span>}
                {deal.province && <span className="text-xs text-white/30">· {deal.province}</span>}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className={`px-2 py-1 rounded-lg text-xs font-medium ${PIPELINE_COLORS[deal.pipeline_stage] ?? 'text-white/40 bg-white/5'}`}>
              {deal.pipeline_stage}
            </span>
            {deal.source_url && (
              <a href={deal.source_url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1 px-2 py-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs text-white/50 transition-colors">
                <ExternalLink size={11} /> Bron
              </a>
            )}
            <a href={`/dashboard/calculaties?deal_id=${deal.id}&title=${encodeURIComponent(deal.title)}`}
              className="flex items-center gap-1 px-2 py-1 bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/20 rounded-lg text-xs text-indigo-400 transition-colors">
              <Calculator size={11} /> SterkCalc
            </a>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Financials */}
        <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
          <p className="text-xs text-white/50 font-medium uppercase tracking-wide mb-3">Financieel</p>
          <div className="grid grid-cols-2 gap-3">
            {financials.map(f => (
              <div key={f.label}>
                <p className="text-[11px] text-white/40">{f.label}</p>
                <p className="text-sm font-semibold text-white mt-0.5">{f.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* AI Score */}
        <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
          <p className="text-xs text-white/50 font-medium uppercase tracking-wide mb-3">AI Analyse</p>
          <div className="flex items-center gap-4 mb-3">
            <div className="text-center">
              <p className="text-[11px] text-white/40 mb-1">AI Score</p>
              <div className={`w-14 h-14 rounded-full border-2 flex items-center justify-center ${
                (deal.ai_score ?? 0) >= 70 ? 'border-emerald-500/40' :
                (deal.ai_score ?? 0) >= 40 ? 'border-amber-500/40' :
                deal.ai_score !== null ? 'border-red-500/40' : 'border-white/10'
              }`}>
                <span className={`text-lg font-bold ${
                  (deal.ai_score ?? 0) >= 70 ? 'text-emerald-400' :
                  (deal.ai_score ?? 0) >= 40 ? 'text-amber-400' :
                  deal.ai_score !== null ? 'text-red-400' : 'text-white/20'
                }`}>{deal.ai_score ?? '—'}</span>
              </div>
            </div>
            <div className="text-center">
              <p className="text-[11px] text-white/40 mb-1">Risico</p>
              <div className={`w-14 h-14 rounded-full border-2 flex items-center justify-center ${
                (deal.risk_score ?? 0) <= 30 ? 'border-emerald-500/40' :
                (deal.risk_score ?? 0) <= 60 ? 'border-amber-500/40' :
                deal.risk_score !== null ? 'border-red-500/40' : 'border-white/10'
              }`}>
                <span className={`text-lg font-bold ${
                  (deal.risk_score ?? 0) <= 30 ? 'text-emerald-400' :
                  (deal.risk_score ?? 0) <= 60 ? 'text-amber-400' :
                  deal.risk_score !== null ? 'text-red-400' : 'text-white/20'
                }`}>{deal.risk_score ?? '—'}</span>
              </div>
            </div>
          </div>
          {scores && scores.length > 0 && (
            <div className="text-[11px] text-white/40 bg-white/[0.02] border border-white/5 rounded-lg p-3">
              <p className="font-medium text-white/60 mb-1">Laatste AI analyse</p>
              <p className="text-white/50 line-clamp-3">{scores[0].reasoning}</p>
            </div>
          )}
          {(!scores || scores.length === 0) && (
            <p className="text-[11px] text-white/30 text-center py-2">Nog geen AI analyse uitgevoerd</p>
          )}
        </div>
      </div>

      {/* Object details */}
      <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
        <p className="text-xs text-white/50 font-medium uppercase tracking-wide mb-3">Object Details</p>
        <div className="flex flex-wrap gap-3">
          {deal.object_type && <InfoChip label="Type" value={deal.object_type} />}
          {deal.deal_type && <InfoChip label="Deal type" value={deal.deal_type} />}
          {deal.build_year && <InfoChip label="Bouwjaar" value={String(deal.build_year)} />}
          {deal.energy_label && <InfoChip label="Energielabel" value={deal.energy_label} />}
          {deal.source && <InfoChip label="Bron" value={deal.source} />}
        </div>
      </div>

      {/* Notes */}
      {deal.notes && (
        <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
          <p className="text-xs text-white/50 font-medium uppercase tracking-wide mb-2">Notities</p>
          <p className="text-sm text-white/70 whitespace-pre-wrap">{deal.notes}</p>
        </div>
      )}
    </div>
  )
}

function InfoChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-2">
      <p className="text-[10px] text-white/30">{label}</p>
      <p className="text-xs font-medium text-white/80 mt-0.5 capitalize">{value}</p>
    </div>
  )
}
