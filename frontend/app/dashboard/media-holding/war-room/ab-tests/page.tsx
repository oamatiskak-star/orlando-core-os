import { createClient } from '@/lib/supabase/server'
import { FlaskConical } from 'lucide-react'
import WinnerTree, { type WinnerGroup, type WinnerVariant, type VariantDecision } from '@/components/war-room/WinnerTree'

export const dynamic = 'force-dynamic'

const PRODUCING = ['pending', 'rendering', 'processing', 'dispatched', 'preparing', 'queued']
const WON = ['published', 'ready', 'verified_live', 'live', 'winner']
const LOST = ['failed', 'unrecoverable', 'rejected', 'archived', 'skipped', 'loser']

// auto-besluit per bron-creative (Experiment Engine, laag 4)
function decide(variants: WinnerVariant[]): VariantDecision {
  if (variants.length === 0) return 'unknown'
  const st = variants.map((v) => (v.status ?? '').toLowerCase())
  if (st.some((s) => PRODUCING.includes(s))) return 'keep_testing'
  if (st.some((s) => WON.includes(s))) return 'scale'
  if (st.every((s) => LOST.includes(s))) return 'stop'
  return 'keep_testing'
}

export default async function AbTestsPage() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('winner_extraction_jobs')
    .select('id, source_content_id, output_content_id, variant_kind, status, created_at')
    .order('created_at', { ascending: false })
    .limit(500)

  const jobs = data ?? []

  // creative-titels + laatste metrics in één keer ophalen (source + output)
  const ids = Array.from(new Set(
    jobs.flatMap((j) => [j.source_content_id, j.output_content_id]).filter(Boolean) as string[]
  ))
  const titleById = new Map<string, string>()
  const metricById = new Map<string, { views: number | null; ctr: number | null; retention: number | null }>()
  if (ids.length) {
    const [{ data: cis }, { data: mets }] = await Promise.all([
      supabase.from('media_holding_content_items').select('id, title, hook').in('id', ids),
      supabase.from('media_holding_metrics').select('content_item_id, views, ctr_pct, retention_pct, snapshot_at')
        .in('content_item_id', ids).order('snapshot_at', { ascending: false }),
    ])
    for (const c of cis ?? []) titleById.set(c.id, c.title || c.hook || c.id.slice(0, 8))
    for (const m of mets ?? []) {
      if (!metricById.has(m.content_item_id)) {
        metricById.set(m.content_item_id, {
          views: m.views != null ? Number(m.views) : null,
          ctr: m.ctr_pct != null ? Number(m.ctr_pct) : null,
          retention: m.retention_pct != null ? Number(m.retention_pct) : null,
        })
      }
    }
  }

  // groeperen per bron-creative
  const groupMap = new Map<string, WinnerGroup>()
  for (const j of jobs) {
    const src = j.source_content_id as string
    if (!groupMap.has(src)) {
      groupMap.set(src, { source_id: src, source_label: titleById.get(src) ?? src.slice(0, 8), decision: 'unknown', variants: [] })
    }
    const m = j.output_content_id ? metricById.get(j.output_content_id) : undefined
    const v: WinnerVariant = {
      job_id: j.id,
      output_id: j.output_content_id,
      label: j.output_content_id ? (titleById.get(j.output_content_id) ?? j.output_content_id.slice(0, 8)) : '(in productie…)',
      status: j.status,
      variant_kind: j.variant_kind,
      views: m?.views ?? null,
      ctr: m?.ctr ?? null,
      retention: m?.retention ?? null,
    }
    groupMap.get(src)!.variants.push(v)
  }
  const groups = [...groupMap.values()].map((g) => ({ ...g, decision: decide(g.variants) }))

  return (
    <div className="space-y-4">
      <p className="text-xs text-white/45">
        Experiment Engine: een winnende creative → nieuwe varianten met eigen metrics. Auto-besluit per bron:
        <span className="text-emerald-400"> opschalen</span> · <span className="text-amber-400">blijf testen</span> · <span className="text-red-400">stoppen</span>.
      </p>

      {error && <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-300">Fout: {error.message}</div>}

      {groups.length === 0 ? (
        <div className="rounded-lg border border-white/10 bg-[#0e1525] p-6">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <FlaskConical size={16} className="text-amber-400" />
            Nog geen variant-jobs
          </div>
          <p className="mt-2 max-w-2xl text-xs leading-relaxed text-white/50">
            De Winner Extraction Engine heeft nog geen runs gedraaid (<code className="text-white/70">winner_extraction_jobs</code> = 0).
            Zodra een creative als winnaar wordt gemarkeerd en de engine 1→N varianten genereert, verschijnt hier automatisch de
            mutatie-boom met per-variant Views/CTR/Retentie + auto-besluit (opschalen/blijf testen/stoppen). Geen verdere wiring nodig.
          </p>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-4 text-xs text-white/45">
            <span>{groups.length} winnaar{groups.length === 1 ? '' : 's'}</span>
            <span>{jobs.length} variant-jobs</span>
          </div>
          <WinnerTree groups={groups} />
        </>
      )}
    </div>
  )
}
