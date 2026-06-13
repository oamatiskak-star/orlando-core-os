// Aandachtspunten — gesloten keten per item: echt probleem? · root cause · impact · auto-opgelost? · mens nodig?
// Beantwoordt "85 uploads vereisen aandacht — maar waarom / welke impact / is menselijke actie nodig?".
type Row = {
  category: string; label: string; root_cause: string; cnt: number
  impact: string; auto_resolved: boolean; human_needed: boolean; note: string | null
}
const CAT: Record<string, { label: string; c: string }> = {
  uploads: { label: 'Uploads', c: '#f59e0b' },
  check: { label: 'Checks', c: '#38bdf8' },
  incident: { label: 'Incidenten', c: '#ef4444' },
}
const IMPACT: Record<string, string> = { high: '#ef4444', medium: '#f59e0b', low: '#64748b' }

export default function AttentionItems({ rows }: { rows: Row[] }) {
  const totalItems = rows.reduce((s, r) => s + r.cnt, 0)
  const humanItems = rows.filter((r) => r.human_needed).reduce((s, r) => s + r.cnt, 0)
  const cats = ['uploads', 'check', 'incident'] as const

  return (
    <div className="rounded-lg border border-white/5 bg-[#0e1525] p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold text-white/80">Aandachtspunten</span>
        <span className="text-[10px]">
          <span className="font-semibold text-amber-400">{humanItems}</span>
          <span className="text-white/35"> vragen menselijke actie · {totalItems} totaal</span>
        </span>
      </div>
      {totalItems === 0 ? (
        <div className="text-[11px] text-emerald-400/70">Niets vraagt aandacht — keten rustig.</div>
      ) : (
        <div className="space-y-2.5">
          {cats.map((cat) => {
            const catRows = rows.filter((r) => r.category === cat).sort((a, b) => b.cnt - a.cnt)
            if (catRows.length === 0) return null
            const meta = CAT[cat]
            const catTotal = catRows.reduce((s, r) => s + r.cnt, 0)
            return (
              <div key={cat}>
                <div className="mb-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide" style={{ color: meta.c }}>
                  <span className="h-2 w-2 rounded-sm" style={{ background: meta.c }} />
                  {meta.label} <span className="text-white/30">({catTotal})</span>
                </div>
                <div className="space-y-1">
                  {catRows.slice(0, 6).map((r, i) => {
                    const ic = IMPACT[r.impact] ?? '#64748b'
                    return (
                      <div key={i} className="flex items-center gap-2 rounded bg-[#070b14] px-2 py-1 text-[11px]">
                        {r.cnt > 1 && <span className="rounded bg-white/5 px-1 py-0.5 text-[9px] font-bold text-white/55">{r.cnt}×</span>}
                        <span className="flex-1 truncate text-white/70" title={r.root_cause}>{r.root_cause}</span>
                        <span className="rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase" style={{ color: ic, background: `${ic}1a` }}>{r.impact}</span>
                        {r.human_needed
                          ? <span className="text-[9px] font-semibold text-amber-400">mens</span>
                          : <span className="text-[9px] text-emerald-400/70">auto</span>}
                        {r.note && <span className="hidden text-[9px] text-white/30 sm:inline">{r.note}</span>}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
