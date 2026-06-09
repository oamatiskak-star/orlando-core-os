import { createClient } from '@/lib/supabase/server'
import { FlaskConical } from 'lucide-react'
import WinnerTree, { type WinnerGroup, type WinnerVariant } from '@/components/war-room/WinnerTree'

export const dynamic = 'force-dynamic'

export default async function AbTestsPage() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('winner_extraction_jobs')
    .select('id, source_content_id, output_content_id, variant_kind, status, created_at')
    .order('created_at', { ascending: false })
    .limit(500)

  const jobs = data ?? []

  // creative-titels in één keer ophalen voor labels (source + output)
  const ids = Array.from(new Set(
    jobs.flatMap((j) => [j.source_content_id, j.output_content_id]).filter(Boolean) as string[]
  ))
  const titleById = new Map<string, string>()
  if (ids.length) {
    const { data: cis } = await supabase
      .from('media_holding_content_items')
      .select('id, title, hook')
      .in('id', ids)
    for (const c of cis ?? []) titleById.set(c.id, c.title || c.hook || c.id.slice(0, 8))
  }

  // groeperen per bron-creative
  const groupMap = new Map<string, WinnerGroup>()
  for (const j of jobs) {
    const src = j.source_content_id as string
    if (!groupMap.has(src)) {
      groupMap.set(src, { source_id: src, source_label: titleById.get(src) ?? src.slice(0, 8), variants: [] })
    }
    const v: WinnerVariant = {
      job_id: j.id,
      output_id: j.output_content_id,
      label: j.output_content_id ? (titleById.get(j.output_content_id) ?? j.output_content_id.slice(0, 8)) : '(in productie…)',
      status: j.status,
      variant_kind: j.variant_kind,
    }
    groupMap.get(src)!.variants.push(v)
  }
  const groups = [...groupMap.values()]

  return (
    <div className="space-y-4">
      <p className="text-xs text-white/45">
        Winnaar-mutatie: een winnende creative → nieuwe varianten. Kleuren: groen = winnaar/klaar, rood = verliezer/mislukt, oranje = lopend.
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
            mutatie-boom: <span className="text-white/70">bron-creative → afgeleide varianten</span>, met winnaar/verliezer/lopend-kleur.
            De graph leest live uit <code className="text-white/70">winner_extraction_jobs</code> — geen verdere wiring nodig.
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
