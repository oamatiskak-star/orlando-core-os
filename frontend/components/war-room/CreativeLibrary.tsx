'use client'

import { useMemo, useState } from 'react'
import { Clapperboard, Megaphone, Tv2, Lightbulb, Send, Sparkles } from 'lucide-react'
import {
  type WarRoomRawNode, type WarRoomRawEdge, type WarRoomHermesRec,
} from '@/lib/war-room/graph'
import { computeScores, WINNER_LABEL, WINNER_COLOR, type NodeScore } from '@/lib/war-room/scoring'
import { recCategory, CATEGORY_LABEL, CATEGORY_COLOR, humanizeAction } from '@/lib/war-room/recommendations'
import CreativeDetailPanel from './CreativeDetailPanel'

const compact = (n: number) => Intl.NumberFormat('nl-NL', { notation: 'compact' }).format(n)
const eur = (n: number) => Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)

type CreativeRow = {
  id: string          // node_id, bv. "creative:<uuid>"
  contentId: string   // pure uuid voor de detail-API
  name: string
  campaign: string | null
  channel: string | null
  channelId: string | null
  hook: string | null
  platforms: string[]
  status: string | null
  thumbConcept: string | null
  score: NodeScore | undefined
}

export default function CreativeLibrary({
  rawNodes, rawEdges, hermesByChannel = {},
}: {
  rawNodes: WarRoomRawNode[]
  rawEdges: WarRoomRawEdge[]
  hermesByChannel?: Record<string, WarRoomHermesRec[]>
}) {
  const [campaignFilter, setCampaignFilter] = useState<string>('all')
  const [selected, setSelected] = useState<string | null>(null)

  const { rows, campaigns } = useMemo(() => {
    const byId = new Map(rawNodes.map((n) => [n.node_id, n]))
    const childrenOf = new Map<string, string[]>()
    for (const n of rawNodes) {
      if (n.parent_id) {
        if (!childrenOf.has(n.parent_id)) childrenOf.set(n.parent_id, [])
        childrenOf.get(n.parent_id)!.push(n.node_id)
      }
    }
    const scores = computeScores(rawNodes)

    const ancestorOfType = (id: string, type: string): WarRoomRawNode | null => {
      let cur: string | null = id
      while (cur) {
        const node = byId.get(cur)
        if (!node) break
        if (node.node_type === type) return node
        cur = node.parent_id
      }
      return null
    }

    const rows: CreativeRow[] = rawNodes
      .filter((n) => n.node_type === 'creative')
      .map((n) => {
        const campaign = ancestorOfType(n.node_id, 'campaign')
        const channel = ancestorOfType(n.node_id, 'channel')
        const hook = ancestorOfType(n.node_id, 'hook')
        const platforms = (childrenOf.get(n.node_id) ?? [])
          .map((cid) => byId.get(cid)).filter((x) => x?.node_type === 'platform')
          .map((x) => x!.platform ?? '').filter(Boolean)
        return {
          id: n.node_id,
          contentId: n.node_id.replace(/^creative:/, ''),
          name: n.label ?? 'Creative',
          campaign: campaign?.label ?? null,
          channel: channel?.label ?? null,
          channelId: n.channel_id,
          hook: hook?.label ?? (n.payload?.hook as string | undefined) ?? null,
          platforms,
          status: n.status,
          thumbConcept: (n.payload?.thumbnail_concept as string | undefined) ?? null,
          score: scores.get(n.node_id),
        }
      })

    const campaigns = Array.from(new Set(rawNodes.filter((n) => n.node_type === 'campaign').map((n) => n.label ?? ''))).filter(Boolean).sort()
    return { rows, campaigns }
  }, [rawNodes, rawEdges])

  const filtered = campaignFilter === 'all' ? rows : rows.filter((r) => r.campaign === campaignFilter)

  // Hermes-recs voor de rechter kolom (kanalen binnen de actieve campagne)
  const hermesRecs = useMemo(() => {
    const channelIds = new Set(filtered.map((r) => r.channelId).filter(Boolean) as string[])
    const out: WarRoomHermesRec[] = []
    for (const cid of channelIds) for (const r of hermesByChannel[cid] ?? []) out.push(r)
    return out.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0)).slice(0, 12)
  }, [filtered, hermesByChannel])

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-[180px_1fr_220px]">
      {/* LINKS — campagnestructuur */}
      <aside className="space-y-1">
        <div className="px-1 text-[10px] uppercase tracking-wide text-white/35">Campagnes</div>
        <button onClick={() => setCampaignFilter('all')}
          className={`flex w-full items-center gap-1.5 rounded px-2 py-1.5 text-left text-xs ${campaignFilter === 'all' ? 'bg-violet-500/15 text-violet-300' : 'text-white/55 hover:bg-white/[0.04]'}`}>
          <Megaphone size={12} /> Alle ({rows.length})
        </button>
        {campaigns.map((c) => {
          const n = rows.filter((r) => r.campaign === c).length
          return (
            <button key={c} onClick={() => setCampaignFilter(c)}
              className={`flex w-full items-center gap-1.5 rounded px-2 py-1.5 text-left text-xs capitalize ${campaignFilter === c ? 'bg-violet-500/15 text-violet-300' : 'text-white/55 hover:bg-white/[0.04]'}`}>
              <Megaphone size={12} /> <span className="truncate">{c}</span> <span className="ml-auto text-white/30">{n}</span>
            </button>
          )
        })}
      </aside>

      {/* MIDDEN — creative grid */}
      <div>
        {filtered.length === 0 ? (
          <div className="rounded-lg border border-white/10 bg-[#0e1525] p-6 text-sm text-white/50">Geen creatives in deze selectie.</div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((r) => {
              const s = r.score
              const wc = s ? WINNER_COLOR[s.winner_status] : '#475569'
              return (
                <button key={r.id} onClick={() => setSelected(r.contentId)}
                  className="flex flex-col rounded-lg border border-white/8 bg-[#0e1525] p-0 text-left transition-colors hover:border-white/20">
                  <div className="flex h-24 items-center justify-center rounded-t-lg bg-gradient-to-br from-cyan-500/15 to-violet-500/10 p-2 text-center text-[9px] leading-tight text-white/50 border-b border-white/5">
                    {r.thumbConcept ? <span className="line-clamp-4">{r.thumbConcept}</span> : <Clapperboard size={20} className="text-white/30" />}
                  </div>
                  <div className="p-2.5">
                    <div className="flex items-start justify-between gap-1">
                      <div className="text-[11px] font-semibold leading-tight text-white line-clamp-2">{r.name}</div>
                      {s && (
                        <span className="shrink-0 rounded px-1 py-0.5 text-[8px] font-bold uppercase" style={{ color: wc, background: `${wc}1a`, border: `1px solid ${wc}55` }}>
                          {WINNER_LABEL[s.winner_status]}
                        </span>
                      )}
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-1 text-[9px] text-white/40">
                      {r.campaign && <span className="inline-flex items-center gap-0.5 capitalize"><Megaphone size={9} />{r.campaign}</span>}
                      {r.channel && <span className="inline-flex items-center gap-0.5"><Tv2 size={9} />{r.channel}</span>}
                      {r.hook && <span className="inline-flex items-center gap-0.5"><Lightbulb size={9} /><span className="max-w-[80px] truncate">{r.hook}</span></span>}
                      {r.platforms.map((p, i) => <span key={i} className="inline-flex items-center gap-0.5"><Send size={9} />{p}</span>)}
                    </div>
                    <div className="mt-2 grid grid-cols-3 gap-1 border-t border-white/5 pt-1.5 text-center">
                      <div><div className="text-[7px] uppercase text-white/30">views</div><div className="text-[10px] font-semibold tabular-nums" style={{ color: s?.views != null ? '#fff' : 'rgba(255,255,255,0.25)' }}>{s?.views != null ? compact(s.views) : '—'}</div></div>
                      <div><div className="text-[7px] uppercase text-white/30">ctr</div><div className="text-[10px] font-semibold tabular-nums" style={{ color: s?.ctr_pct != null ? '#34d399' : 'rgba(255,255,255,0.25)' }}>{s?.ctr_pct != null ? `${s.ctr_pct}%` : '—'}</div></div>
                      <div><div className="text-[7px] uppercase text-white/30">rev</div><div className="text-[10px] font-semibold tabular-nums" style={{ color: s?.revenue_eur != null ? '#22c55e' : 'rgba(255,255,255,0.25)' }}>{s?.revenue_eur != null ? eur(s.revenue_eur) : '—'}</div></div>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* RECHTS — Hermes analyse (kanalen in selectie) */}
      <aside className="space-y-2">
        <div className="flex items-center gap-1.5 px-1 text-[10px] font-semibold uppercase tracking-wide text-violet-300">
          <Sparkles size={12} /> Hermes
        </div>
        {hermesRecs.length === 0 ? (
          <div className="rounded-lg border border-white/8 bg-[#0e1525] p-3 text-[11px] text-white/40">Geen aanbevelingen voor deze selectie.</div>
        ) : (
          hermesRecs.map((r) => {
            const cat = recCategory(r.action_kind)
            const c = CATEGORY_COLOR[cat]
            return (
              <div key={r.id} className="rounded-lg border border-white/8 bg-[#0e1525] p-2.5" title={r.rationale ?? undefined}>
                <div className="flex items-center gap-1.5">
                  <span className="rounded px-1 py-0.5 text-[8px] font-bold uppercase" style={{ color: c, background: `${c}1a` }}>{CATEGORY_LABEL[cat]}</span>
                  <span className="text-[10px] font-medium text-white/70">{humanizeAction(r.action_kind)}</span>
                </div>
                {r.rationale && <p className="mt-1 text-[9px] leading-snug text-white/45 line-clamp-3">{r.rationale}</p>}
              </div>
            )
          })
        )}
      </aside>

      {selected && <CreativeDetailPanel key={selected} creativeId={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
