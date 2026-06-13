// Media Factory Autonomy Certification — 10 criteria + status NOT_CERTIFIED/CERTIFIED.
type Cert = {
  status: string; all_pass: boolean; ceo_minutes_estimate: number
  c1_no_human_7d: boolean; c2_uploads_flowing: boolean; c3_channels_healthy: boolean
  c4_winners_proxy: boolean; c5_strategy_improving: boolean; c6_incidents_detected: boolean
  c7_incidents_diagnosed: boolean; c8_incidents_healed: boolean; c9_recovery_validated: boolean
  c10_low_escalation: boolean
}

const CRITERIA: { key: keyof Cert; label: string }[] = [
  { key: 'c1_no_human_7d', label: '7d geen mens nodig' },
  { key: 'c2_uploads_flowing', label: 'Uploads blijven doorgaan' },
  { key: 'c3_channels_healthy', label: 'Kanalen gezond/groeien' },
  { key: 'c4_winners_proxy', label: 'Winners blijven gevonden' },
  { key: 'c5_strategy_improving', label: 'Strategie verbetert' },
  { key: 'c6_incidents_detected', label: 'Incidenten auto-gedetecteerd' },
  { key: 'c7_incidents_diagnosed', label: 'Incidenten auto-gediagnosticeerd' },
  { key: 'c8_incidents_healed', label: 'Incidenten auto-hersteld' },
  { key: 'c9_recovery_validated', label: 'Herstel auto-gevalideerd' },
  { key: 'c10_low_escalation', label: 'Alleen echte escalaties' },
]

type Streak = { green_streak_days: number; last_green_day: string | null; green_today: boolean; days_tracked: number }

export default function CertificationCard({ data, streak }: { data: Cert | null; streak?: Streak | null }) {
  const certified = data?.status === 'CERTIFIED'
  const passed = data ? CRITERIA.filter((c) => data[c.key] === true).length : 0
  const sd = Math.min(7, streak?.green_streak_days ?? 0)
  return (
    <div className="rounded-lg border border-white/5 bg-[#0e1525] p-4">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-white/40">Media Factory Certification</span>
        <span className="rounded px-2 py-0.5 text-[10px] font-bold uppercase"
          style={{ color: certified ? '#22c55e' : '#ef4444', background: certified ? '#22c55e1a' : '#ef44441a' }}>
          {data?.status ?? '—'}
        </span>
      </div>
      <div className="mt-1 text-xs text-white/45">{passed}/10 criteria groen · "kan ik 7 dagen niets doen?"</div>

      {/* 7-dagen-streak richting certificering */}
      <div className="mt-2 flex items-center gap-2">
        <div className="flex gap-0.5">
          {Array.from({ length: 7 }).map((_, i) => (
            <span key={i} className="h-2 w-3 rounded-sm" style={{ background: i < sd ? '#22c55e' : '#ffffff14' }} />
          ))}
        </div>
        <span className="text-[10px] text-white/45">
          {streak?.green_streak_days ?? 0}/7 dagen aaneengesloten groen
          {!streak?.green_today && (streak?.days_tracked ?? 0) > 0 && <span className="text-white/30"> · vandaag niet</span>}
          {streak?.last_green_day && <span className="text-white/30"> · laatst {new Date(streak.last_green_day).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}</span>}
        </span>
      </div>
      <div className="mt-2 grid grid-cols-1 gap-1 sm:grid-cols-2">
        {CRITERIA.map((c) => {
          const pass = data?.[c.key] === true
          return (
            <div key={c.key} className="flex items-center gap-1.5 text-[10px]">
              <span style={{ color: pass ? '#22c55e' : '#ef4444' }}>{pass ? '✓' : '✗'}</span>
              <span className={pass ? 'text-white/55' : 'text-white/40'}>{c.label}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
