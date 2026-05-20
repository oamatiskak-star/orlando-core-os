import { BarChart3 } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'

type DealRow = { province: string | null; object_type: string | null; pipeline_stage: string; roi_pct: number | null }

function BarChart({ items, color }: { items: { label: string; value: number }[]; color: string }) {
  const max = Math.max(...items.map(i => i.value), 1)
  return (
    <div className="space-y-2">
      {items.map(item => (
        <div key={item.label} className="flex items-center gap-3">
          <span className="text-[11px] text-white/50 w-28 truncate text-right">{item.label}</span>
          <div className="flex-1 h-5 bg-white/5 rounded overflow-hidden">
            <div className={`h-full ${color} rounded transition-all`} style={{ width: `${(item.value / max) * 100}%` }} />
          </div>
          <span className="text-[11px] text-white/40 w-6 text-right">{item.value}</span>
        </div>
      ))}
    </div>
  )
}

export default async function AnalyticsPage() {
  const supabase = await createClient()
  const { data: deals } = await supabase
    .from('acq_deals')
    .select('province, object_type, pipeline_stage, roi_pct, ai_score, asking_price, created_at')
    .eq('status', 'actief')

  const d = (deals ?? []) as (DealRow & { ai_score: number | null; asking_price: number | null; created_at: string })[]

  // Per province
  const byProvince: Record<string, number> = {}
  for (const deal of d) if (deal.province) byProvince[deal.province] = (byProvince[deal.province] ?? 0) + 1
  const provinceItems = Object.entries(byProvince).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([label, value]) => ({ label, value }))

  // Per object type
  const byType: Record<string, number> = {}
  for (const deal of d) if (deal.object_type) byType[deal.object_type] = (byType[deal.object_type] ?? 0) + 1
  const typeItems = Object.entries(byType).sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value }))

  // Pipeline
  const byStage: Record<string, number> = {}
  for (const deal of d) byStage[deal.pipeline_stage] = (byStage[deal.pipeline_stage] ?? 0) + 1
  const stageItems = Object.entries(byStage).map(([label, value]) => ({ label, value }))

  // KPIs
  const roiVals = d.map(x => x.roi_pct).filter((v): v is number => v !== null)
  const scoreVals = d.map(x => x.ai_score).filter((v): v is number => v !== null)
  const avgRoi = roiVals.length ? (roiVals.reduce((a, b) => a + b, 0) / roiVals.length).toFixed(1) : '—'
  const avgScore = scoreVals.length ? Math.round(scoreVals.reduce((a, b) => a + b, 0) / scoreVals.length) : '—'
  const totalValue = d.reduce((s, x) => s + (x.asking_price ?? 0), 0)
  const wonDeals = d.filter(x => x.pipeline_stage === 'gewonnen').length
  const totalActive = d.filter(x => !['gewonnen', 'verloren'].includes(x.pipeline_stage)).length
  const convRate = totalActive > 0 ? ((wonDeals / (d.length || 1)) * 100).toFixed(1) : '—'

  // Last 30 days inflow
  const now = Date.now()
  const dayMs = 86400000
  const dailyCounts: Record<string, number> = {}
  for (const deal of d) {
    const daysAgo = Math.floor((now - new Date(deal.created_at).getTime()) / dayMs)
    if (daysAgo < 30) {
      const label = `Dag -${daysAgo}`
      dailyCounts[label] = (dailyCounts[label] ?? 0) + 1
    }
  }
  const timelineItems = Object.entries(dailyCounts).sort().map(([label, value]) => ({ label, value }))

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
          <BarChart3 size={16} className="text-purple-400" />
        </div>
        <div>
          <h1 className="text-base font-semibold text-white">Deal Analytics</h1>
          <p className="text-xs text-white/50">Performance overzicht acquisitie pipeline — {d.length} deals geanalyseerd</p>
        </div>
      </div>

      {d.length === 0 ? (
        <div className="bg-white/[0.02] border border-white/5 rounded-xl">
          <div className="flex flex-col items-center justify-center py-16 gap-2">
            <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center">
              <BarChart3 size={16} className="text-white/20" />
            </div>
            <p className="text-sm text-white/30">Geen data beschikbaar</p>
            <p className="text-xs text-white/20 text-center max-w-xs">Analytics worden automatisch berekend zodra er deals in de pipeline staan</p>
          </div>
        </div>
      ) : (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Totale Deals', value: String(d.length) },
              { label: 'Gem. ROI', value: `${avgRoi}%` },
              { label: 'Gem. AI Score', value: String(avgScore) },
              { label: 'Conversie Rate', value: `${convRate}%` },
            ].map(kpi => (
              <div key={kpi.label} className="bg-white/[0.03] border border-white/5 rounded-xl p-4">
                <p className="text-[11px] text-white/40">{kpi.label}</p>
                <p className="text-2xl font-bold text-white mt-1">{kpi.value}</p>
              </div>
            ))}
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
              <p className="text-xs text-white/50 font-medium uppercase tracking-wide mb-4">Deals per Provincie</p>
              {provinceItems.length > 0 ? (
                <BarChart items={provinceItems} color="bg-indigo-500/50" />
              ) : <p className="text-xs text-white/20 text-center py-4">Geen provinciedata</p>}
            </div>

            <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
              <p className="text-xs text-white/50 font-medium uppercase tracking-wide mb-4">Deals per Object Type</p>
              {typeItems.length > 0 ? (
                <BarChart items={typeItems} color="bg-amber-500/50" />
              ) : <p className="text-xs text-white/20 text-center py-4">Geen typedata</p>}
            </div>

            <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
              <p className="text-xs text-white/50 font-medium uppercase tracking-wide mb-4">Pipeline Verdeling</p>
              {stageItems.length > 0 ? (
                <BarChart items={stageItems} color="bg-violet-500/50" />
              ) : <p className="text-xs text-white/20 text-center py-4">Geen pipeline data</p>}
            </div>

            <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
              <p className="text-xs text-white/50 font-medium uppercase tracking-wide mb-4">Deal Inflow (laatste 30 dagen)</p>
              {timelineItems.length > 0 ? (
                <BarChart items={timelineItems} color="bg-emerald-500/50" />
              ) : <p className="text-xs text-white/20 text-center py-4">Geen recente inflow</p>}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
