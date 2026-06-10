import { createClient } from '@/lib/supabase/server'
import { Database, HardDrive, ListChecks, AlertOctagon, Server, Radar, Bot, Plug, Trash2 } from 'lucide-react'

export const dynamic = 'force-dynamic'

const mb = (b: number) => `${Math.round((b || 0) / 1048576 * 10) / 10} MB`
const ago = (s: number | null) => (s == null ? '—' : s < 60 ? `${s}s` : s < 3600 ? `${Math.round(s / 60)}m` : `${Math.round(s / 3600)}u`)

function tone(ok: boolean, warn = false) { return ok ? '#22c55e' : warn ? '#f59e0b' : '#ef4444' }

export default async function PlatformHealthPage() {
  const supabase = await createClient()
  const [stor, db, q, workers, agents, scrapers, integ, audit, jrun] = await Promise.all([
    supabase.from('v_ph_storage').select('*'),
    supabase.from('v_ph_db').select('*').limit(10),
    supabase.from('v_ph_queue').select('*'),
    supabase.from('v_ph_workers').select('*'),
    supabase.from('v_ph_agents').select('*'),
    supabase.from('v_ph_scrapers').select('*'),
    supabase.from('v_ph_integrations').select('*'),
    supabase.from('db_health_audits').select('*').order('ran_at', { ascending: false }).limit(1),
    supabase.from('janitor_runs').select('*').order('started_at', { ascending: false }).limit(1),
  ])

  const gated = stor.error || workers.error
  if (gated) {
    return <div className="rounded-lg border border-amber-400/20 bg-amber-500/[0.06] p-4 text-sm text-amber-200/80">Platform Health views nog niet toegepast (migratie 168). Geen data beschikbaar.</div>
  }

  const storRows = (stor.data ?? []) as { bucket: string; objects: number; bytes: number }[]
  const totalBytes = storRows.reduce((s, r) => s + Number(r.bytes || 0), 0)
  const qRows = (q.data ?? []) as { queue: string; total: number; by_status: Record<string, number> }[]
  const failed = qRows.reduce((s, r) => s + (Number(r.by_status?.failed || 0) + Number(r.by_status?.unrecoverable || 0) + Number(r.by_status?.manual_review_required || 0)), 0)
  const wRows = (workers.data ?? []) as { name: string; status: string; queue_depth: number; last_error: string | null; heartbeat_age_s: number | null }[]
  const aRows = (agents.data ?? []) as { name: string; status: string | null; error_count_24h: number | null; heartbeat_age_s: number | null }[]
  const sRows = (scrapers.data ?? []) as { source: string; enabled: boolean; engine_enabled: boolean | null }[]
  const iRows = (integ.data ?? []) as { provider: string; label: string; status: string }[]
  const a = (audit.data ?? [])[0] as { status: string; findings: Record<string, unknown>; ran_at: string } | undefined
  const jr = (jrun.data ?? [])[0] as { shift: string; status: string; started_at: string } | undefined

  return (
    <div className="space-y-3">
      <p className="text-xs text-white/45">Platform Health — DB · Storage · Queues · Workers · Scrapers · Agents · Integraties. Janitor draait flaggen-niet-wissen (migratie 168 + gated cron).</p>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {/* Storage */}
        <Panel icon={HardDrive} title="Storage Usage" right={mb(totalBytes)}>
          {storRows.slice(0, 6).map((r) => (
            <Row key={r.bucket} label={r.bucket} value={`${r.objects} · ${mb(r.bytes)}`} />
          ))}
        </Panel>

        {/* Database */}
        <Panel icon={Database} title="Database Health" right={`${(db.data ?? []).length} top-tabellen`}>
          {((db.data ?? []) as { table_name: string; total_bytes: number; dead_rows: number }[]).slice(0, 6).map((r) => (
            <Row key={r.table_name} label={r.table_name} value={`${mb(r.total_bytes)}${r.dead_rows > 10000 ? ` · ${r.dead_rows} dead` : ''}`} tone={r.dead_rows > 100000 ? '#f59e0b' : undefined} />
          ))}
        </Panel>

        {/* Queue */}
        <Panel icon={ListChecks} title="Queue Health">
          {qRows.map((r) => (
            <Row key={r.queue} label={r.queue} value={`${r.total} totaal`} sub={Object.entries(r.by_status ?? {}).map(([k, v]) => `${k}:${v}`).join(' · ')} />
          ))}
        </Panel>

        {/* Failed jobs */}
        <Panel icon={AlertOctagon} title="Failed Jobs" right={String(failed)} rightTone={tone(failed === 0, failed < 100)}>
          {failed === 0 ? <Muted text="Geen mislukte jobs" /> :
            qRows.map((r) => {
              const f = Number(r.by_status?.failed || 0) + Number(r.by_status?.unrecoverable || 0) + Number(r.by_status?.manual_review_required || 0)
              return f > 0 ? <Row key={r.queue} label={r.queue} value={`${f} failed/review`} tone="#ef4444" /> : null
            })}
        </Panel>

        {/* Workers */}
        <Panel icon={Server} title="Workers" right={`${wRows.length}`}>
          {wRows.length === 0 ? <Muted text="Geen data beschikbaar" /> :
            wRows.slice(0, 6).map((w) => (
              <Row key={w.name} label={w.name} value={w.status} sub={w.last_error ? `⚠ ${w.last_error.slice(0, 40)}` : `hb ${ago(w.heartbeat_age_s)}`}
                tone={tone((w.status ?? '').toLowerCase() === 'running' || (w.status ?? '').toLowerCase() === 'idle', true)} />
            ))}
        </Panel>

        {/* Scrapers */}
        <Panel icon={Radar} title="Scrapers" right={`${sRows.filter((s) => s.enabled).length}/${sRows.length} aan`}>
          {sRows.slice(0, 7).map((s) => (
            <Row key={s.source} label={s.source} value={s.enabled ? 'aan' : 'uit'} tone={s.enabled ? '#22c55e' : '#64748b'} />
          ))}
        </Panel>

        {/* Agents */}
        <Panel icon={Bot} title="Agents" right={`${aRows.length}`}>
          {aRows.length === 0 ? <Muted text="Geen data beschikbaar" /> :
            aRows.map((ag) => (
              <Row key={ag.name} label={ag.name} value={ag.status ?? 'onbekend'} sub={`${ag.error_count_24h ?? 0} err/24u · hb ${ago(ag.heartbeat_age_s)}`}
                tone={tone((ag.status ?? '').toLowerCase() === 'running', (ag.error_count_24h ?? 0) > 0)} />
            ))}
        </Panel>

        {/* Integrations */}
        <Panel icon={Plug} title="Integraties" right={`${iRows.filter((i) => i.status === 'connected' || i.status === 'active').length}/${iRows.length}`}>
          {iRows.slice(0, 8).map((i, idx) => (
            <Row key={idx} label={`${i.provider} · ${i.label}`} value={i.status} tone={tone(i.status === 'connected' || i.status === 'active', true)} />
          ))}
        </Panel>

        {/* Cleanup / Maintenance actions */}
        <Panel icon={Trash2} title="Cleanup Status">
          <Row label="Laatste janitor" value={jr ? `${jr.shift} · ${jr.status}` : 'Geen data'} tone={jr ? tone(jr.status === 'clean', jr.status === 'issues') : undefined} sub={jr ? new Date(jr.started_at).toLocaleString('nl-NL') : undefined} />
          <Row label="Laatste DB-audit" value={a ? a.status : 'Geen data'} tone={a ? tone(a.status === 'clean', a.status === 'issues') : undefined}
            sub={a ? Object.entries(a.findings ?? {}).filter(([k]) => k !== 'allow_delete').map(([k, v]) => `${k}:${v}`).join(' · ') : 'janitor (migratie 168) nog niet gedraaid'} />
        </Panel>
      </div>
    </div>
  )
}

function Panel({ icon: Icon, title, right, rightTone, children }: { icon: typeof Database; title: string; right?: string; rightTone?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-white/8 bg-[#0e1525] p-3">
      <div className="mb-2 flex items-center gap-1.5">
        <Icon size={13} className="text-white/50" />
        <span className="text-[11px] font-semibold uppercase tracking-wide text-white/60">{title}</span>
        {right && <span className="ml-auto text-[10px] font-semibold tabular-nums" style={{ color: rightTone ?? 'rgba(255,255,255,0.5)' }}>{right}</span>}
      </div>
      <div className="space-y-1">{children}</div>
    </div>
  )
}
function Row({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: string }) {
  return (
    <div className="flex items-start justify-between gap-2 border-t border-white/[0.04] pt-1 first:border-0 first:pt-0">
      <div className="min-w-0">
        <div className="truncate text-[10px] text-white/65">{label}</div>
        {sub && <div className="truncate text-[8px] text-white/35">{sub}</div>}
      </div>
      <span className="shrink-0 text-[10px] font-medium tabular-nums" style={{ color: tone ?? 'rgba(255,255,255,0.7)' }}>{value}</span>
    </div>
  )
}
function Muted({ text }: { text: string }) { return <div className="text-[10px] italic text-white/30">{text}</div> }
