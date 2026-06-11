import { createClient } from '@/lib/supabase/server'
import { getActiveCompanyId } from '@/lib/active-company-server'

export const dynamic = 'force-dynamic'

type Blocker = { src: string; entity_slug: string; code: string | null; title: string; reason: string; owner: string | null; waiting_on: string | null }
type Risk = { risk_type: string; entity_slug: string; subject: string; detail: string; severity: string }

const SEV: Record<string, string> = { high: '#ef4444', medium: '#f59e0b', low: '#64748b' }

export default async function BuildBlockersPage() {
  const supabase = await createClient()
  const slug = await getActiveCompanyId()
  const [blk, risk] = await Promise.all([
    supabase.from('v_build_blockers').select('*').eq('entity_slug', slug),
    supabase.from('v_build_risks').select('*').eq('entity_slug', slug),
  ])
  if (blk.error || risk.error) {
    return <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-300">Kon blockers/risico&apos;s niet laden: {blk.error?.message ?? risk.error?.message}</div>
  }
  const blockers = (blk.data ?? []) as Blocker[]
  const risks = (risk.data ?? []) as Risk[]

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="space-y-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
          <span className="h-2 w-2 rounded-full bg-red-500" /> Blockers ({blockers.length})
        </h2>
        {blockers.map((b, i) => (
          <div key={i} className="rounded-lg border border-red-500/15 bg-red-500/[0.04] p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-white line-clamp-1">{b.title}</span>
              <div className="flex items-center gap-1">
                {b.code && <span className="rounded bg-red-500/15 px-1.5 py-0.5 text-[9px] font-bold text-red-400">{b.code}</span>}
                <span className="rounded bg-white/5 px-1.5 py-0.5 text-[9px] text-white/40">{b.src}</span>
              </div>
            </div>
            <div className="mt-1 text-[11px] text-white/55 line-clamp-2">{b.reason}</div>
            <div className="mt-1 flex flex-wrap gap-3 text-[10px] text-white/40">
              <span>{b.entity_slug}</span>
              {b.owner && <span>owner: {b.owner}</span>}
              {b.waiting_on && <span>wacht op: {b.waiting_on}</span>}
            </div>
          </div>
        ))}
        {blockers.length === 0 && <div className="text-sm text-white/40">Geen actieve blockers 🎉</div>}
      </section>

      <section className="space-y-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
          <span className="h-2 w-2 rounded-full bg-amber-500" /> Top risico&apos;s ({risks.length})
        </h2>
        {risks.sort((a, b) => (a.severity === 'high' ? -1 : 1)).map((r, i) => {
          const c = SEV[r.severity] ?? '#64748b'
          return (
            <div key={i} className="rounded-lg border border-white/5 bg-[#0e1525] p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-white line-clamp-1">{r.subject}</span>
                <span className="rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase" style={{ color: c, background: `${c}1a` }}>
                  {r.severity}
                </span>
              </div>
              <div className="mt-1 text-[11px] text-white/55">{r.detail}</div>
              <div className="mt-1 flex gap-3 text-[10px] text-white/40">
                <span>{r.entity_slug}</span><span>{r.risk_type.replace(/_/g, ' ')}</span>
              </div>
            </div>
          )
        })}
        {risks.length === 0 && <div className="text-sm text-white/40">Geen risico&apos;s gedetecteerd.</div>}
      </section>
    </div>
  )
}
