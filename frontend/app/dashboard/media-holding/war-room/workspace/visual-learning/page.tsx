import { createClient } from '@/lib/supabase/server'
import { Brain, AlertTriangle, TrendingUp } from 'lucide-react'

export const dynamic = 'force-dynamic'

type Metrics = { scenes_scored: number; avg_topic_relevance: number | null; avg_visual_confidence: number | null; mismatch_pct: number | null; hard_mismatch_pct: number | null; avg_query_improvement_gain: number | null; resource_success_pct: number | null; resource_pending: number; learned_niches: number }
type NicheRow = { niche: string | null; scenes_scored: number; avg_topic_relevance: number | null; avg_visual_confidence: number | null; mismatch_pct: number | null; hard_mismatch_pct: number | null }
type Learned = { niche: string; good_query_terms: string[] | null; bad_query_terms: string[] | null; lesson: string | null; avg_topic_good: number | null; avg_topic_bad: number | null }

const relColor = (c: number | null) => (c == null ? 'text-white/40' : c >= 78 ? 'text-emerald-400' : c >= 55 ? 'text-amber-400' : 'text-red-400')

function Bar({ value, label, danger }: { value: number | null; label: string; danger?: boolean }) {
  const v = value ?? 0
  return (
    <div>
      <div className="flex justify-between text-[9px] text-white/45"><span>{label}</span><span>{value ?? '—'}</span></div>
      <div className="mt-0.5 h-1.5 overflow-hidden rounded bg-white/[0.06]">
        <div className={`h-full rounded ${danger ? 'bg-red-400/70' : 'bg-emerald-400/70'}`} style={{ width: `${Math.max(0, Math.min(100, v))}%` }} />
      </div>
    </div>
  )
}

export default async function VisualLearningPage() {
  const supabase = await createClient()
  const { data: mData, error } = await supabase.from('v_cf2_visual_learning_metrics').select('*').maybeSingle()
  if (error) {
    return <div className="rounded-lg border border-amber-400/20 bg-amber-500/[0.06] p-4 text-sm text-amber-200/80">Visual Learning-views nog niet toegepast (migratie 180). Geen data beschikbaar.</div>
  }
  const m = mData as Metrics | null
  const { data: nData } = await supabase.from('v_cf2_visual_learning_by_niche').select('*').order('avg_topic_relevance', { ascending: true })
  const { data: lData } = await supabase.from('cf2_query_learning_patterns').select('niche, good_query_terms, bad_query_terms, lesson, avg_topic_good, avg_topic_bad').order('updated_at', { ascending: false }).limit(20)
  const niches = (nData ?? []) as NicheRow[]
  const learned = (lData ?? []) as Learned[]

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Brain size={15} className="text-violet-300" />
        <h1 className="text-sm font-semibold text-white">Visual Learning Dashboard</h1>
        <span className="text-[10px] text-white/40">self-learning visuele kwaliteitslaag · alleen review/leren, geen publicatie</span>
      </div>

      {!m || m.scenes_scored === 0 ? (
        <div className="rounded-lg border border-white/10 bg-[#0e1525] p-6 text-xs text-white/50">
          Geen data beschikbaar — nog geen vision-audit uitgevoerd. Zodra scenes inhoudelijk gescoord zijn (topic_relevance),
          verschijnen hier de metrics, mismatch-percentages en de geleerde query-patronen per niche.
        </div>
      ) : (
        <>
          {/* hoofdmetrics */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {[
              { l: 'scenes gescoord', v: m.scenes_scored, c: 'text-white/80' },
              { l: 'avg topic relevance', v: m.avg_topic_relevance, c: relColor(m.avg_topic_relevance) },
              { l: 'avg visual confidence', v: m.avg_visual_confidence, c: 'text-white/80' },
              { l: 'mismatch %', v: m.mismatch_pct, c: 'text-amber-300' },
              { l: 'hard mismatch %', v: m.hard_mismatch_pct, c: 'text-red-400' },
              { l: 'query-winst (voorspeld)', v: m.avg_query_improvement_gain != null ? `+${m.avg_query_improvement_gain}` : '—', c: 'text-emerald-400' },
            ].map((x) => (
              <div key={x.l} className="rounded-lg border border-white/8 bg-[#0e1525] p-3 text-center">
                <div className={`text-lg font-bold ${x.c}`}>{x.v ?? '—'}</div>
                <div className="mt-0.5 text-[8px] uppercase tracking-wide text-white/40">{x.l}</div>
              </div>
            ))}
          </div>
          <div className="text-[10px] text-white/40">
            re-source succesratio: <span className="text-white/70">{m.resource_success_pct != null ? `${m.resource_success_pct}%` : 'n.v.t.'}</span>
            {' · '}pending: <span className="text-sky-300">{m.resource_pending}</span>
            {' · '}geleerde niches: <span className="text-violet-300">{m.learned_niches}</span>
          </div>

          {/* per niche */}
          <div className="rounded-lg border border-white/8 bg-[#0e1525] p-3">
            <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold text-white/80"><TrendingUp size={11} className="text-sky-300" /> Per niche</div>
            <div className="grid gap-3 sm:grid-cols-2">
              {niches.map((n) => (
                <div key={n.niche ?? 'onbekend'} className="rounded border border-white/8 bg-black/20 p-2">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="font-medium text-white/80">{n.niche ?? 'onbekend'}</span>
                    <span className="text-white/40">{n.scenes_scored} scenes</span>
                  </div>
                  <div className="mt-1.5 space-y-1.5">
                    <Bar label="avg topic relevance" value={n.avg_topic_relevance} />
                    <Bar label="mismatch %" value={n.mismatch_pct} danger />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* geleerde patronen (Hermes) */}
          {learned.length > 0 && (
            <div className="rounded-lg border border-violet-400/20 bg-violet-500/[0.05] p-3">
              <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold text-violet-200"><Brain size={11} /> Geleerde query-patronen (Hermes)</div>
              <div className="space-y-2">
                {learned.map((l) => (
                  <div key={l.niche} className="rounded border border-white/8 bg-[#0e1525] px-2 py-1.5 text-[9px]">
                    <div className="font-medium text-white/75">{l.niche}</div>
                    {l.lesson && <div className="mt-0.5 text-violet-200/75">{l.lesson}</div>}
                    <div className="mt-1 flex flex-wrap gap-2 text-[8px]">
                      <span className="text-emerald-300/80">goed: {(l.good_query_terms ?? []).slice(0, 6).join(', ') || '—'}</span>
                      <span className="text-red-300/70">vermijd: {(l.bad_query_terms ?? []).slice(0, 6).join(', ') || '—'}</span>
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-2 flex items-center gap-1 text-[8px] text-white/35"><AlertTriangle size={8} /> Patronen scherpen aan naarmate meer diverse producties gescoord zijn (huidige basis is dun).</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
