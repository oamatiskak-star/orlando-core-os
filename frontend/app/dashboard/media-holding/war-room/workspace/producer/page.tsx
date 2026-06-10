import { createClient } from '@/lib/supabase/server'
import { ChevronRight, Sparkles, CircleDashed, CircleCheck, CircleX, Loader } from 'lucide-react'

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

export default async function ProducerGraphPage() {
  const supabase = await createClient()
  const { data, error } = await supabase.from('v_cf2_review').select('*').limit(100)

  if (error) {
    return <div className="rounded-lg border border-amber-400/20 bg-amber-500/[0.06] p-4 text-sm text-amber-200/80">Producer/Review views nog niet toegepast (migratie 171). Geen data beschikbaar.</div>
  }
  const jobs = (data ?? []) as Job[]

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
    </div>
  )
}
