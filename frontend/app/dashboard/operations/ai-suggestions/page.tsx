import { createClient } from '@/lib/supabase/server'
import { Lightbulb, CheckCircle2, XCircle, Clock } from 'lucide-react'
import { revalidatePath } from 'next/cache'

type Suggestion = {
  id: string
  company: string
  type: string
  title: string
  description: string
  impact: string
  related_workflow_id: string | null
  status: string
  dismissed_at: string | null
  applied_at: string | null
  created_at: string
}

async function dismissSuggestion(id: string) {
  'use server'
  const { createClient: create } = await import('@/lib/supabase/server')
  const supabase = await create()
  await supabase.from('oc_ai_suggestions').update({ status: 'dismissed', dismissed_at: new Date().toISOString() }).eq('id', id)
  revalidatePath('/dashboard/operations/ai-suggestions')
}

async function applySuggestion(id: string) {
  'use server'
  const { createClient: create } = await import('@/lib/supabase/server')
  const supabase = await create()
  await supabase.from('oc_ai_suggestions').update({ status: 'applied', applied_at: new Date().toISOString() }).eq('id', id)
  revalidatePath('/dashboard/operations/ai-suggestions')
}

const IMPACT_COLORS: Record<string, string> = {
  high: 'text-red-400 bg-red-500/10 border-red-500/20',
  medium: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  low: 'text-white/50 bg-white/5 border-white/10',
}

const TYPE_LABELS: Record<string, string> = {
  optimization: 'Optimalisatie',
  error_prevention: 'Fout preventie',
  automation: 'Automatisering',
  performance: 'Performance',
  cost_saving: 'Kostenbesparing',
  security: 'Beveiliging',
}

export default async function AiSuggestionsPage() {
  const supabase = await createClient()

  const [
    { data: pending },
    { data: applied },
    { data: dismissed },
  ] = await Promise.all([
    supabase.from('oc_ai_suggestions').select('*').eq('status', 'pending').order('created_at', { ascending: false }),
    supabase.from('oc_ai_suggestions').select('*').eq('status', 'applied').order('applied_at', { ascending: false }).limit(10),
    supabase.from('oc_ai_suggestions').select('*').eq('status', 'dismissed').order('dismissed_at', { ascending: false }).limit(10),
  ])

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center">
          <Lightbulb size={16} className="text-yellow-400" />
        </div>
        <div>
          <h1 className="text-base font-semibold text-white">AI Suggestions</h1>
          <p className="text-xs text-white/50">Proactieve aanbevelingen van het systeem — optimaliseer workflows en automatiseringen</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Openstaand', value: pending?.length ?? 0, icon: Clock, color: 'text-yellow-400', border: 'border-yellow-500/20' },
          { label: 'Toegepast', value: applied?.length ?? 0, icon: CheckCircle2, color: 'text-green-400', border: 'border-green-500/20' },
          { label: 'Afgewezen', value: dismissed?.length ?? 0, icon: XCircle, color: 'text-white/38', border: 'border-white/5' },
        ].map(s => {
          const Icon = s.icon
          return (
            <div key={s.label} className={`bg-white/[0.06] border ${s.border} rounded-xl p-4`}>
              <Icon size={13} className={`${s.color} mb-2`} />
              <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-[11px] text-white/50 mt-0.5">{s.label}</p>
            </div>
          )
        })}
      </div>

      {(pending?.length ?? 0) === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 bg-white/[0.02] border border-white/5 rounded-xl">
          <div className="w-12 h-12 rounded-full bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center">
            <Lightbulb size={20} className="text-yellow-400" />
          </div>
          <p className="text-sm font-medium text-white">Geen openstaande aanbevelingen</p>
          <p className="text-xs text-white/45">Het systeem genereert aanbevelingen op basis van gebruik en patronen</p>
        </div>
      ) : (
        <div className="space-y-3">
          {(pending as Suggestion[]).map(s => (
            <div key={s.id} className={`bg-white/[0.06] border ${IMPACT_COLORS[s.impact]?.split(' ')[2] ?? 'border-white/5'} rounded-xl p-4`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <Lightbulb size={14} className="text-yellow-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-white">{s.title}</p>
                      <span className={`px-1.5 py-0.5 rounded border text-[10px] font-medium ${IMPACT_COLORS[s.impact] ?? 'text-white/50 bg-white/5 border-white/10'}`}>
                        {s.impact} impact
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-white/5 text-[10px] text-white/38">
                        {TYPE_LABELS[s.type] ?? s.type}
                      </span>
                    </div>
                    <p className="text-xs text-white/60 mt-1.5 leading-relaxed">{s.description}</p>
                    <p className="text-[10px] text-white/30 mt-2">
                      {s.company} · {new Date(s.created_at).toLocaleString('nl-NL', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <form action={applySuggestion.bind(null, s.id)}>
                    <button type="submit" className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs transition-colors">
                      Toepassen
                    </button>
                  </form>
                  <form action={dismissSuggestion.bind(null, s.id)}>
                    <button type="submit" className="px-3 py-1.5 rounded-lg border border-white/10 text-white/50 hover:text-white/70 text-xs transition-colors">
                      Afwijzen
                    </button>
                  </form>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {(applied?.length ?? 0) > 0 && (
        <div className="bg-white/[0.06] border border-white/5 rounded-xl overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5">
            <CheckCircle2 size={13} className="text-green-400" />
            <h3 className="text-xs font-semibold text-white">Recent toegepast</h3>
          </div>
          <div className="divide-y divide-white/[0.03]">
            {(applied as Suggestion[]).map(s => (
              <div key={s.id} className="flex items-center gap-3 px-4 py-2.5">
                <CheckCircle2 size={11} className="text-green-400 flex-shrink-0" />
                <p className="text-xs text-white/60 flex-1">{s.title}</p>
                <span className="text-[10px] text-white/25">{s.applied_at ? new Date(s.applied_at).toLocaleDateString('nl-NL') : ''}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
