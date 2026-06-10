'use client'

import { useMemo, useState } from 'react'
import { Megaphone, Tv2, Send, Sparkles } from 'lucide-react'
import {
  type WarRoomRawNode, type WarRoomRawEdge, type WarRoomHermesRec,
} from '@/lib/war-room/graph'
import { computeScores, WINNER_LABEL, WINNER_COLOR, type NodeScore } from '@/lib/war-room/scoring'
import { recCategory, CATEGORY_LABEL, CATEGORY_COLOR, humanizeAction } from '@/lib/war-room/recommendations'
import { resolvePreview, type Preview } from '@/lib/war-room/preview'
import CreativePreview from './CreativePreview'
import CreativeDetailPanel from './CreativeDetailPanel'

const compact = (n: number) => Intl.NumberFormat('nl-NL', { notation: 'compact' }).format(n)
const eur = (n: number) => Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)

type CreativeRow = {
  id: string
  contentId: string
  name: string
  campaign: string | null
  channel: string | null
  channelId: string | null
  hook: string | null
  platforms: string[]
  status: string | null
  preview: Preview
  score: NodeScore | undefined
}

function statusTone(status: string | null): string {
  const s = (status ?? '').toLowerCase()
  if (['published', 'verified_live', 'live', 'ready'].includes(s)) return '#22c55e'
  if (['failed', 'unrecoverable', 'error', 'rejected'].includes(s)) return '#ef4444'
  if (['rendering', 'processing', 'uploading', 'pending', 'queued'].includes(s)) return '#f59e0b'
  return '#64748b'
}

export default function CreativeLibrary({
  rawNodes, hermesByChannel = {},
}: {
  rawNodes: WarRoomRawNode[]
  rawEdges?: WarRoomRawEdge[]
  hermesByChannel?: Record<string, WarRoomHermesRec[]>
}) {
  const [campaignFilter, setCampaignFilter] = useState<string>('all')
  const [selected, setSelected] = useState<string | null>(null)

  const { rows, campaigns, withPreview } = useMemo(() => {
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
      while (cur) { const node = byId.get(cur); if (!node) break; if (node.node_type === type) return node; cur = node.parent_id }
      return null
    }

    let withPreview = 0
    const rows: CreativeRow[] = rawNodes
      .filter((n) => n.node_type === 'creative')
      .map((n) => {
        const kids = (childrenOf.get(n.node_id) ?? []).map((cid) => byId.get(cid)).filter(Boolean) as WarRoomRawNode[]
        const platformKids = kids.filter((k) => k.node_type === 'platform')
        const ytKid = platformKids.find((k) => (k.platform ?? '').toLowerCase() === 'youtube' && k.payload?.platform_video_id)
        const youtubeId = (ytKid?.payload?.platform_video_id as string | undefined) ?? null
        const outputUrl = (n.payload?.output_url as string | undefined) ?? null
        const preview = resolvePreview(outputUrl, youtubeId)
        if (preview) withPreview++
        return {
          id: n.node_id,
          contentId: n.node_id.replace(/^creative:/, ''),
          name: n.label ?? 'Creative',
          campaign: ancestorOfType(n.node_id, 'campaign')?.label ?? null,
          channel: ancestorOfType(n.node_id, 'channel')?.label ?? null,
          channelId: n.channel_id,
          hook: ancestorOfType(n.node_id, 'hook')?.label ?? (n.payload?.hook as string | undefined) ?? null,
          platforms: platformKids.map((k) => k.platform ?? '').filter(Boolean),
          status: n.status,
          preview,
          score: scores.get(n.node_id),
        }
      })

    const campaigns = Array.from(new Set(rawNodes.filter((n) => n.node_type === 'campaign').map((n) => n.label ?? ''))).filter(Boolean).sort()
    return { rows, campaigns, withPreview }
  }, [rawNodes])

  const filtered = campaignFilter === 'all' ? rows : rows.filter((r) => r.campaign === campaignFilter)

  const hermesRecs = useMemo(() => {
    const channelIds = new Set(filtered.map((r) => r.channelId).filter(Boolean) as string[])
    const out: WarRoomHermesRec[] = []
    for (const cid of channelIds) for (const r of hermesByChannel[cid] ?? []) out.push(r)
    return out.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0)).slice(0, 12)
  }, [filtered, hermesByChannel])

  return (
    <div className="space-y-2">
      <div className="text-[10px] text-white/35">
        {withPreview}/{rows.length} creatives met echte preview · {rows.length - withPreview} zonder (geen gekoppelde video/thumbnail-bron).
      </div>
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

        {/* MIDDEN — visuele creative grid */}
        <div>
          {filtered.length === 0 ? (
            <div className="rounded-lg border border-white/10 bg-[#0e1525] p-6 text-sm text-white/50">Geen creatives in deze selectie.</div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
              {filtered.map((r) => {
                const s = r.score
                const wc = s ? WINNER_COLOR[s.winner_status] : '#475569'
                const conf = s ? Math.round(s.revenue_confidence * 100) : null
                const st = statusTone(r.status)
                return (
                  <button key={r.id} onClick={() => setSelected(r.contentId)}
                    className="group flex flex-col overflow-hidden rounded-lg border border-white/8 bg-[#0e1525] text-left transition-all hover:-translate-y-0.5 hover:border-white/25">
                    <div className="relative">
                      <CreativePreview preview={r.preview} ratio="portrait" />
                      {s && (
                        <span className="absolute left-1.5 top-1.5 rounded px-1.5 py-0.5 text-[8px] font-bold uppercase backdrop-blur-sm" style={{ color: wc, background: `${wc}26` }}>
                          {WINNER_LABEL[s.winner_status]}
                        </span>
                      )}
                      {r.status && (
                        <span className="absolute right-1.5 top-1.5 rounded px-1.5 py-0.5 text-[8px] font-semibold uppercase backdrop-blur-sm" style={{ color: st, background: `${st}26` }}>
                          {r.status}
                        </span>
                      )}
                    </div>
                    <div className="p-2.5">
                      <div className="text-[11px] font-semibold leading-tight text-white line-clamp-2">{r.name}</div>
                      {r.hook && <div className="mt-1 text-[9px] text-white/45 line-clamp-1">“{r.hook}”</div>}
                      <div className="mt-1.5 flex flex-wrap gap-1 text-[9px] text-white/40">
                        {r.campaign && <span className="inline-flex items-center gap-0.5 capitalize"><Megaphone size={9} />{r.campaign}</span>}
                        {r.channel && <span className="inline-flex items-center gap-0.5"><Tv2 size={9} />{r.channel}</span>}
                        {r.platforms.map((p, i) => <span key={i} className="inline-flex items-center gap-0.5"><Send size={9} />{p}</span>)}
                      </div>
                      <div className="mt-2 grid grid-cols-3 gap-1 border-t border-white/5 pt-1.5 text-center">
                        <Mini label="views" value={s?.views != null ? compact(s.views) : '—'} />
                        <Mini label="ctr" value={s?.ctr_pct != null ? `${s.ctr_pct}%` : '—'} color="#34d399" />
                        <Mini label="rev" value={s?.revenue_eur != null ? eur(s.revenue_eur) : '—'} color="#22c55e" />
                      </div>
                      <div className="mt-1 text-[8px] text-white/35">conf {conf != null ? `${conf}%` : '—'}{s && !s.has_commercial ? ' · geen omzetdata' : ''}</div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* RECHTS — Hermes */}
        <aside className="space-y-2">
          <div className="flex items-center gap-1.5 px-1 text-[10px] font-semibold uppercase tracking-wide text-violet-300"><Sparkles size={12} /> Hermes</div>
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
      </div>

      {selected && <CreativeDetailPanel key={selected} creativeId={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}

function Mini({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <div className="text-[7px] uppercase text-white/30">{label}</div>
      <div className="text-[10px] font-semibold tabular-nums" style={{ color: value === '—' ? 'rgba(255,255,255,0.25)' : color ?? '#fff' }}>{value}</div>
    </div>
  )
}
