import { createClient } from '@/lib/supabase/server'
import { Sparkles, Megaphone, Tv2 } from 'lucide-react'
import { recCategory, CATEGORY_LABEL, CATEGORY_COLOR, humanizeAction, type RecCategory } from '@/lib/war-room/recommendations'

export const dynamic = 'force-dynamic'

type Rec = {
  id: string
  action_kind: string
  target_kind: string | null
  target_id: string | null
  priority: number | null
  rationale: string | null
  status: string | null
  payload: Record<string, unknown> | null
}

export default async function HermesRecommendationsPage() {
  const supabase = await createClient()
  const [recRes, chRes] = await Promise.all([
    supabase
      .from('executive_recommendations')
      .select('id, action_kind, target_kind, target_id, priority, rationale, status, payload')
      .neq('status', 'executed')
      .neq('status', 'dismissed')
      .order('priority', { ascending: false })
      .limit(200),
    supabase.from('media_holding_channels').select('id, name, niche'),
  ])

  const recs = (recRes.data ?? []) as Rec[]
  const chById = new Map<string, { name: string; niche: string | null }>()
  for (const c of chRes.data ?? []) chById.set(c.id, { name: c.name, niche: c.niche })

  if (recRes.error) {
    return <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-300">Fout: {recRes.error.message}</div>
  }

  // tellen per categorie
  const counts = new Map<RecCategory, number>()
  for (const r of recs) counts.set(recCategory(r.action_kind), (counts.get(recCategory(r.action_kind)) ?? 0) + 1)
  const order: RecCategory[] = ['scale', 'expand', 'test', 'replace', 'repurpose', 'pause', 'other']

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-white/45">
          Hermes-aanbevelingen — operationeel en onderbouwd met meetbare rationale. Categorie volgt het actietype.
        </p>
        <span className="text-[10px] text-white/35">Confidence &amp; impact worden nog niet apart vastgelegd → &quot;Geen data&quot;.</span>
      </div>

      <div className="flex flex-wrap gap-2">
        {order.filter((c) => (counts.get(c) ?? 0) > 0).map((c) => (
          <span key={c} className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold"
            style={{ color: CATEGORY_COLOR[c], background: `${CATEGORY_COLOR[c]}14`, border: `1px solid ${CATEGORY_COLOR[c]}44` }}>
            {CATEGORY_LABEL[c]} · {counts.get(c)}
          </span>
        ))}
      </div>

      {recs.length === 0 ? (
        <div className="rounded-lg border border-white/10 bg-[#0e1525] p-6 text-sm text-white/50">
          <div className="flex items-center gap-2 font-semibold text-white"><Sparkles size={16} className="text-violet-400" /> Geen openstaande aanbevelingen</div>
          <p className="mt-1.5 text-xs text-white/45">Hermes draait dagelijks; zodra er nieuwe adviezen zijn verschijnen ze hier.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {recs.map((r) => {
            const cat = recCategory(r.action_kind)
            const c = CATEGORY_COLOR[cat]
            const ch = r.target_id ? chById.get(r.target_id) : undefined
            const niche = ch?.niche ?? (r.payload?.niche as string | undefined) ?? null
            return (
              <div key={r.id} className="rounded-lg border border-white/8 bg-[#0e1525] p-4">
                <div className="flex items-center gap-2">
                  <span className="rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide" style={{ color: c, background: `${c}1a`, border: `1px solid ${c}55` }}>
                    {CATEGORY_LABEL[cat]}
                  </span>
                  <span className="text-xs font-semibold text-white">{humanizeAction(r.action_kind)}</span>
                  <span className="ml-auto text-[10px] text-white/40">prioriteit {r.priority ?? '—'}</span>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-white/45">
                  {ch && <span className="inline-flex items-center gap-1"><Tv2 size={11} /> {ch.name}</span>}
                  {niche && <span className="inline-flex items-center gap-1 capitalize"><Megaphone size={11} /> {niche}</span>}
                  {r.target_kind && !ch && <span className="capitalize">{r.target_kind}</span>}
                </div>

                {r.rationale ? (
                  <p className="mt-2 text-[11px] leading-relaxed text-white/65">{r.rationale}</p>
                ) : (
                  <p className="mt-2 text-[11px] italic text-white/30">Geen rationale beschikbaar</p>
                )}

                <div className="mt-2.5 flex items-center gap-3 border-t border-white/5 pt-2 text-[10px] text-white/35">
                  <span>Confidence: <span className="text-white/45">Geen data</span></span>
                  <span>Impact: <span className="text-white/45">Geen data</span></span>
                  {r.status && <span className="ml-auto uppercase tracking-wide">{r.status}</span>}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
