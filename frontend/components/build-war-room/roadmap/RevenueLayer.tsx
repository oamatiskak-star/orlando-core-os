// Omzetpositie (F6) — "wat verdient geld" + "afstand tot volgende omzetmijlpaal".
// Eerlijke lege-states: geen gefabriceerde bedragen (echte omzet uit account_revenues/Moneybird).
type Position = {
  total_expected: number; total_actual: number
  next_milestone: string | null; next_target: number | null; currency: string
  next_date: string | null; distance_to_target: number | null; pct_to_target: number | null
}
type Entity = { entity_slug: string; expected: number; actual: number }

const eur = (v: number, c = 'EUR') => Intl.NumberFormat('nl-NL', { style: 'currency', currency: c, maximumFractionDigits: 0 }).format(v)

function Kpi({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="rounded border border-white/5 bg-[#070b14] p-2.5">
      <div className="text-[10px] uppercase tracking-wide text-white/40">{label}</div>
      <div className="mt-0.5 text-base font-bold" style={{ color: accent }}>{value}</div>
    </div>
  )
}

export default function RevenueLayer({ position, byEntity }: { position: Position | null; byEntity: Entity[] }) {
  const p = position
  const c = p?.currency ?? 'EUR'
  const rows = byEntity.filter((e) => e.expected > 0 || e.actual > 0)

  return (
    <div className="rounded-lg border border-white/5 bg-[#0e1525] p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold text-white/80">Omzetpositie</span>
        <span className="text-[10px] text-white/35">afstand tot volgende omzetmijlpaal</span>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Kpi label="Echte omzet" value={eur(p?.total_actual ?? 0, c)} accent="#22c55e" />
        <Kpi label="Verwachte pipeline" value={eur(p?.total_expected ?? 0, c)} accent="#a3e635" />
        <Kpi label="Volgende omzetmijlpaal" value={p?.next_milestone ?? 'geen doel'} accent="#38bdf8" />
        <Kpi label="Afstand tot doel" value={p?.distance_to_target != null ? eur(p.distance_to_target, c) : '—'} accent="#f59e0b" />
      </div>

      {p?.next_target != null ? (
        <div className="mt-2">
          <div className="flex items-center justify-between text-[10px] text-white/45">
            <span>{p.next_milestone}{p.next_date ? ` · ${new Date(p.next_date).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}</span>
            <span>{p.pct_to_target ?? 0}% van {eur(p.next_target, c)}</span>
          </div>
          <div className="mt-1 h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
            <div className="h-full rounded-full bg-emerald-400" style={{ width: `${Math.min(100, p.pct_to_target ?? 0)}%` }} />
          </div>
        </div>
      ) : (
        <div className="mt-2 rounded border border-amber-400/15 bg-amber-400/[0.04] px-2 py-1.5 text-[10px] text-amber-300/80">
          Nog geen omzetdoel gezet. Zet <code className="text-white/60">revenue_target</code> op een milestone om de
          afstand-tot-doel te activeren; echte omzet vult zich uit <code className="text-white/60">account_revenues</code>/Moneybird.
        </div>
      )}

      {rows.length > 0 && (
        <div className="mt-2 space-y-1">
          {rows.map((e) => (
            <div key={e.entity_slug} className="flex items-center justify-between text-[10px] text-white/55">
              <span>{e.entity_slug}</span>
              <span>verwacht {eur(e.expected, c)} · echt {eur(e.actual, c)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
