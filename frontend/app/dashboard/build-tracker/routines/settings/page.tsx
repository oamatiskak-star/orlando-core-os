import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { RoutineStatusBadge } from '@/lib/routines/badges'
import { setAutopilot } from '../actions'
import type { RoutineRow } from '@/lib/routines/types'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type AutopilotRow = {
  routine_id: string
  auto_recover: boolean
  auto_escalate: boolean
  auto_approve_threshold: number | null
  updated_at: string
}

export default async function RoutinesSettingsPage() {
  const supabase = await createClient()

  const [routinesRes, autopilotRes] = await Promise.all([
    supabase
      .from('routines')
      .select('id, company_id, slug, name, description, kind, status, owner_user_id, created_at, updated_at')
      .order('updated_at', { ascending: false }),
    supabase
      .from('routine_autopilot_config')
      .select('routine_id, auto_recover, auto_escalate, auto_approve_threshold, updated_at'),
  ])

  const routines = (routinesRes.data ?? []) as RoutineRow[]
  const autopilot = (autopilotRes.data ?? []) as AutopilotRow[]
  const cfgByRoutine = new Map(autopilot.map(c => [c.routine_id, c]))

  return (
    <div className="space-y-5">
      <div className="bg-white/[0.04] rounded-xl border border-white/[0.06] p-4">
        <h2 className="text-xs font-medium text-white/70 mb-1">Autopilot per routine</h2>
        <p className="text-[10px] text-white/40 mb-3 leading-relaxed">
          Per routine bepaal je hoe agressief de meta-supervisor mag handelen zónder menselijke goedkeuring.
          <br/>
          <strong className="text-white/55">auto_recover</strong>: bij failed run automatisch herstart.{' '}
          <strong className="text-white/55">auto_escalate</strong>: bij hardlopende fout direct alert.{' '}
          <strong className="text-white/55">auto_approve_threshold</strong>: kosten-grens (in centen) waaronder approval-steps auto-approved worden.
        </p>
      </div>

      {routines.length === 0 ? (
        <div className="py-16 text-center bg-white/[0.02] border border-dashed border-white/10 rounded-xl">
          <p className="text-[12px] text-white/40">Nog geen routines om in te stellen.</p>
          <Link href="/dashboard/build-tracker/routines/builder" className="text-[11px] text-emerald-300/80 hover:text-emerald-300 mt-2 inline-block">
            → Maak je eerste routine
          </Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {routines.map((r) => {
            const cfg = cfgByRoutine.get(r.id)
            return (
              <li key={r.id} className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-4">
                <div className="flex items-center gap-3 mb-3">
                  <RoutineStatusBadge status={r.status} size="xs" />
                  <div className="flex-1">
                    <Link href={`/dashboard/build-tracker/routines/${r.id}`} className="text-[12px] text-white/85 font-medium hover:text-white">
                      {r.name}
                    </Link>
                    <p className="text-[10px] text-white/40 font-mono">{r.slug}</p>
                  </div>
                  <span className="text-[10px] text-white/35 uppercase tracking-wide">{r.kind}</span>
                </div>

                <form action={setAutopilot} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                  <input type="hidden" name="routine_id" value={r.id} />

                  <label className="flex items-center gap-2 text-[11px] text-white/70 select-none">
                    <input
                      type="checkbox"
                      name="auto_recover"
                      defaultChecked={cfg?.auto_recover ?? false}
                      className="accent-emerald-500"
                    />
                    Auto-recover failed runs
                  </label>

                  <label className="flex items-center gap-2 text-[11px] text-white/70 select-none">
                    <input
                      type="checkbox"
                      name="auto_escalate"
                      defaultChecked={cfg?.auto_escalate ?? true}
                      className="accent-amber-500"
                    />
                    Auto-escalate alerts
                  </label>

                  <div>
                    <label className="block text-[10px] uppercase tracking-wide text-white/40 mb-1">
                      Approve threshold (cents)
                    </label>
                    <input
                      type="number"
                      name="auto_approve_threshold"
                      min={0}
                      step={1}
                      defaultValue={cfg?.auto_approve_threshold ?? ''}
                      placeholder="leeg = niet auto-approve"
                      className="w-full bg-white/[0.04] border border-white/10 rounded px-2 py-1 text-[11px] text-white/80 focus:outline-none focus:border-white/30"
                    />
                  </div>

                  <button
                    type="submit"
                    className="px-3 py-1.5 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-400/30 text-emerald-200 rounded-lg text-[11px] font-medium"
                  >
                    Opslaan
                  </button>
                </form>

                {cfg && (
                  <p className="text-[10px] text-white/30 mt-2 font-mono">
                    laatst gewijzigd {new Date(cfg.updated_at).toLocaleString('nl-NL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </p>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
