// Media War Room — Winner Engine + Revenue-confidence + Operator-status.
// Pure TS, projecteert lagen op de bestaande Creative Graph zonder migratie-afhankelijkheid.
// Werkt op de payload die v_war_room_nodes al levert; migratie 162 verdiept de payload
// (engagement, kanaal-revenue, platform-metrics, failure_reason) maar is niet vereist.
//
// Harde regels (Orlando):
//  - Geen mock data. Ontbreekt data → null → UI toont "Geen data".
//  - Winner Score = Performance Score + Commercial Score (commercial weegt zwaarder).
//  - Views alleen mogen NOOIT WINNER+ opleveren als commerciële data ontbreekt (cap = RUNNER UP).
//  - Revenue confidence verplicht zichtbaar.

import type { WarRoomRawNode, WarRoomNodeType } from './graph'

export type WinnerStatus =
  | 'top_1pct' | 'top_5pct' | 'winner' | 'runner_up'
  | 'underperforming' | 'loser' | 'insufficient_data'

export type OperatorStatus =
  | 'waiting' | 'processing' | 'blocked' | 'failed'
  | 'human_review' | 'live' | 'verified_live' | 'unknown'

export type NodeScore = {
  performance_score: number | null   // 0..100 (percentiel binnen peer-set), null = geen perf-data
  commercial_score: number | null    // 0..100, null = geen commerciële data
  winner_score: number | null        // 0..100 gecombineerd, null = onvoldoende data
  winner_status: WinnerStatus
  has_commercial: boolean            // is er échte revenue/conversie-data?
  revenue_confidence: number         // 0..1 — hoeveel van de funnel echt gekoppeld is
  operator_status: OperatorStatus
  failure_reason: string | null
  // ruwe, opgerolde waarden voor de Performance-rij (null = Geen data)
  views: number | null
  ctr_pct: number | null
  watchtime_min: number | null
  retention_pct: number | null
  subscribers: number | null
  revenue_eur: number | null
  engagement_pct: number | null
}

// ── helpers ───────────────────────────────────────────────────────────────────
function numOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

function pget(node: WarRoomRawNode, key: string): unknown {
  return node.payload ? node.payload[key] : undefined
}

// percentiel (0..100) van value binnen een gesorteerde peer-array (lager..hoger)
function percentileOf(value: number, sorted: number[]): number {
  if (sorted.length <= 1) return 50
  let below = 0
  for (const v of sorted) if (v < value) below++
  return Math.round((below / (sorted.length - 1)) * 100)
}

// ── Operator-status afleiding ──────────────────────────────────────────────────
const FAILED = ['failed', 'unrecoverable', 'error', 'rejected']
const BLOCKED = ['blocked', 'paused', 'on_hold', 'killed']
const REVIEW = ['manual_review_required', 'human_review', 'needs_review', 'review']
const PROCESSING = ['uploading', 'processing', 'rendering', 'preparing', 'verifying', 'normalizing', 'queued', 'pending']
const VERIFIED = ['verified_live']
const LIVE = ['published', 'live', 'ready', 'uploaded']

export function deriveOperator(status: string | null): OperatorStatus {
  if (!status) return 'waiting'
  const s = status.toLowerCase()
  if (VERIFIED.includes(s)) return 'verified_live'
  if (LIVE.includes(s)) return 'live'
  if (FAILED.includes(s)) return 'failed'
  if (REVIEW.includes(s)) return 'human_review'
  if (BLOCKED.includes(s)) return 'blocked'
  if (PROCESSING.includes(s)) return 'processing'
  return 'unknown'
}

export const OPERATOR_LABEL: Record<OperatorStatus, string> = {
  waiting: 'WAITING', processing: 'PROCESSING', blocked: 'BLOCKED', failed: 'FAILED',
  human_review: 'HUMAN REVIEW', live: 'LIVE', verified_live: 'VERIFIED LIVE', unknown: 'ONBEKEND',
}

export const OPERATOR_COLOR: Record<OperatorStatus, string> = {
  waiting: '#64748b', processing: '#f59e0b', blocked: '#a855f7', failed: '#ef4444',
  human_review: '#f97316', live: '#22c55e', verified_live: '#10b981', unknown: '#475569',
}

export const WINNER_LABEL: Record<WinnerStatus, string> = {
  top_1pct: 'TOP 1%', top_5pct: 'TOP 5%', winner: 'WINNER', runner_up: 'RUNNER UP',
  underperforming: 'UNDERPERFORMING', loser: 'LOSER', insufficient_data: 'GEEN DATA',
}

export const WINNER_COLOR: Record<WinnerStatus, string> = {
  top_1pct: '#10b981', top_5pct: '#22c55e', winner: '#84cc16', runner_up: '#f59e0b',
  underperforming: '#f97316', loser: '#ef4444', insufficient_data: '#475569',
}

// ── opgerolde metrics per node ──────────────────────────────────────────────────
type Rollup = {
  views: number | null; ctr: number | null; retention: number | null
  watchtime: number | null; subscribers: number | null
  revenue: number | null; engagement: number | null
  conversions: number | null
}

function emptyRollup(): Rollup {
  return { views: null, ctr: null, retention: null, watchtime: null, subscribers: null, revenue: null, engagement: null, conversions: null }
}

function avg(vals: (number | null)[]): number | null {
  const f = vals.filter((v): v is number => v !== null)
  return f.length ? f.reduce((a, b) => a + b, 0) / f.length : null
}
function sum(vals: (number | null)[]): number | null {
  const f = vals.filter((v): v is number => v !== null)
  return f.length ? f.reduce((a, b) => a + b, 0) : null
}

// directe metrics uit de payload van een creative- of platform-node
function leafMetrics(node: WarRoomRawNode): Rollup {
  const r = emptyRollup()
  r.views = numOrNull(pget(node, 'views'))
  r.ctr = numOrNull(pget(node, 'ctr_pct'))
  r.retention = numOrNull(pget(node, 'retention_pct'))
  r.watchtime = numOrNull(pget(node, 'watchtime_min'))            // 162-verdieping; nu meestal null
  r.engagement = numOrNull(pget(node, 'engagement_pct'))          // 162-verdieping
  r.subscribers = numOrNull(pget(node, 'subscribers'))            // 162-verdieping (kanaal)
  // revenue: payload.revenue (metric) of revenue_attributed (content_item)
  r.revenue = numOrNull(pget(node, 'revenue')) ?? numOrNull(pget(node, 'revenue_attributed'))
  r.conversions = numOrNull(pget(node, 'conversions'))            // 162-verdieping
  return r
}

/**
 * Bereken Winner Score + lagen voor alle nodes.
 * Roll-up: creative-metrics → hook → channel → campaign. Percentielen per node_type.
 */
export function computeScores(nodes: WarRoomRawNode[]): Map<string, NodeScore> {
  const byId = new Map(nodes.map((n) => [n.node_id, n]))
  const childrenOf = new Map<string, string[]>()
  for (const n of nodes) {
    if (n.parent_id) {
      if (!childrenOf.has(n.parent_id)) childrenOf.set(n.parent_id, [])
      childrenOf.get(n.parent_id)!.push(n.node_id)
    }
  }

  // 1) opgerolde metrics per node (memoized, bottom-up via recursie)
  const rollup = new Map<string, Rollup>()
  function rollFor(id: string): Rollup {
    if (rollup.has(id)) return rollup.get(id)!
    const node = byId.get(id)!
    const kids = childrenOf.get(id) ?? []
    let r: Rollup
    if (node.node_type === 'creative' || node.node_type === 'platform') {
      r = leafMetrics(node)
    } else {
      // aggregeer over kinderen
      const childRolls = kids.map(rollFor)
      r = {
        views: sum(childRolls.map((c) => c.views)),
        ctr: avg(childRolls.map((c) => c.ctr)),
        retention: avg(childRolls.map((c) => c.retention)),
        watchtime: avg(childRolls.map((c) => c.watchtime)),
        revenue: sum(childRolls.map((c) => c.revenue)),
        engagement: avg(childRolls.map((c) => c.engagement)),
        conversions: sum(childRolls.map((c) => c.conversions)),
        subscribers: numOrNull(pget(node, 'subscribers')) ?? sum(childRolls.map((c) => c.subscribers)),
      }
      // kanaal: eigen view-score (current_views_10d) als fallback voor views,
      // en eigen kanaal-omzet (youtube estimated_revenue, migr. 162) als fallback voor revenue
      if (node.node_type === 'channel') {
        if (r.views === null) r.views = numOrNull(pget(node, 'current_views_10d')) ?? numOrNull(node.score)
        if (r.revenue === null) r.revenue = numOrNull(pget(node, 'channel_revenue'))
      }
      // hook: eigen score als perf-proxy als kinderen niets hebben
      if (node.node_type === 'hook' && r.ctr === null && node.score != null) {
        r.ctr = null // hook-score is geen CTR; laten we niet faken
      }
    }
    rollup.set(id, r)
    return r
  }
  for (const n of nodes) rollFor(n.node_id)

  // 2) peer-distributies per node_type voor performance & commercial
  const perfPeers = new Map<WarRoomNodeType, number[]>()
  const commPeers = new Map<WarRoomNodeType, number[]>()
  const perfRaw = new Map<string, number | null>()
  const commRaw = new Map<string, number | null>()

  for (const n of nodes) {
    const r = rollup.get(n.node_id)!
    // performance-grondtal = combinatie van beschikbare perf-signalen (genormaliseerd via percentiel later)
    const perfSignals = [r.views, r.ctr, r.retention, r.engagement].filter((v): v is number => v !== null)
    const perf = perfSignals.length ? perfSignals.reduce((a, b) => a + b, 0) / perfSignals.length : null
    // commercial-grondtal = revenue (zwaar) + conversies
    const commSignals: number[] = []
    if (r.revenue !== null) commSignals.push(r.revenue)
    if (r.conversions !== null) commSignals.push(r.conversions)
    const comm = commSignals.length ? commSignals.reduce((a, b) => a + b, 0) : null

    perfRaw.set(n.node_id, perf)
    commRaw.set(n.node_id, comm)
    if (perf !== null) {
      if (!perfPeers.has(n.node_type)) perfPeers.set(n.node_type, [])
      perfPeers.get(n.node_type)!.push(perf)
    }
    if (comm !== null && comm > 0) {
      if (!commPeers.has(n.node_type)) commPeers.set(n.node_type, [])
      commPeers.get(n.node_type)!.push(comm)
    }
  }
  for (const arr of perfPeers.values()) arr.sort((a, b) => a - b)
  for (const arr of commPeers.values()) arr.sort((a, b) => a - b)

  // 3) per node: scores + status
  const out = new Map<string, NodeScore>()
  for (const n of nodes) {
    const r = rollup.get(n.node_id)!
    const perf = perfRaw.get(n.node_id) ?? null
    const comm = commRaw.get(n.node_id) ?? null
    const hasCommercial = comm !== null && comm > 0

    const perfPeerArr = perfPeers.get(n.node_type) ?? []
    const commPeerArr = commPeers.get(n.node_type) ?? []
    const performance_score = perf !== null && perfPeerArr.length >= 1 ? percentileOf(perf, perfPeerArr) : null
    const commercial_score = hasCommercial ? percentileOf(comm!, commPeerArr) : null

    // winner_score: commercial weegt zwaarder (0.6) dan performance (0.4)
    let winner_score: number | null = null
    if (performance_score !== null && commercial_score !== null) {
      winner_score = Math.round(0.4 * performance_score + 0.6 * commercial_score)
    } else if (performance_score !== null) {
      winner_score = performance_score
    } else if (commercial_score !== null) {
      winner_score = commercial_score
    }

    // status met peer-grootte-guards en commercial-cap (condition 9)
    const n_peers = perfPeerArr.length
    let winner_status: WinnerStatus
    if (winner_score === null || n_peers < 4) {
      winner_status = 'insufficient_data'
    } else {
      const p = winner_score
      if (p >= 99 && n_peers >= 50) winner_status = 'top_1pct'
      else if (p >= 95 && n_peers >= 20) winner_status = 'top_5pct'
      else if (p >= 75) winner_status = 'winner'
      else if (p >= 50) winner_status = 'runner_up'
      else if (p >= 25) winner_status = 'underperforming'
      else winner_status = 'loser'
      // CONDITION 9: zonder echte commerciële data nooit hoger dan RUNNER UP
      if (!hasCommercial && (winner_status === 'winner' || winner_status === 'top_5pct' || winner_status === 'top_1pct')) {
        winner_status = 'runner_up'
      }
    }

    // revenue confidence: hoeveel funnel-schakels écht gekoppeld zijn
    let conf = 0
    if (r.views !== null && r.views > 0) conf += 0.34         // traffic gekoppeld
    if (r.conversions !== null && r.conversions > 0) conf += 0.33 // lead/conversie gekoppeld
    if (r.revenue !== null && r.revenue > 0) conf += 0.33      // omzet gekoppeld
    const revenue_confidence = Math.min(1, Math.round(conf * 100) / 100)

    const operator_status = deriveOperator(n.status)
    const failure_reason =
      (pget(n, 'failure_reason') as string | undefined) ??
      (pget(n, 'error') as string | undefined) ?? null

    out.set(n.node_id, {
      performance_score, commercial_score, winner_score, winner_status,
      has_commercial: hasCommercial, revenue_confidence,
      operator_status, failure_reason,
      views: r.views, ctr_pct: r.ctr, watchtime_min: r.watchtime, retention_pct: r.retention,
      subscribers: r.subscribers, revenue_eur: r.revenue, engagement_pct: r.engagement,
    })
  }
  return out
}
