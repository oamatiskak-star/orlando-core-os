import { createClient } from '@/lib/supabase/server'
import HookLibrary, { type HookRow, type HookCreative } from '@/components/war-room/HookLibrary'
import { computeScores } from '@/lib/war-room/scoring'
import { resolvePreview } from '@/lib/war-room/preview'
import type { WarRoomRawNode } from '@/lib/war-room/graph'

export const dynamic = 'force-dynamic'

export default async function HookLibraryPage() {
  const supabase = await createClient()
  const { data, error } = await supabase.from('v_war_room_nodes').select('*')
  const rawNodes = (data ?? []) as WarRoomRawNode[]
  if (error) {
    return <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-300">Fout: {error.message}</div>
  }

  const byId = new Map(rawNodes.map((n) => [n.node_id, n]))
  const childrenOf = new Map<string, string[]>()
  for (const n of rawNodes) {
    if (n.parent_id) { if (!childrenOf.has(n.parent_id)) childrenOf.set(n.parent_id, []); childrenOf.get(n.parent_id)!.push(n.node_id) }
  }
  const scores = computeScores(rawNodes)
  const channelLabel = (id: string): string | null => {
    let cur: string | null = id
    while (cur) { const n = byId.get(cur); if (!n) break; if (n.node_type === 'channel') return n.label; cur = n.parent_id }
    return null
  }
  const previewOf = (creativeNode: WarRoomRawNode) => {
    const platformKids = (childrenOf.get(creativeNode.node_id) ?? []).map((c) => byId.get(c)).filter((k) => k?.node_type === 'platform') as WarRoomRawNode[]
    const ytKid = platformKids.find((k) => (k.platform ?? '').toLowerCase() === 'youtube' && k.payload?.platform_video_id)
    const youtubeId = (creativeNode.payload?.youtube_video_id as string | undefined) ?? (ytKid?.payload?.platform_video_id as string | undefined) ?? null
    return resolvePreview((creativeNode.payload?.output_url as string | undefined) ?? null, youtubeId, (creativeNode.payload?.thumbnail_url as string | undefined) ?? null)
  }

  const hooks: HookRow[] = rawNodes
    .filter((n) => n.node_type === 'hook')
    .map((n) => {
      const s = scores.get(n.node_id)
      const creativeKids = (childrenOf.get(n.node_id) ?? []).map((c) => byId.get(c)).filter((k) => k?.node_type === 'creative') as WarRoomRawNode[]
      const creatives: HookCreative[] = creativeKids.map((c) => ({
        id: c.node_id.replace(/^creative:/, ''),
        name: c.label ?? 'Creative',
        preview: previewOf(c),
      }))
      return {
        id: n.node_id,
        text: n.label ?? '(zonder tekst)',
        channel: channelLabel(n.node_id),
        winner: s?.winner_status ?? null,
        score: n.score != null ? Number(n.score) : null,
        variantCount: (n.payload?.variant_count as number | undefined) ?? creatives.length,
        views: s?.views ?? null,
        ctr: s?.ctr_pct ?? null,
        revenue: s?.revenue_eur ?? null,
        creatives,
      }
    })
    .sort((a, b) => (b.views ?? 0) - (a.views ?? 0))

  return (
    <div className="space-y-3">
      <p className="text-xs text-white/45">Hook Library — reviewbaar: hook-tekst, gekoppelde creatives, performance, winner score en Hermes-advies (scale/rewrite/test/stop).</p>
      <HookLibrary hooks={hooks} />
    </div>
  )
}
