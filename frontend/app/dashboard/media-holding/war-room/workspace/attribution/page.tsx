import { createClient } from '@/lib/supabase/server'
import { ShieldCheck, Tv2 } from 'lucide-react'
import { nicheLabel } from '@/lib/war-room/hooks-intel'

export const dynamic = 'force-dynamic'

const num = (n: number | null) => (n == null ? 'Geen data' : Intl.NumberFormat('nl-NL', { notation: 'compact' }).format(n))
const eur = (n: number) => Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n || 0)
const STAGES: { k: string; l: string }[] = [
  { k: 'views', l: 'View' }, { k: 'clicks', l: 'Click' }, { k: 'leads', l: 'Lead' },
  { k: 'rapport', l: 'Rapport' }, { k: 'memberships', l: 'Membership' }, { k: 'sales', l: 'Sale' }, { k: 'revenue', l: 'Revenue' },
]

type Row = Record<string, number | null> & { channel_id?: string; name?: string; niche?: string; confidence: number }

function confBadge(c: number) {
  const pct = Math.round(c * 100)
  const label = pct >= 66 ? 'High' : pct >= 33 ? 'Medium' : 'Low'
  const color = pct >= 66 ? '#22c55e' : pct >= 33 ? '#f59e0b' : '#ef4444'
  return { pct, label, color }
}

export default async function AttributionPage() {
  const supabase = await createClient()
  const [chRes, niRes] = await Promise.all([
    supabase.from('v_attribution_channel').select('*').order('views', { ascending: false }),
    supabase.from('v_attribution_niche').select('*'),
  ])
  if (chRes.error) {
    return <div className="rounded-lg border border-amber-400/20 bg-amber-500/[0.06] p-4 text-sm text-amber-200/80">Attribution views nog niet toegepast (migratie 172). Geen data beschikbaar.</div>
  }
  const channels = (chRes.data ?? []) as Row[]
  const niches = (niRes.data ?? []) as Row[]

  return (
    <div className="space-y-4">
      <p className="text-xs text-white/45">Attribution — View → Click → Lead → Rapport → Membership → Sale → Revenue per kanaal/niche. Confidence verplicht; geen omzetclaim zonder confidence. Rapport/Membership hebben nog geen bron → &quot;Geen data&quot;.</p>

      <Section title="Per niche">
        {niches.map((r, i) => <FunnelRow key={i} label={nicheLabel((r.niche as unknown as string) ?? '—')} r={r} />)}
      </Section>

      <Section title="Per kanaal">
        {channels.map((r, i) => <FunnelRow key={i} label={(r.name as unknown as string) ?? '—'} r={r} icon />)}
      </Section>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-white/55">{title}</div>
      <div className="space-y-2">{children}</div>
    </div>
  )
}

function FunnelRow({ label, r, icon }: { label: string; r: Row; icon?: boolean }) {
  const cb = confBadge(r.confidence ?? 0)
  return (
    <div className="rounded-lg border border-white/8 bg-[#0e1525] p-2.5">
      <div className="mb-1.5 flex items-center gap-1.5">
        {icon && <Tv2 size={12} className="text-sky-400" />}
        <span className="text-[11px] font-medium text-white">{label}</span>
        <span className="ml-auto inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-semibold"
          style={{ color: cb.color, background: `${cb.color}14`, border: `1px solid ${cb.color}44` }}>
          <ShieldCheck size={10} /> {cb.label} · {cb.pct}%
        </span>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center">
        {STAGES.map((s) => {
          const v = r[s.k] as number | null
          const isRev = s.k === 'revenue'
          return (
            <div key={s.k} className="rounded bg-white/[0.03] px-1 py-1">
              <div className="text-[7px] uppercase tracking-wide text-white/30">{s.l}</div>
              <div className="text-[10px] font-semibold tabular-nums" style={{ color: v == null ? 'rgba(255,255,255,0.25)' : isRev && v > 0 ? '#22c55e' : '#fff' }}>
                {isRev ? (v == null ? 'Geen data' : eur(v)) : num(v)}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
