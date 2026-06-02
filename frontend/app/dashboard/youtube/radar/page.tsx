import { Radar, Lightbulb, CheckCircle2, Megaphone } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import RadarClient, { type Idea } from './RadarClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function RadarPage() {
  const supabase = await createClient()

  const { data } = await supabase
    .from('content_radar_queue')
    .select('id, target_channel, niche, format, signal_relevance, title_draft, hook, rationale, source_competitor, priority, status, due_date')
    .neq('status', 'rejected')
    .order('priority', { ascending: false })
    .limit(200)

  const ideas = (data ?? []) as Idea[]

  const kpis = [
    { label: 'Open ideeën', value: ideas.filter((i) => i.status === 'idea').length, icon: Lightbulb, color: 'text-sky-400' },
    { label: 'Goedgekeurd', value: ideas.filter((i) => i.status === 'approved').length, icon: CheckCircle2, color: 'text-emerald-400' },
    { label: 'Uit viral-radar', value: ideas.filter((i) => i.signal_relevance === 'format_only').length, icon: Megaphone, color: 'text-violet-400' },
    { label: 'Kanalen', value: new Set(ideas.map((i) => i.target_channel)).size, icon: Radar, color: 'text-amber-400' },
  ]

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
          <Radar size={16} className="text-violet-400" />
        </div>
        <div>
          <h1 className="text-lg font-semibold text-white">Content-radar</h1>
          <p className="text-xs text-white/50">Concurrent- & viral-signalen → contentideeën per kanaal. Geplande engine (content-blok 18:30–22:00).</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
            <div className="flex items-center gap-2">
              <k.icon size={14} className={k.color} />
              <span className="text-xs text-white/50">{k.label}</span>
            </div>
            <div className="mt-1 text-2xl font-semibold text-white">{k.value}</div>
          </div>
        ))}
      </div>

      <RadarClient ideas={ideas} />
    </div>
  )
}
