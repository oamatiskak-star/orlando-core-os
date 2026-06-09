import { createClient } from '@/lib/supabase/server'
import { FlaskConical, GitBranch } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function AbTestsPage() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('winner_extraction_jobs')
    .select('id, source_content_id, output_content_id, variant_kind, status, notes, created_at')
    .order('created_at', { ascending: false })
    .limit(200)

  const jobs = data ?? []

  return (
    <div className="space-y-4">
      <p className="text-xs text-white/45">
        A/B-varianten & winnaar-mutatie: winnaar → nieuwe varianten. Kleuren: groen = winnaar, rood = verliezer, neutraal = lopend.
      </p>

      {error && <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-300">Fout: {error.message}</div>}

      {jobs.length === 0 ? (
        <div className="rounded-lg border border-white/10 bg-[#0e1525] p-6">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <FlaskConical size={16} className="text-amber-400" />
            Nog geen variant-jobs
          </div>
          <p className="mt-2 max-w-2xl text-xs leading-relaxed text-white/50">
            De Winner Extraction Engine heeft nog geen runs gedraaid (<code className="text-white/70">winner_extraction_jobs</code> = 0).
            Zodra een creative als winnaar wordt gemarkeerd en de engine 1→N varianten genereert, verschijnt hier de
            mutatie-boom: <span className="text-white/70">bron-creative → afgeleide varianten</span>, met winnaar/verliezer-status.
            De graph-architectuur (winner-edges) staat al klaar — er is alleen nog geen data.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {jobs.map((j) => (
            <div key={j.id} className="flex items-center gap-3 rounded-lg border border-white/8 bg-[#0e1525] p-3 text-xs">
              <GitBranch size={14} className="text-emerald-400" />
              <span className="text-white/60">{j.variant_kind ?? 'variant'}</span>
              <span className="font-mono text-[10px] text-white/35">{String(j.source_content_id).slice(0, 8)} → {j.output_content_id ? String(j.output_content_id).slice(0, 8) : '…'}</span>
              <span className="ml-auto font-semibold uppercase text-white/50">{j.status}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
