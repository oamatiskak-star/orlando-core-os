import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import {
  ShieldCheck, ChevronLeft, AlertTriangle, TrendingDown,
  Activity, Clock, DollarSign, AlertCircle, CheckCircle2,
  FileText, ChevronRight,
} from 'lucide-react'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type Run = {
  id: string
  started_at: string
  completed_at: string | null
  status: string
  triggered_by: string
  totals: {
    health_score?: number
    findings_total?: number
    findings_critical?: number
    findings_high?: number
    scenarios_total?: number
    scenarios_passed?: number
    scenarios_failed?: number
    approvals_opened?: number
  } | null
  summary: string | null
  ai_cost_usd: number | null
  report_path: string | null
}

type Finding = {
  id: string
  run_id: string
  severity: string
  category: string
  affected_route: string | null
  affected_country: string | null
  affected_tier: string | null
  affected_billing_cycle: string | null
  affected_device: string | null
  confidence_score: number
  revenue_impact_eur_estimate: number
  evidence_summary: string
  recommended_fix: string
  created_at: string
  approval_id: string | null
}

type QueueRow = {
  id: string
  rank: number
  priority_score: number
  fix_status: string
  finding_id: string
}

const SEVERITY_CFG: Record<string, { label: string; color: string; bg: string; rank: number }> = {
  critical: { label: 'KRIT',   color: 'text-red-300',     bg: 'bg-red-500/15 border-red-500/30',     rank: 1 },
  high:     { label: 'HOOG',   color: 'text-orange-300',  bg: 'bg-orange-500/15 border-orange-500/30', rank: 2 },
  medium:   { label: 'MED',    color: 'text-yellow-300',  bg: 'bg-yellow-500/15 border-yellow-500/30', rank: 3 },
  low:      { label: 'LAAG',   color: 'text-blue-300',    bg: 'bg-blue-500/10 border-blue-500/20',     rank: 4 },
  info:     { label: 'INFO',   color: 'text-white/55',    bg: 'bg-white/[0.04] border-white/[0.08]',   rank: 5 },
}

const CATEGORY_SHORT: Record<string, string> = {
  vat_anomaly: 'VAT',
  conversion_blocker: 'Conv. blok',
  ux_friction: 'UX',
  locale_issue: 'Locale',
  mobile_render: 'Mobile',
  safari_issue: 'Safari',
  payment_dropoff: 'Payment',
  webhook_latency: 'Webhook lat',
  retry_failure: 'Retry',
  missing_country: 'Mis. country',
  missing_tier: 'Mis. tier',
  pricing_inconsistency: 'Pricing',
  currency_mismatch: 'Currency',
  accessibility: 'A11y',
  legal_compliance: 'Legal',
  db_sync_failure: 'DB sync',
  stripe_misconfiguration: 'Stripe cfg',
  tax_behavior_anomaly: 'Tax beh.',
  session_expired_handling: 'Session exp',
}

function fmtDateTime(s: string | null) {
  if (!s) return '—'
  return new Date(s).toLocaleString('nl-NL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function fmtEur(n: number) {
  return n.toLocaleString('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
}

function durationStr(start: string, end: string | null): string {
  if (!end) return '—'
  const ms = new Date(end).getTime() - new Date(start).getTime()
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.round(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s`
}

export default async function AuditPage() {
  const supabase = await createClient()

  const [{ data: runsData }, { data: latestRunRow }] = await Promise.all([
    supabase
      .from('aquier_audit_runs')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(10),
    supabase
      .from('aquier_audit_runs')
      .select('id')
      .eq('status', 'completed')
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  const runs = (runsData ?? []) as Run[]
  const latestRunId = latestRunRow?.id as string | undefined

  let findings: Finding[] = []
  let queue: QueueRow[] = []
  if (latestRunId) {
    const [{ data: findingsData }, { data: queueData }] = await Promise.all([
      supabase
        .from('aquier_audit_findings')
        .select('*')
        .eq('run_id', latestRunId)
        .order('revenue_impact_eur_estimate', { ascending: false }),
      supabase
        .from('aquier_audit_priority_queue')
        .select('id,rank,priority_score,fix_status,finding_id')
        .order('rank', { ascending: true })
        .limit(20),
    ])
    findings = (findingsData ?? []) as Finding[]
    queue = (queueData ?? []) as QueueRow[]
  }

  // Sort findings by severity rank, then revenue desc
  findings.sort((a, b) => {
    const ra = SEVERITY_CFG[a.severity]?.rank ?? 99
    const rb = SEVERITY_CFG[b.severity]?.rank ?? 99
    if (ra !== rb) return ra - rb
    return b.revenue_impact_eur_estimate - a.revenue_impact_eur_estimate
  })

  const latestRun = runs[0] ?? null
  const completedRuns = runs.filter(r => r.status === 'completed')
  const totalCost = completedRuns.reduce((sum, r) => sum + (r.ai_cost_usd ?? 0), 0)
  const totalRevenueAtRisk = findings.reduce((sum, f) => sum + f.revenue_impact_eur_estimate, 0)
  const criticalCount = findings.filter(f => f.severity === 'critical').length
  const highCount = findings.filter(f => f.severity === 'high').length
  const approvalsOpened = findings.filter(f => f.approval_id !== null).length

  const KPI_CARDS = [
    {
      label: 'Health Score',
      value: latestRun?.totals?.health_score != null ? `${latestRun.totals.health_score}/100` : '—',
      icon: ShieldCheck,
      color: (latestRun?.totals?.health_score ?? 100) < 50
        ? 'text-red-400' : (latestRun?.totals?.health_score ?? 100) < 80 ? 'text-yellow-400' : 'text-emerald-400',
      bg: (latestRun?.totals?.health_score ?? 100) < 50
        ? 'bg-red-500/10 border-red-500/20' : (latestRun?.totals?.health_score ?? 100) < 80 ? 'bg-yellow-500/10 border-yellow-500/20' : 'bg-emerald-500/10 border-emerald-500/20',
    },
    {
      label: 'Revenue at Risk /mo',
      value: totalRevenueAtRisk > 0 ? fmtEur(totalRevenueAtRisk) : '€ 0',
      icon: TrendingDown,
      color: totalRevenueAtRisk > 100_000 ? 'text-red-400' : totalRevenueAtRisk > 10_000 ? 'text-orange-400' : 'text-white/55',
      bg: totalRevenueAtRisk > 100_000 ? 'bg-red-500/10 border-red-500/20' : totalRevenueAtRisk > 10_000 ? 'bg-orange-500/10 border-orange-500/20' : 'bg-white/[0.04] border-white/[0.06]',
    },
    {
      label: 'Critical / High',
      value: `${criticalCount} / ${highCount}`,
      icon: AlertTriangle,
      color: criticalCount > 0 ? 'text-red-400' : highCount > 0 ? 'text-orange-400' : 'text-emerald-400',
      bg: criticalCount > 0 ? 'bg-red-500/10 border-red-500/20' : highCount > 0 ? 'bg-orange-500/10 border-orange-500/20' : 'bg-emerald-500/10 border-emerald-500/20',
    },
    {
      label: 'Approvals Open',
      value: String(approvalsOpened),
      icon: CheckCircle2,
      color: approvalsOpened > 0 ? 'text-fuchsia-400' : 'text-white/55',
      bg: approvalsOpened > 0 ? 'bg-fuchsia-500/10 border-fuchsia-500/20' : 'bg-white/[0.04] border-white/[0.06]',
    },
  ]

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard/aquier" className="text-white/40 hover:text-white/70">
          <ChevronLeft size={16} />
        </Link>
        <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
          <ShieldCheck size={16} className="text-indigo-400" />
        </div>
        <div className="flex-1">
          <h1 className="text-base font-semibold text-white">Checkout Audit</h1>
          <p className="text-xs text-white/50">
            Live audits van aquier.com — Playwright + Stripe + Claude AI
            {latestRun && ` · laatste run ${fmtDateTime(latestRun.started_at)}`}
          </p>
        </div>
        <Link
          href="/dashboard/aquier/approvals"
          className="px-3 py-1.5 rounded-lg bg-fuchsia-500/10 border border-fuchsia-500/20 text-[11px] text-fuchsia-300 hover:bg-fuchsia-500/15"
        >
          {approvalsOpened > 0 ? `${approvalsOpened} pending approvals` : 'approvals →'}
        </Link>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {KPI_CARDS.map(card => {
          const Icon = card.icon
          return (
            <div key={card.label} className="bg-white/[0.06] border border-white/5 rounded-xl p-4 flex flex-col gap-3">
              <div className={`w-8 h-8 rounded-lg border flex items-center justify-center ${card.bg}`}>
                <Icon size={15} className={card.color} />
              </div>
              <div>
                <p className={`text-xl font-bold ${card.color} leading-none`}>{card.value}</p>
                <p className="text-[11px] text-white/50 mt-1">{card.label}</p>
              </div>
            </div>
          )
        })}
      </div>

      {/* Runs table */}
      <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[13px] font-semibold text-white">Recente runs</h2>
          <span className="text-[10px] text-white/40">Totaal kosten 10 runs: ${totalCost.toFixed(2)}</span>
        </div>
        {runs.length === 0 ? (
          <p className="text-[11px] text-white/30 py-6 text-center">Nog geen audit runs</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="text-white/40 border-b border-white/[0.06]">
                  <th className="text-left py-2 font-normal">Tijd</th>
                  <th className="text-left py-2 font-normal">Status</th>
                  <th className="text-left py-2 font-normal">Trigger</th>
                  <th className="text-right py-2 font-normal">Duur</th>
                  <th className="text-right py-2 font-normal">Scenarios</th>
                  <th className="text-right py-2 font-normal">Findings</th>
                  <th className="text-right py-2 font-normal">Health</th>
                  <th className="text-right py-2 font-normal">Cost</th>
                </tr>
              </thead>
              <tbody>
                {runs.map(r => {
                  const t = r.totals ?? {}
                  const health = t.health_score
                  const healthColor = health == null ? 'text-white/40' : health < 50 ? 'text-red-400' : health < 80 ? 'text-yellow-400' : 'text-emerald-400'
                  const statusBadge =
                    r.status === 'completed' ? 'bg-emerald-500/15 text-emerald-400'
                    : r.status === 'running' ? 'bg-blue-500/15 text-blue-400 animate-pulse'
                    : r.status === 'failed' ? 'bg-red-500/15 text-red-400'
                    : 'bg-white/[0.05] text-white/50'
                  return (
                    <tr key={r.id} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                      <td className="py-2 text-white/70">{fmtDateTime(r.started_at)}</td>
                      <td className="py-2"><span className={`text-[9px] px-1.5 py-0.5 rounded uppercase font-semibold ${statusBadge}`}>{r.status}</span></td>
                      <td className="py-2 text-white/50 font-mono text-[10px]">{r.triggered_by}</td>
                      <td className="py-2 text-right text-white/55">{durationStr(r.started_at, r.completed_at)}</td>
                      <td className="py-2 text-right text-white/55">
                        {t.scenarios_total != null
                          ? <span>{t.scenarios_passed ?? 0}/{t.scenarios_total}</span>
                          : '—'}
                      </td>
                      <td className="py-2 text-right">
                        {t.findings_total != null ? (
                          <span className="text-white/70">
                            {(t.findings_critical ?? 0) > 0 && <span className="text-red-400">●{t.findings_critical}</span>}
                            {(t.findings_high ?? 0) > 0 && <span className="text-orange-400 ml-1">●{t.findings_high}</span>}
                            <span className="ml-1">{t.findings_total}</span>
                          </span>
                        ) : '—'}
                      </td>
                      <td className={`py-2 text-right font-medium ${healthColor}`}>{health ?? '—'}</td>
                      <td className="py-2 text-right text-white/50">${(r.ai_cost_usd ?? 0).toFixed(2)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Findings — latest run */}
      {findings.length > 0 && (
        <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[13px] font-semibold text-white">Findings — laatste voltooide run</h2>
            <span className="text-[10px] text-white/40">{findings.length} bevindingen · gesorteerd op severity + revenue</span>
          </div>
          <div className="space-y-2">
            {findings.map(f => {
              const sev = SEVERITY_CFG[f.severity] ?? SEVERITY_CFG.info
              const cat = CATEGORY_SHORT[f.category] ?? f.category
              return (
                <div key={f.id} className={`border rounded-xl p-3 ${sev.bg}`}>
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 flex flex-col items-center gap-1 w-16">
                      <span className={`text-[9px] font-bold ${sev.color} uppercase`}>{sev.label}</span>
                      <span className="text-[8px] text-white/40 uppercase">{cat}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 text-[10px] text-white/50 flex-wrap">
                        <span className="font-mono">{f.affected_route ?? '?'}</span>
                        {f.affected_country && f.affected_country !== 'all' && <span className="text-cyan-400">{f.affected_country}</span>}
                        {f.affected_country === 'all' && <span className="text-fuchsia-400">all-countries</span>}
                        {f.affected_tier && f.affected_tier !== 'all' && <span className="text-violet-400">{f.affected_tier}</span>}
                        {f.affected_billing_cycle && f.affected_billing_cycle !== 'all' && <span className="text-amber-400">{f.affected_billing_cycle}</span>}
                        <span className="text-white/30 ml-auto">conf {(f.confidence_score * 100).toFixed(0)}%</span>
                        {f.revenue_impact_eur_estimate > 0 && (
                          <span className={`font-bold ${sev.color}`}>{fmtEur(f.revenue_impact_eur_estimate)}/mo</span>
                        )}
                      </div>
                      <p className="text-[11.5px] text-white/80 leading-snug mb-1.5">{f.evidence_summary}</p>
                      <details className="mt-1">
                        <summary className="text-[10px] text-white/40 hover:text-white/60 cursor-pointer">Recommended fix</summary>
                        <p className="text-[10.5px] text-white/60 mt-1.5 leading-snug pl-2 border-l border-white/[0.08]">{f.recommended_fix}</p>
                      </details>
                      {f.approval_id && (
                        <div className="mt-2 flex items-center gap-1.5 text-[9px] text-fuchsia-300">
                          <CheckCircle2 size={10} />
                          <span>auto-approval opened</span>
                          <Link href="/dashboard/aquier/approvals" className="text-fuchsia-400 hover:text-fuchsia-200 underline ml-1">
                            naar approvals →
                          </Link>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Priority queue */}
      {queue.length > 0 && (
        <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[13px] font-semibold text-white">Priority Fix Queue</h2>
            <span className="text-[10px] text-white/40">{queue.length} items · severity × revenue × confidence</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="text-white/40 border-b border-white/[0.06]">
                  <th className="text-left py-2 font-normal w-10">#</th>
                  <th className="text-right py-2 font-normal">Score</th>
                  <th className="text-left py-2 font-normal">Status</th>
                  <th className="text-left py-2 font-normal">Finding</th>
                </tr>
              </thead>
              <tbody>
                {queue.map(q => (
                  <tr key={q.id} className="border-b border-white/[0.03]">
                    <td className="py-1.5 text-white/40 font-mono">{q.rank}</td>
                    <td className="py-1.5 text-right text-white/65 font-mono">{Math.round(q.priority_score)}</td>
                    <td className="py-1.5">
                      <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-white/[0.05] text-white/55">{q.fix_status}</span>
                    </td>
                    <td className="py-1.5 text-white/50 font-mono text-[10px]">{q.finding_id.slice(0, 8)}…</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty state if no data */}
      {runs.length === 0 && (
        <div className="py-12 text-center bg-white/[0.02] border border-dashed border-white/10 rounded-xl">
          <FileText size={28} className="text-white/15 mx-auto mb-3" />
          <p className="text-[12px] text-white/30">Geen audit runs gevonden</p>
          <p className="text-[10px] text-white/20 mt-1">
            Trigger handmatig via POST https://orlando-checkout-auditor.onrender.com/run<br />
            of wacht op de dagelijkse 04:00 NL cron run
          </p>
        </div>
      )}
    </div>
  )
}
