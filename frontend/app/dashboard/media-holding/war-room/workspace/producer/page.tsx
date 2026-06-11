import { createClient } from '@/lib/supabase/server'
import { ChevronRight, Sparkles, CircleDashed, CircleCheck, CircleX, Loader, Eye, AlertTriangle, Wand2, TrendingUp, ArrowRight } from 'lucide-react'

export const dynamic = 'force-dynamic'

const STEPS = ['viral', 'hook', 'winner', 'horizon', 'creative', 'thumbnail', 'video', 'upload', 'attribution'] as const
const STEP_LABEL: Record<string, string> = {
  viral: 'Viral', hook: 'Hook', winner: 'Winner', horizon: 'Horizon', creative: 'Creative',
  thumbnail: 'Thumbnail', video: 'Video', upload: 'Upload', attribution: 'Attribution',
}

type Step = { step: string; status: string; started_at: string | null; completed_at: string | null; failed_at: string | null; failure_reason: string | null }
type Job = {
  id: string; status: string; created_at: string; why_made: string | null
  bron_winner_title: string | null; bron_hook_category: string | null; bron_niche: string | null
  bron_horizon_title: string | null; steps: Step[] | null
}

function StepIcon({ status }: { status?: string }) {
  if (status === 'done') return <CircleCheck size={12} className="text-emerald-400" />
  if (status === 'failed') return <CircleX size={12} className="text-red-400" />
  if (status === 'running') return <Loader size={12} className="text-amber-400" />
  return <CircleDashed size={12} className="text-white/25" />
}

type VisualProject = { project_id: string; title: string | null; scenes_total: number; scenes_with_visual: number; scenes_low_confidence: number; avg_confidence: number | null; decisions_logged: number }
type SceneVisual = { project_id: string; project_title: string | null; scene_idx: number | null; query_used: string | null; chosen_provider: string | null; chosen_kind: string | null; final_score: number | null; confidence: number | null; low_confidence: boolean; advice: string | null; candidates_evaluated: number }
type QueryIntel = { id: string; project_title: string | null; scene_idx: number | null; niche: string | null; original_query: string | null; improved_query: string | null; intent: string | null; current_score: number | null; predicted_score: number | null; predicted_gain: number | null; status: string; mismatch_type: string | null; mismatch_reason: string | null }
type LowRelevance = { project_title: string | null; scene_idx: number | null; query_used: string | null; chosen_provider: string | null; topic_relevance: number | null; visual_confidence: number | null; visual_advice: string | null }
type Metrics = { scenes_scored: number; avg_topic_relevance: number | null; avg_visual_confidence: number | null; mismatch_pct: number | null; hard_mismatch_pct: number | null; avg_query_improvement_gain: number | null; resource_pending: number; learned_niches: number }

export default async function ProducerGraphPage() {
  const supabase = await createClient()
  const { data, error } = await supabase.from('v_cf2_review').select('*').limit(100)

  if (error) {
    return <div className="rounded-lg border border-amber-400/20 bg-amber-500/[0.06] p-4 text-sm text-amber-200/80">Producer/Review views nog niet toegepast (migratie 171). Geen data beschikbaar.</div>
  }
  const jobs = (data ?? []) as Job[]

  // Visual Intelligence — per-project dekking/confidence + low-confidence scenes met advies
  const { data: viProjects } = await supabase.from('v_cf2_visual_confidence').select('*').gt('decisions_logged', 0).order('avg_confidence', { ascending: true }).limit(20)
  const { data: viLowScenes } = await supabase.from('v_cf2_scene_visual').select('*').eq('low_confidence', true).order('created_at', { ascending: false }).limit(40)
  const visualProjects = (viProjects ?? []) as VisualProject[]
  const lowScenes = (viLowScenes ?? []) as SceneVisual[]
  const confColor = (c: number | null) => (c == null ? 'text-white/40' : c >= 78 ? 'text-emerald-400' : c >= 55 ? 'text-amber-400' : 'text-red-400')

  // CF2.1 Query Intelligence & Self-Healing (FASE 6)
  const { data: qiData } = await supabase.from('v_cf2_query_intelligence').select('*').order('predicted_gain', { ascending: false }).limit(30)
  const { data: lrData } = await supabase.from('v_cf2_low_relevance').select('*').order('topic_relevance', { ascending: true }).limit(30)
  const { data: metricsData } = await supabase.from('v_cf2_visual_learning_metrics').select('*').maybeSingle()
  const queryIntel = (qiData ?? []) as QueryIntel[]
  const lowRelevance = (lrData ?? []) as LowRelevance[]
  const m = metricsData as Metrics | null

  return (
    <div className="space-y-4">
      <p className="text-xs text-white/45">
        Producer Graph + Review Intelligence — volledige audittrail per geproduceerde creative.
        Geen zwarte doos: iedere stap traceerbaar, iedere bron herleidbaar.
      </p>

      {/* Pipeline-template (de keten) */}
      <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-white/8 bg-[#0e1525] p-3">
        {STEPS.map((s, i) => (
          <span key={s} className="flex items-center gap-1.5">
            {i > 0 && <ChevronRight size={11} className="text-white/20" />}
            <span className="rounded bg-white/[0.05] px-2 py-1 text-[10px] font-medium text-white/65">{STEP_LABEL[s]}</span>
          </span>
        ))}
      </div>

      {jobs.length === 0 ? (
        <div className="rounded-lg border border-white/10 bg-[#0e1525] p-6">
          <div className="text-sm font-semibold text-white">Nog geen producties</div>
          <p className="mt-1.5 max-w-2xl text-xs leading-relaxed text-white/50">
            Geen data beschikbaar — CF2 is niet geactiveerd (geen worker/spend). Zodra de producer draait verschijnt hier
            per creative de volledige keten Winner → Hook → Thumbnail → Creative → Video → Upload → Performance → Attribution
            met status, timestamps en bron. Iedere creative is volledig herleidbaar.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {jobs.map((j) => {
            const byStep = new Map((j.steps ?? []).map((s) => [s.step, s]))
            return (
              <div key={j.id} className="rounded-lg border border-white/8 bg-[#0e1525] p-3">
                <div className="flex items-center gap-2">
                  <span className="rounded px-1.5 py-0.5 text-[9px] font-bold uppercase text-white/60 bg-white/[0.06]">{j.status}</span>
                  <span className="text-[11px] font-medium text-white">{j.bron_winner_title ? `Variant van: ${j.bron_winner_title}` : 'Creative'}</span>
                  <span className="ml-auto text-[9px] text-white/35">{new Date(j.created_at).toLocaleString('nl-NL')}</span>
                </div>
                {/* audittrail */}
                <div className="mt-2 flex flex-wrap items-center gap-1">
                  {STEPS.map((s, i) => {
                    const st = byStep.get(s)
                    return (
                      <span key={s} className="flex items-center gap-1" title={st?.failure_reason ?? st?.status ?? 'pending'}>
                        {i > 0 && <ChevronRight size={9} className="text-white/15" />}
                        <span className="inline-flex items-center gap-0.5 rounded bg-white/[0.03] px-1 py-0.5 text-[8px] text-white/55">
                          <StepIcon status={st?.status} /> {STEP_LABEL[s]}
                        </span>
                      </span>
                    )
                  })}
                </div>
                {/* Review: waarom gemaakt */}
                <div className="mt-2 flex items-start gap-1 rounded border border-violet-400/20 bg-violet-500/[0.06] px-1.5 py-1 text-[9px] text-violet-200/90">
                  <Sparkles size={10} className="mt-0.5 shrink-0 text-violet-300" />
                  <span><span className="font-semibold">Waarom gemaakt?</span> {j.why_made ?? 'Geen brondata'}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Visual Intelligence — per scene: waarom gekozen + confidence + low-confidence + advies */}
      <div className="mt-6 space-y-3">
        <div className="flex items-center gap-2">
          <Eye size={14} className="text-sky-300" />
          <h2 className="text-sm font-semibold text-white">Visual Intelligence</h2>
          <span className="text-[10px] text-white/40">multi-bron ranking · per scene herleidbaar</span>
        </div>

        {visualProjects.length === 0 ? (
          <div className="rounded-lg border border-white/10 bg-[#0e1525] p-4 text-xs text-white/50">
            Geen visual-beslissingen gelogd. Zodra de producer een job verwerkt, verschijnt hier per project de dekking,
            de confidence per scene, en welke alternatieven zijn afgewezen.
          </div>
        ) : (
          <div className="space-y-2">
            {visualProjects.map((p) => (
              <div key={p.project_id} className="rounded-lg border border-white/8 bg-[#0e1525] p-3">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-medium text-white">{p.title ?? 'Project'}</span>
                  <span className="text-[9px] text-white/40">{p.scenes_with_visual}/{p.scenes_total} scenes met beeld</span>
                  <span className="ml-auto text-[9px] text-white/40">
                    confidence <span className={`font-semibold ${confColor(p.avg_confidence)}`}>{p.avg_confidence ?? '—'}</span>
                  </span>
                  {p.scenes_low_confidence > 0 && (
                    <span className="inline-flex items-center gap-1 rounded bg-amber-500/[0.12] px-1.5 py-0.5 text-[9px] text-amber-300">
                      <AlertTriangle size={9} /> {p.scenes_low_confidence} low confidence
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {lowScenes.length > 0 && (
          <div className="rounded-lg border border-amber-400/20 bg-amber-500/[0.05] p-3">
            <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold text-amber-200">
              <AlertTriangle size={11} /> Low-confidence scenes — verbeteradvies
            </div>
            <div className="space-y-1.5">
              {lowScenes.map((s, i) => (
                <div key={i} className="rounded border border-white/8 bg-[#0e1525] px-2 py-1.5 text-[9px]">
                  <div className="flex items-center gap-2">
                    <span className="text-white/55">{s.project_title ?? 'Project'} · scene {s.scene_idx ?? '?'}</span>
                    <span className="text-white/35">&quot;{s.query_used ?? '—'}&quot;</span>
                    <span className="ml-auto text-white/40">
                      {s.chosen_provider ? `${s.chosen_provider}/${s.chosen_kind}` : 'geen bron gebruikt'} · {s.candidates_evaluated} beoordeeld · conf <span className={`font-semibold ${confColor(s.confidence)}`}>{s.confidence ?? '—'}</span>
                    </span>
                  </div>
                  {s.advice && <div className="mt-0.5 text-amber-200/75">→ {s.advice}</div>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* CF2.1 — Query Intelligence & Self-Healing (FASE 6) */}
      <div className="mt-6 space-y-3">
        <div className="flex items-center gap-2">
          <Wand2 size={14} className="text-violet-300" />
          <h2 className="text-sm font-semibold text-white">Query Intelligence &amp; Self-Healing</h2>
          <span className="text-[10px] text-white/40">zoek op intentie, niet op titel · leert van mismatches</span>
        </div>

        {/* Learning-metrics-strip (FASE 7 samenvatting) */}
        {m && (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
            {[
              { l: 'avg topic', v: m.avg_topic_relevance, c: confColor(m.avg_topic_relevance) },
              { l: 'avg confidence', v: m.avg_visual_confidence, c: 'text-white/80' },
              { l: 'mismatch %', v: m.mismatch_pct, c: 'text-amber-300' },
              { l: 'hard mismatch %', v: m.hard_mismatch_pct, c: 'text-red-400' },
              { l: 'query-winst', v: m.avg_query_improvement_gain != null ? `+${m.avg_query_improvement_gain}` : '—', c: 'text-emerald-400' },
              { l: 're-source pending', v: m.resource_pending, c: 'text-sky-300' },
              { l: 'geleerde niches', v: m.learned_niches, c: 'text-violet-300' },
            ].map((x) => (
              <div key={x.l} className="rounded-lg border border-white/8 bg-[#0e1525] p-2 text-center">
                <div className={`text-sm font-bold ${x.c}`}>{x.v ?? '—'}</div>
                <div className="text-[8px] uppercase tracking-wide text-white/40">{x.l}</div>
              </div>
            ))}
          </div>
        )}

        {/* Re-Source Candidates / Most Improved — origineel → verbeterd */}
        {queryIntel.length === 0 ? (
          <div className="rounded-lg border border-white/10 bg-[#0e1525] p-4 text-xs text-white/50">
            Geen re-source-kandidaten. Zodra de Query Improvement Loop draait, verschijnt hier per zwakke scene de
            verbeterde, intentie-gebaseerde query met voorspelde winst. Geen automatische re-source (gated).
          </div>
        ) : (
          <div className="rounded-lg border border-white/8 bg-[#0e1525] p-3">
            <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold text-white/80">
              <TrendingUp size={11} className="text-emerald-400" /> Re-Source kandidaten · origineel → verbeterd
            </div>
            <div className="space-y-1.5">
              {queryIntel.map((q) => (
                <div key={q.id} className="rounded border border-white/8 bg-black/20 px-2 py-1.5 text-[9px]">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-white/45">{q.project_title ?? 'Project'} · scene {q.scene_idx ?? '?'}</span>
                    {q.mismatch_type && <span className="rounded bg-amber-500/[0.12] px-1 text-[8px] text-amber-300">{q.mismatch_type}</span>}
                    <span className="rounded bg-white/[0.05] px-1 text-[8px] uppercase text-white/45">{q.status}</span>
                    <span className="ml-auto text-white/40">
                      <span className={confColor(q.current_score)}>{q.current_score ?? '—'}</span>
                      {' → '}
                      <span className="text-emerald-400">{q.predicted_score ?? '—'}</span>
                      {q.predicted_gain != null && q.predicted_gain > 0 && <span className="ml-1 text-emerald-300">(+{q.predicted_gain})</span>}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[9px]">
                    <span className="text-red-300/70 line-through">{q.original_query ?? '—'}</span>
                    <ArrowRight size={9} className="text-white/30" />
                    <span className="font-medium text-emerald-300">{q.improved_query ?? '—'}</span>
                  </div>
                  {q.mismatch_reason && <div className="mt-0.5 text-white/35">{q.mismatch_reason}</div>}
                </div>
              ))}
            </div>
            <p className="mt-2 text-[8px] text-white/35">Re-source is gated — geen automatische uitvoering zonder expliciete GO.</p>
          </div>
        )}
      </div>
    </div>
  )
}
