import Link from 'next/link'
import { Sparkles, AlertOctagon, AlertTriangle, Info, ArrowRight, Hammer, Server, CheckCircle2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type Severity = 'critical' | 'warn' | 'info'

type Suggestion = {
  id: string
  severity: Severity
  category: 'build' | 'worker'
  title: string
  detail: string
  href?: string
  hrefLabel?: string
}

type BuildRow = {
  id: string
  name: string
  status: string
  progress_pct: number
  target_at: string | null
  last_update_at: string | null
  companies: { name: string | null } | null
}

type WorkerRow = {
  id: string
  display_name: string | null
  status: string | null
  desired_state: string | null
  controllable: boolean | null
  queue_depth: number | null
  last_error: string | null
  last_heartbeat: string | null
}

const DAY = 86_400_000
const STALE_MS = 90_000

const SEV_STYLE: Record<Severity, { ring: string; text: string; icon: typeof Info; label: string }> = {
  critical: { ring: 'border-red-500/30 bg-red-500/[0.06]',    text: 'text-red-400',    icon: AlertOctagon,  label: 'Kritiek' },
  warn:     { ring: 'border-amber-500/30 bg-amber-500/[0.06]', text: 'text-amber-400',  icon: AlertTriangle, label: 'Aandacht' },
  info:     { ring: 'border-sky-500/20 bg-sky-500/[0.05]',     text: 'text-sky-400',    icon: Info,          label: 'Tip' },
}

const SEV_WEIGHT: Record<Severity, number> = { critical: 0, warn: 1, info: 2 }

function analyzeBuilds(builds: BuildRow[]): Suggestion[] {
  const now = Date.now()
  const out: Suggestion[] = []

  for (const b of builds) {
    if (b.status === 'live') continue
    const company = b.companies?.name ?? ''
    const ctx = company ? ` (${company})` : ''
    const href = `/dashboard/build-tracker/${b.id}`

    // Overdue deadline
    if (b.target_at && new Date(b.target_at).getTime() < now) {
      const daysOver = Math.floor((now - new Date(b.target_at).getTime()) / DAY)
      out.push({
        id: `b-overdue-${b.id}`,
        severity: 'critical',
        category: 'build',
        title: `Deadline verstreken: ${b.name}${ctx}`,
        detail: `${daysOver} dag(en) over de deadline en nog op ${b.progress_pct}% (status ${b.status}). Herplan of rond af.`,
        href, hrefLabel: 'Open build',
      })
      continue
    }

    // Stalled — building maar lang geen update
    if (b.status === 'building' && b.last_update_at) {
      const idle = Math.floor((now - new Date(b.last_update_at).getTime()) / DAY)
      if (idle >= 7) {
        out.push({
          id: `b-stalled-${b.id}`,
          severity: 'warn',
          category: 'build',
          title: `Geen voortgang: ${b.name}${ctx}`,
          detail: `${idle} dagen geen update terwijl status "in bouw" is (${b.progress_pct}%). Ga verder of pauzeer expliciet.`,
          href, hrefLabel: 'Ga verder',
        })
        continue
      }
    }

    // Deadline nadert met lage voortgang
    if (b.target_at) {
      const daysLeft = Math.floor((new Date(b.target_at).getTime() - now) / DAY)
      if (daysLeft >= 0 && daysLeft <= 14 && b.progress_pct < 60) {
        out.push({
          id: `b-risk-${b.id}`,
          severity: 'warn',
          category: 'build',
          title: `Risico op deadline: ${b.name}${ctx}`,
          detail: `Nog ${daysLeft} dag(en) tot deadline maar pas ${b.progress_pct}% voltooid. Prioriteer of schaal capaciteit op.`,
          href, hrefLabel: 'Open build',
        })
        continue
      }
    }
  }

  // Te veel parallelle builds "in bouw" → focusverlies
  const building = builds.filter((b) => b.status === 'building')
  if (building.length >= 5) {
    out.push({
      id: 'b-wip',
      severity: 'info',
      category: 'build',
      title: `${building.length} builds tegelijk in bouw`,
      detail: 'Hoge WIP verlaagt doorlooptijd. Overweeg er een paar te focussen en de rest op "gepland" te zetten.',
      href: '/dashboard/build-tracker', hrefLabel: 'Build Tracker',
    })
  }

  return out
}

function analyzeWorkers(workers: WorkerRow[]): Suggestion[] {
  const now = Date.now()
  const out: Suggestion[] = []
  const ctrlHref = '/dashboard/operations/worker-control'

  for (const w of workers) {
    const name = w.display_name || w.id

    if (w.last_error) {
      out.push({
        id: `w-err-${w.id}`,
        severity: 'critical',
        category: 'worker',
        title: `Worker met fout: ${name}`,
        detail: `Laatste fout: ${w.last_error.slice(0, 160)}`,
        href: ctrlHref, hrefLabel: 'Herstart worker',
      })
      continue
    }

    const stale = !w.last_heartbeat || now - new Date(w.last_heartbeat).getTime() > STALE_MS
    if (w.controllable && w.desired_state !== 'stopped' && stale) {
      out.push({
        id: `w-stale-${w.id}`,
        severity: 'warn',
        category: 'worker',
        title: `Geen heartbeat: ${name}`,
        detail: 'Worker zou moeten draaien maar stuurt geen heartbeat. Herstart aanbevolen.',
        href: ctrlHref, hrefLabel: 'Herstart worker',
      })
      continue
    }

    if ((w.queue_depth ?? 0) >= 5) {
      out.push({
        id: `w-queue-${w.id}`,
        severity: 'warn',
        category: 'worker',
        title: `Diepe queue: ${name}`,
        detail: `${w.queue_depth} taken in wachtrij. Overweeg een extra worker of herverdeling.`,
        href: ctrlHref, hrefLabel: 'Worker Control',
      })
    }
  }
  return out
}

export default async function AIOptimizerPage() {
  const supabase = await createClient()

  const [buildsRes, workersRes] = await Promise.all([
    supabase
      .from('build_tracker')
      .select('id, name, status, progress_pct, target_at, last_update_at, companies(name)')
      .order('target_at', { ascending: true, nullsFirst: false }),
    supabase
      .from('worker_registry')
      .select('id, display_name, status, desired_state, controllable, queue_depth, last_error, last_heartbeat'),
  ])

  const builds = (buildsRes.data ?? []) as unknown as BuildRow[]
  const workers = (workersRes.data ?? []) as WorkerRow[]

  const suggestions = [...analyzeBuilds(builds), ...analyzeWorkers(workers)]
    .sort((a, b) => SEV_WEIGHT[a.severity] - SEV_WEIGHT[b.severity])

  const counts = {
    critical: suggestions.filter((s) => s.severity === 'critical').length,
    warn: suggestions.filter((s) => s.severity === 'warn').length,
    info: suggestions.filter((s) => s.severity === 'info').length,
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
          <Sparkles size={16} className="text-violet-400" />
        </div>
        <div>
          <h1 className="text-base font-semibold text-white">AI Optimizer</h1>
          <p className="text-xs text-white/50">Analyseert builds &amp; workers en stelt concrete optimalisaties voor</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {([
          { key: 'critical', label: 'Kritiek', value: counts.critical, color: 'text-red-400', border: 'border-red-500/20' },
          { key: 'warn', label: 'Aandacht', value: counts.warn, color: 'text-amber-400', border: 'border-amber-500/20' },
          { key: 'info', label: 'Tips', value: counts.info, color: 'text-sky-400', border: 'border-sky-500/20' },
        ] as const).map((s) => (
          <div key={s.key} className={`bg-white/[0.06] border ${s.border} rounded-xl p-4`}>
            <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-[11px] text-white/50 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {suggestions.length === 0 ? (
        <div className="py-16 text-center bg-white/[0.02] border border-dashed border-white/10 rounded-xl">
          <CheckCircle2 size={28} className="text-emerald-400/60 mx-auto mb-3" />
          <p className="text-[12px] text-white/50">Geen knelpunten gevonden — builds en workers zijn gezond.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {suggestions.map((s) => {
            const st = SEV_STYLE[s.severity]
            const Icon = st.icon
            const CatIcon = s.category === 'build' ? Hammer : Server
            return (
              <div key={s.id} className={`flex items-start gap-3 rounded-xl border p-4 ${st.ring}`}>
                <Icon size={16} className={`${st.text} mt-0.5 flex-shrink-0`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[9px] font-semibold uppercase tracking-wide ${st.text}`}>{st.label}</span>
                    <span className="flex items-center gap-1 text-[9px] text-white/35"><CatIcon size={9} />{s.category}</span>
                  </div>
                  <p className="text-[13px] text-white/90 font-medium mt-0.5 leading-tight">{s.title}</p>
                  <p className="text-[11px] text-white/55 mt-1 leading-snug">{s.detail}</p>
                </div>
                {s.href && (
                  <Link
                    href={s.href}
                    className="flex-shrink-0 inline-flex items-center gap-1 text-[11px] text-white/70 hover:text-white border border-white/10 hover:bg-white/[0.06] rounded-lg px-2.5 py-1.5 transition-colors"
                  >
                    {s.hrefLabel ?? 'Open'} <ArrowRight size={11} />
                  </Link>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
