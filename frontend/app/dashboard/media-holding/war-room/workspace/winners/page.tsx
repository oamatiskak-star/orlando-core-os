import { createClient } from '@/lib/supabase/server'
import WinnerIntelligence, { type WinnerRow } from '@/components/war-room/WinnerIntelligence'

export const dynamic = 'force-dynamic'

export default async function WinnerIntelligencePage() {
  const supabase = await createClient()
  const { data, error } = await supabase.from('v_winner_intelligence')
    .select('id, youtube_video_id, title, thumbnail_url, niche, category, views, ctr, retention, revenue, hook_score, winner_status, channel, length_bucket, duration_seconds, has_thumbnail, why_winner')
    .limit(60)

  if (error) {
    return <div className="rounded-lg border border-amber-400/20 bg-amber-500/[0.06] p-4 text-sm text-amber-200/80">Winner Intelligence view nog niet toegepast (migratie 169 + 170). Geen data beschikbaar.</div>
  }
  const rows = (data ?? []) as WinnerRow[]

  return (
    <div className="space-y-3">
      <p className="text-xs text-white/45">
        Winner Intelligence — waaróm winnaar: element-breakdown (hook · lengte · kanaal · niche · thumbnail) + verklaring.
        Knop &quot;Maak 50 variaties&quot; zet de winnende structuur in de wachtrij (CF2 produceert zodra aangezet).
      </p>
      <WinnerIntelligence rows={rows} />
    </div>
  )
}
