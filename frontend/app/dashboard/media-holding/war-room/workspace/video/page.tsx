import { createClient } from '@/lib/supabase/server'
import VideoStudio, { type VideoRow } from '@/components/war-room/VideoStudio'
import { computeScores } from '@/lib/war-room/scoring'
import type { WarRoomRawNode } from '@/lib/war-room/graph'

export const dynamic = 'force-dynamic'

export default async function VideoStudioPage() {
  const supabase = await createClient()
  const { data, error } = await supabase.from('v_war_room_nodes').select('*')
  const rawNodes = (data ?? []) as WarRoomRawNode[]

  if (error) {
    return <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-300">Fout: {error.message}</div>
  }

  const byId = new Map(rawNodes.map((n) => [n.node_id, n]))
  const scores = computeScores(rawNodes)
  const channelOf = (id: string): string | null => {
    let cur: string | null = id
    while (cur) {
      const n = byId.get(cur); if (!n) break
      if (n.node_type === 'channel') return n.label
      cur = n.parent_id
    }
    return null
  }

  const rows: VideoRow[] = rawNodes
    .filter((n) => n.node_type === 'creative')
    .map((n) => {
      const s = scores.get(n.node_id)
      return {
        id: n.node_id.replace(/^creative:/, ''),
        name: n.label ?? 'Video',
        kind: (n.payload?.kind as string | undefined) ?? null,
        channel: channelOf(n.node_id),
        thumb: (n.payload?.thumbnail_concept as string | undefined) ?? null,
        winner: s?.winner_status ?? null,
        views: s?.views ?? null,
        ctr: s?.ctr_pct ?? null,
        retention: s?.retention_pct ?? null,
        revenue: s?.revenue_eur ?? null,
      }
    })

  return (
    <div className="space-y-3">
      <p className="text-xs text-white/45">Video Studio — per video preview, script, voice/muziek, retention curve en Hermes-analyse. Ontbrekend = &quot;Geen data beschikbaar&quot;.</p>
      {rows.length === 0
        ? <div className="rounded-lg border border-white/10 bg-[#0e1525] p-6 text-sm text-white/50">Nog geen video&apos;s in de fabriek.</div>
        : <VideoStudio rows={rows} />}
    </div>
  )
}
