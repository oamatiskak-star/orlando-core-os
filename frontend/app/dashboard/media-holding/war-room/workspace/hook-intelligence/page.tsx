import { createClient } from '@/lib/supabase/server'
import HookIntelligence, { type HookRow, type CatPerf } from '@/components/war-room/HookIntelligence'
import { nowMs } from '@/lib/war-room/clock'

export const dynamic = 'force-dynamic'

export default async function HookIntelligencePage() {
  const supabase = await createClient()
  const [rowsRes, perfRes] = await Promise.all([
    // presterende hooks eerst (views), plus recente; gecapt voor de client
    supabase.from('v_hook_classified')
      .select('id, youtube_video_id, title, thumbnail_url, niche, category, views, ctr, retention, revenue, hook_score, winner_status, confidence, at')
      .order('views', { ascending: false }).limit(600),
    supabase.from('v_hook_category_perf').select('*'),
  ])

  if (rowsRes.error) {
    return <div className="rounded-lg border border-amber-400/20 bg-amber-500/[0.06] p-4 text-sm text-amber-200/80">Hook Intelligence view nog niet toegepast (migratie 169). Geen data beschikbaar.</div>
  }
  const rows = (rowsRes.data ?? []) as HookRow[]
  const catPerf = (perfRes.data ?? []) as CatPerf[]

  return (
    <div className="space-y-3">
      <p className="text-xs text-white/45">
        Hook Intelligence — niet &quot;welke video won&quot; maar &quot;waarom won deze hook&quot;. Live titels uit youtube_videos,
        geclassificeerd in 14 psychologische categorieën, met echte performance per niche/periode.
      </p>
      <HookIntelligence rows={rows} catPerf={catPerf} nowMs={nowMs()} />
    </div>
  )
}
