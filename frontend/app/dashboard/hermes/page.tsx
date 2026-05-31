import {
  Brain, Factory, Video, KeyRound, Sparkles, GitBranch,
  CheckCircle2, AlertTriangle, XCircle, Clock,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import RefreshButton from './RefreshButton'

export const dynamic = 'force-dynamic'

// ── helpers ────────────────────────────────────────────────────────────────
function num(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + 'K'
  return String(n)
}
function kort(ts: string | null) {
  if (!ts) return '—'
  const d = new Date(ts)
  return d.toLocaleString('nl-NL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

type FactoryRow = { fabriek: string; bedrijf: string; projecten_totaal: number; live: number; in_aanbouw: number; deployen: number; gepland: number; gem_voortgang_pct: number }
type SummaryRow = { fase: string; aantal: number; door_oauth: number; door_bronbestand_weg: number; door_quota: number; door_render: number; laatste_activiteit: string | null }
type OAuthRow   = { kanaal: string; client_bron: string; echte_status: string; oauth_geblokkeerde_uploads: number; last_upload_at: string | null }
type FunnelRow  = { volgorde: number; laag: string; aantal: number; laatste: string | null }
type JanitorRow = { shift: string; status: string; started_at: string; dead_jobs_marked: number; stuck_claims_reset: number; stale_queued_flagged: number }
type AlertRow   = { dedup_key: string; severity: string; alert_type: string; titel: string; detail: string | null; count: number; last_seen_at: string; notified_at: string | null }
type StatusRow  = { laatste_run: string | null; open_critical: number; open_warning: number }
type LogRow     = { level: string; event: string; message: string | null; source: string | null; created_at: string }

const FASE_ORDE: Record<string, number> = {
  gepland: 1, in_wachtrij: 2, in_verwerking: 3, live: 4,
  aandacht_nodig: 5, mislukt: 6, afgeschreven: 7, geannuleerd: 8, overig: 9,
}
const FASE_KLEUR: Record<string, string> = {
  gepland: 'text-violet-400 border-violet-500/20 bg-violet-500/10',
  in_wachtrij: 'text-sky-400 border-sky-500/20 bg-sky-500/10',
  in_verwerking: 'text-indigo-400 border-indigo-500/20 bg-indigo-500/10',
  live: 'text-emerald-400 border-emerald-500/20 bg-emerald-500/10',
  aandacht_nodig: 'text-amber-400 border-amber-500/20 bg-amber-500/10',
  mislukt: 'text-red-400 border-red-500/20 bg-red-500/10',
  afgeschreven: 'text-white/40 border-white/10 bg-white/5',
  geannuleerd: 'text-white/30 border-white/10 bg-white/5',
  overig: 'text-white/40 border-white/10 bg-white/5',
}
function oauthBadge(s: string) {
  if (s === 'gezond')                          return { t: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', Icon: CheckCircle2, label: 'gezond' }
  if (s === 'reconnect_nodig_token_verlopen')  return { t: 'text-amber-400 bg-amber-500/10 border-amber-500/20',   Icon: Clock,        label: 'token verlopen' }
  if (s === 'reconnect_nodig_client_mismatch') return { t: 'text-red-400 bg-red-500/10 border-red-500/20',         Icon: XCircle,      label: 'client mismatch' }
  return { t: 'text-white/40 bg-white/5 border-white/10', Icon: AlertTriangle, label: s }
}
function janitorBadge(s: string) {
  if (s === 'clean')  return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
  if (s === 'issues') return 'text-amber-400 bg-amber-500/10 border-amber-500/20'
  if (s === 'alarm')  return 'text-red-400 bg-red-500/10 border-red-500/20'
  return 'text-white/40 bg-white/5 border-white/10'
}

export default async function HermesControlPage() {
  const supabase = await createClient()

  const [
    { data: factData },
    { data: sumData },
    { data: oauthData },
    { data: funnelData },
    { data: janitorData },
    { data: alertData },
    { data: statusData },
    { data: logData },
  ] = await Promise.all([
    supabase.from('v_ctl_factory_overview').select('*'),
    supabase.from('v_ctl_upload_summary').select('*'),
    supabase.from('v_ctl_oauth_health').select('kanaal, client_bron, echte_status, oauth_geblokkeerde_uploads, last_upload_at'),
    supabase.from('v_ctl_channel_funnel').select('*'),
    supabase.from('janitor_runs').select('shift, status, started_at, dead_jobs_marked, stuck_claims_reset, stale_queued_flagged').order('started_at', { ascending: false }).limit(6),
    supabase.from('v_ctl_hermes_alerts').select('*'),
    supabase.from('v_ctl_hermes_status').select('*').maybeSingle(),
    supabase.from('v_ctl_hermes_log').select('*').limit(40),
  ])

  const factories = ((factData ?? []) as FactoryRow[]).sort((a, b) => b.projecten_totaal - a.projecten_totaal)
  const summary   = ((sumData ?? []) as SummaryRow[]).sort((a, b) => (FASE_ORDE[a.fase] ?? 9) - (FASE_ORDE[b.fase] ?? 9))
  const oauth     = ((oauthData ?? []) as OAuthRow[]).sort((a, b) => b.oauth_geblokkeerde_uploads - a.oauth_geblokkeerde_uploads)
  const funnel    = ((funnelData ?? []) as FunnelRow[]).sort((a, b) => a.volgorde - b.volgorde)
  const janitor   = (janitorData ?? []) as JanitorRow[]
  const alerts    = ((alertData ?? []) as AlertRow[])
  const status    = (statusData ?? null) as StatusRow | null
  const botlog    = (logData ?? []) as LogRow[]

  const laatsteJanitor = janitor[0]
  const oauthProbleem  = oauth.filter(o => o.echte_status !== 'gezond').length
  const aandacht       = summary.find(s => s.fase === 'aandacht_nodig')?.aantal ?? 0

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-fuchsia-500/10 border border-fuchsia-500/20 flex items-center justify-center">
            <Brain size={16} className="text-fuchsia-400" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-white">Hermes — Controlelaag</h1>
            <p className="text-xs text-white/45">De echte stand over alle 7 fabrieken · live berekend, geen opgeslagen vlaggen</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <RefreshButton />
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-fuchsia-500/20 bg-fuchsia-500/10 text-fuchsia-300 text-xs">
            <Clock size={13} />
            <span>Hermes actief · {kort(status?.laatste_run ?? null)}</span>
          </div>
          {laatsteJanitor && (
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs ${janitorBadge(laatsteJanitor.status)}`}>
              <Sparkles size={13} />
              <span>Janitor: {laatsteJanitor.status} · {kort(laatsteJanitor.started_at)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Hermes alarmen — de ploegbaas slaat alarm */}
      {alerts.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-xs font-semibold text-white/60 flex items-center gap-2">
            <AlertTriangle size={13} /> Hermes alarmen ({alerts.length})
          </h2>
          <div className="space-y-2">
            {alerts.map(a => {
              const crit = a.severity === 'critical'
              return (
                <div key={a.dedup_key} className={`flex items-start gap-3 rounded-xl border p-3 ${crit ? 'border-red-500/25 bg-red-500/[0.07]' : 'border-amber-500/25 bg-amber-500/[0.07]'}`}>
                  {crit ? <XCircle size={16} className="text-red-400 mt-0.5 shrink-0" /> : <AlertTriangle size={16} className="text-amber-400 mt-0.5 shrink-0" />}
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm font-semibold ${crit ? 'text-red-300' : 'text-amber-300'}`}>{a.titel}</p>
                    {a.detail && <p className="text-xs text-white/55 mt-0.5">{a.detail}</p>}
                    <p className="text-[10px] text-white/30 mt-1">{a.alert_type} · sinds {kort(a.last_seen_at)}{a.notified_at ? ' · gepusht' : ''}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* Topsignalen */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white/[0.05] border border-fuchsia-500/20 rounded-xl p-4">
          <Factory size={14} className="text-fuchsia-400 mb-2" />
          <p className="text-xl font-bold tabular-nums text-white">{factories.length}</p>
          <p className="text-[11px] text-white/40 mt-0.5">Fabrieken</p>
        </div>
        <div className="bg-white/[0.05] border border-amber-500/20 rounded-xl p-4">
          <AlertTriangle size={14} className="text-amber-400 mb-2" />
          <p className="text-xl font-bold tabular-nums text-amber-400">{num(aandacht)}</p>
          <p className="text-[11px] text-white/40 mt-0.5">Uploads · aandacht nodig</p>
        </div>
        <div className="bg-white/[0.05] border border-red-500/20 rounded-xl p-4">
          <KeyRound size={14} className="text-red-400 mb-2" />
          <p className="text-xl font-bold tabular-nums text-red-400">{oauthProbleem}/{oauth.length}</p>
          <p className="text-[11px] text-white/40 mt-0.5">Kanalen · OAuth-probleem</p>
        </div>
        <div className="bg-white/[0.05] border border-emerald-500/20 rounded-xl p-4">
          <Video size={14} className="text-emerald-400 mb-2" />
          <p className="text-xl font-bold tabular-nums text-emerald-400">{num(summary.find(s => s.fase === 'live')?.aantal ?? 0)}</p>
          <p className="text-[11px] text-white/40 mt-0.5">Uploads · live</p>
        </div>
      </div>

      {/* Fabrieken */}
      <section className="space-y-2">
        <h2 className="text-xs font-semibold text-white/60 flex items-center gap-2"><Factory size={13} /> Fabrieken</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {factories.map(f => (
            <div key={f.fabriek} className="bg-white/[0.05] border border-white/10 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-sm font-semibold text-white">{f.bedrijf}</p>
                  <p className="text-[11px] text-white/35">{f.fabriek}</p>
                </div>
                <span className="text-lg font-bold tabular-nums text-white/80">{f.gem_voortgang_pct}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-white/10 overflow-hidden mb-3">
                <div className="h-full bg-fuchsia-400/70" style={{ width: `${Math.min(100, f.gem_voortgang_pct)}%` }} />
              </div>
              <div className="grid grid-cols-4 gap-1 text-center">
                <div><p className="text-sm font-bold tabular-nums text-emerald-400">{f.live}</p><p className="text-[10px] text-white/35">live</p></div>
                <div><p className="text-sm font-bold tabular-nums text-indigo-400">{f.in_aanbouw}</p><p className="text-[10px] text-white/35">bouw</p></div>
                <div><p className="text-sm font-bold tabular-nums text-violet-400">{f.gepland}</p><p className="text-[10px] text-white/35">gepland</p></div>
                <div><p className="text-sm font-bold tabular-nums text-white/70">{f.projecten_totaal}</p><p className="text-[10px] text-white/35">totaal</p></div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Upload-pipeline (single source of truth) */}
      <section className="space-y-2">
        <h2 className="text-xs font-semibold text-white/60 flex items-center gap-2"><Video size={13} /> YouTube upload-pipeline · één waarheid</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-2">
          {summary.map(s => {
            const kleur = FASE_KLEUR[s.fase] ?? FASE_KLEUR.overig
            const [tc] = kleur.split(' ')
            return (
              <div key={s.fase} className={`border rounded-xl p-3 ${kleur}`}>
                <p className={`text-lg font-bold tabular-nums ${tc}`}>{num(s.aantal)}</p>
                <p className="text-[10px] text-white/45 mt-0.5 capitalize">{s.fase.replace(/_/g, ' ')}</p>
                {s.door_oauth > 0 && <p className="text-[10px] text-red-300/80 mt-1">{s.door_oauth}× oauth</p>}
                {s.door_bronbestand_weg > 0 && <p className="text-[10px] text-white/35 mt-0.5">{s.door_bronbestand_weg}× bron weg</p>}
              </div>
            )
          })}
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* OAuth-gezondheid */}
        <section className="space-y-2">
          <h2 className="text-xs font-semibold text-white/60 flex items-center gap-2"><KeyRound size={13} /> OAuth-gezondheid · echte stand</h2>
          <div className="bg-white/[0.05] border border-white/10 rounded-xl divide-y divide-white/5">
            {oauth.map(o => {
              const b = oauthBadge(o.echte_status)
              const Icon = b.Icon
              return (
                <div key={o.kanaal} className="flex items-center justify-between px-4 py-2.5">
                  <div className="min-w-0">
                    <p className="text-sm text-white truncate">{o.kanaal}</p>
                    <p className="text-[10px] text-white/35">{o.client_bron === 'eigen_client' ? 'eigen client' : 'globale fallback'}{o.oauth_geblokkeerde_uploads > 0 ? ` · ${o.oauth_geblokkeerde_uploads} geblokkeerd` : ''}</p>
                  </div>
                  <span className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[11px] shrink-0 ${b.t}`}>
                    <Icon size={12} />{b.label}
                  </span>
                </div>
              )
            })}
          </div>
        </section>

        {/* Janitor + funnel */}
        <div className="space-y-3">
          <section className="space-y-2">
            <h2 className="text-xs font-semibold text-white/60 flex items-center gap-2"><Sparkles size={13} /> Janitor-rondes</h2>
            <div className="bg-white/[0.05] border border-white/10 rounded-xl divide-y divide-white/5">
              {janitor.length === 0 && <p className="px-4 py-3 text-xs text-white/35">Nog geen rondes.</p>}
              {janitor.map((j, i) => (
                <div key={i} className="flex items-center justify-between px-4 py-2.5">
                  <div>
                    <p className="text-sm text-white">{j.shift}</p>
                    <p className="text-[10px] text-white/35">{kort(j.started_at)} · {j.dead_jobs_marked} dood · {j.stale_queued_flagged} stale</p>
                  </div>
                  <span className={`px-2 py-1 rounded-lg border text-[11px] ${janitorBadge(j.status)}`}>{j.status}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="space-y-2">
            <h2 className="text-xs font-semibold text-white/60 flex items-center gap-2"><GitBranch size={13} /> Kanaal-funnel</h2>
            <div className="grid grid-cols-4 gap-2">
              {funnel.map(f => (
                <div key={f.laag} className="bg-white/[0.05] border border-white/10 rounded-xl p-3 text-center">
                  <p className="text-lg font-bold tabular-nums text-white">{f.aantal}</p>
                  <p className="text-[10px] text-white/40 mt-0.5">{f.laag.replace(/_/g, ' ')}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>

      {/* Centrale bot-log — alle bots loggen hier; samengevoegd met operations-Hermes */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold text-white/60 flex items-center gap-2"><Brain size={13} /> Centrale bot-log</h2>
          <a href="/dashboard/operations/hermes" className="text-[11px] text-fuchsia-300/80 hover:text-fuchsia-200">Operations-Hermes →</a>
        </div>
        <div className="bg-white/[0.05] border border-white/10 rounded-xl divide-y divide-white/5 max-h-72 overflow-y-auto">
          {botlog.length === 0 && <p className="px-4 py-3 text-xs text-white/35">Nog geen log-entries.</p>}
          {botlog.map((l, i) => {
            const c = l.level === 'error' ? 'text-red-400' : l.level === 'warn' ? 'text-amber-400' : 'text-white/45'
            return (
              <div key={i} className="flex items-center gap-3 px-4 py-2 text-xs">
                <span className={`shrink-0 w-12 ${c}`}>{l.level}</span>
                <span className="shrink-0 text-white/35 w-32 truncate">{l.source ?? l.event}</span>
                <span className="flex-1 text-white/70 truncate">{l.message ?? l.event}</span>
                <span className="shrink-0 text-white/25 text-[10px]">{kort(l.created_at)}</span>
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}
