import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import {
  Gauge, ChevronLeft, TrendingUp, TrendingDown, Minus,
  CheckCircle2, AlertCircle, AlertTriangle, Info, Lightbulb,
} from 'lucide-react'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type Event = {
  id: string
  event_at: string
  severity: string
  category: string
  source_agent: string | null
  title: string
  detail: string | null
  metric_key: string | null
  metric_value: number | null
  metric_target: number | null
  variance_pct: number | null
  advice: string | null
  acknowledged: boolean
}

const SEVERITY_CFG: Record<string, { Icon: typeof Info; color: string; bg: string; label: string }> = {
  info:     { Icon: Info,           color: 'text-blue-400',    bg: 'bg-blue-500/8 border-blue-500/15',       label: 'INFO' },
  success:  { Icon: CheckCircle2,   color: 'text-emerald-400', bg: 'bg-emerald-500/8 border-emerald-500/15', label: 'OK' },
  warning:  { Icon: AlertCircle,    color: 'text-yellow-400',  bg: 'bg-yellow-500/8 border-yellow-500/15',   label: 'WARN' },
  error:    { Icon: AlertTriangle,  color: 'text-orange-400',  bg: 'bg-orange-500/8 border-orange-500/15',   label: 'ERR' },
  critical: { Icon: AlertTriangle,  color: 'text-red-400',     bg: 'bg-red-500/10 border-red-500/20',        label: 'KRIT' },
}

const CATEGORY_LABEL: Record<string, string> = {
  kpi: 'KPI', growth: 'Growth', engineering: 'Engineering', market: 'Markt',
  funding: 'Funding', risk: 'Risico', operations: 'Operations',
  ai: 'AI', customer: 'Klant', sales: 'Sales',
}

function fmtDateTime(s: string) {
  return new Date(s).toLocaleString('nl-NL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export default async function MonitorPage() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('aquier_monitor_events')
    .select('*')
    .order('event_at', { ascending: false })
    .limit(100)

  const events = (data ?? []) as Event[]
  const counts = {
    critical: events.filter(e => e.severity === 'critical').length,
    error:    events.filter(e => e.severity === 'error').length,
    warning:  events.filter(e => e.severity === 'warning').length,
    success:  events.filter(e => e.severity === 'success').length,
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/aquier" className="text-white/40 hover:text-white/70">
          <ChevronLeft size={16} />
        </Link>
        <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
          <Gauge size={16} className="text-blue-400" />
        </div>
        <div className="flex-1">
          <h1 className="text-base font-semibold text-white">Dagelijkse Monitoring & Advies</h1>
          <p className="text-xs text-white/50">KPI-deltas, alerts en aanbevelingen van AI agents</p>
        </div>
        <Link href="/dashboard/aquier/approvals" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs hover:bg-amber-500/15">
          Acteer via Approvals →
        </Link>
      </div>

      {/* Severity summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {(['critical', 'error', 'warning', 'success'] as const).map(s => {
          const cfg = SEVERITY_CFG[s]
          const Icon = cfg.Icon
          return (
            <div key={s} className={`border rounded-xl p-3.5 ${cfg.bg}`}>
              <div className="flex items-center gap-2 mb-1.5">
                <Icon size={13} className={cfg.color} />
                <span className={`text-[10px] uppercase font-bold ${cfg.color}`}>{cfg.label}</span>
              </div>
              <p className={`text-xl font-bold ${cfg.color}`}>{counts[s]}</p>
            </div>
          )
        })}
      </div>

      {/* Events */}
      <div className="space-y-2">
        <h2 className="text-[12px] font-semibold text-white/70">Recente Signalen</h2>
        {events.length === 0 ? (
          <div className="py-12 text-center bg-white/[0.02] border border-dashed border-white/10 rounded-xl">
            <Gauge size={28} className="text-white/15 mx-auto mb-3" />
            <p className="text-[12px] text-white/30">Nog geen events</p>
            <p className="text-[10px] text-white/20 mt-1">AI agents starten met monitoren vanaf maandag</p>
          </div>
        ) : (
          events.map(ev => {
            const cfg = SEVERITY_CFG[ev.severity] ?? SEVERITY_CFG.info
            const Icon = cfg.Icon
            const variance = ev.variance_pct
            const VarianceIcon = variance == null ? Minus : variance > 0 ? TrendingUp : TrendingDown
            const varianceColor = variance == null ? 'text-white/30' : variance > 0 ? 'text-emerald-400' : 'text-orange-400'

            return (
              <div key={ev.id} className={`border rounded-xl p-3.5 ${cfg.bg}`}>
                <div className="flex items-start gap-3">
                  <Icon size={14} className={`${cfg.color} mt-0.5 flex-shrink-0`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[9px] uppercase font-bold ${cfg.color}`}>{cfg.label}</span>
                      <span className="text-[9px] text-white/40 uppercase">{CATEGORY_LABEL[ev.category] ?? ev.category}</span>
                      {ev.source_agent && <span className="text-[9px] text-white/30 font-mono">{ev.source_agent}</span>}
                      <span className="text-[9px] text-white/30 ml-auto">{fmtDateTime(ev.event_at)}</span>
                    </div>
                    <p className="text-[12.5px] text-white/85 font-medium">{ev.title}</p>
                    {ev.detail && <p className="text-[11px] text-white/55 mt-1 leading-snug">{ev.detail}</p>}

                    {/* Metric block */}
                    {(ev.metric_key || variance != null) && (
                      <div className="flex items-center gap-3 mt-2 text-[10.5px]">
                        {ev.metric_key && (
                          <div className="flex items-center gap-1.5">
                            <span className="text-white/40">{ev.metric_key}:</span>
                            <span className="text-white/80 font-medium">{ev.metric_value}</span>
                            {ev.metric_target != null && <span className="text-white/35">/ {ev.metric_target}</span>}
                          </div>
                        )}
                        {variance != null && (
                          <div className={`flex items-center gap-1 ${varianceColor}`}>
                            <VarianceIcon size={11} />
                            <span className="font-medium">{variance > 0 ? '+' : ''}{variance.toFixed(1)}%</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Advice */}
                    {ev.advice && (
                      <div className="mt-2 flex items-start gap-2 p-2 rounded-lg bg-fuchsia-500/8 border border-fuchsia-500/15">
                        <Lightbulb size={11} className="text-fuchsia-400 mt-0.5 flex-shrink-0" />
                        <p className="text-[11px] text-fuchsia-300 leading-snug">{ev.advice}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
