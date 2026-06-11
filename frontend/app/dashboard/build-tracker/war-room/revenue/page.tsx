import { createClient } from '@/lib/supabase/server'
import { getActiveCompanyId } from '@/lib/active-company-server'

export const dynamic = 'force-dynamic'

type Row = {
  entity_slug: string; project: string; model: string | null
  expected: number; actual: number; currency: string
}

export default async function BuildRevenuePage() {
  const supabase = await createClient()
  const slug = await getActiveCompanyId()
  const { data, error } = await supabase.from('v_build_revenue_map').select('*').eq('entity_slug', slug).order('expected', { ascending: false })
  if (error) {
    return <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-300">Kon revenue-map niet laden: {error.message}</div>
  }
  const rows = (data ?? []) as Row[]
  const fmt = (v: number, c = 'EUR') => Intl.NumberFormat('nl-NL', { style: 'currency', currency: c, maximumFractionDigits: 0 }).format(v)
  const totalExpected = rows.reduce((s, r) => s + Number(r.expected || 0), 0)
  const totalActual = rows.reduce((s, r) => s + Number(r.actual || 0), 0)

  // per entiteit aggregeren
  const byEntity = new Map<string, { expected: number; actual: number }>()
  for (const r of rows) {
    const e = byEntity.get(r.entity_slug) ?? { expected: 0, actual: 0 }
    e.expected += Number(r.expected || 0); e.actual += Number(r.actual || 0)
    byEntity.set(r.entity_slug, e)
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Kpi label="Verwachte omzet" value={fmt(totalExpected)} accent="#a3e635" />
        <Kpi label="Echte omzet" value={fmt(totalActual)} accent="#22c55e" />
        <Kpi label="Build → omzet projecten" value={String(rows.length)} accent="#38bdf8" />
        <Kpi label="Entiteiten met omzet" value={String(byEntity.size)} accent="#a855f7" />
      </div>

      <div className="overflow-hidden rounded-lg border border-white/5">
        <table className="w-full text-left text-xs">
          <thead className="bg-[#0e1525] text-white/40">
            <tr>
              <th className="px-3 py-2 font-medium">Entiteit</th>
              <th className="px-3 py-2 font-medium">Build item → product</th>
              <th className="px-3 py-2 font-medium">Verdienmodel</th>
              <th className="px-3 py-2 text-right font-medium">Verwacht</th>
              <th className="px-3 py-2 text-right font-medium">Echt</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-t border-white/5 text-white/75">
                <td className="px-3 py-2 text-white/45">{r.entity_slug}</td>
                <td className="px-3 py-2">{r.project}</td>
                <td className="px-3 py-2 text-white/50">{r.model ?? '—'}</td>
                <td className="px-3 py-2 text-right font-semibold text-lime-400">{fmt(Number(r.expected), r.currency)}</td>
                <td className="px-3 py-2 text-right text-white/55">{Number(r.actual) > 0 ? fmt(Number(r.actual), r.currency) : '—'}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={5} className="px-3 py-4 text-center text-white/40">Nog geen projecten met verwachte omzet gekoppeld.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Kpi({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="rounded-lg border border-white/5 bg-[#0e1525] p-3">
      <div className="text-[10px] uppercase tracking-wide text-white/40">{label}</div>
      <div className="mt-1 text-lg font-bold" style={{ color: accent }}>{value}</div>
    </div>
  )
}
