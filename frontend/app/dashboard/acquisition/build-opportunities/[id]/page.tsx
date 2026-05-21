import { notFound } from 'next/navigation'
import { HardHat, ArrowLeft, ExternalLink } from 'lucide-react'
import { getAcqBuildOppById } from '@/lib/supabase/acquisition'

function fmt(n: number | null) {
  if (!n) return '—'
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)
}

const STAGE_COLORS: Record<string, string> = {
  signalering: 'text-sky-400 bg-sky-500/10',
  analyse: 'text-amber-400 bg-amber-500/10',
  inschrijving: 'text-violet-400 bg-violet-500/10',
  gewonnen: 'text-emerald-400 bg-emerald-500/10',
  verloren: 'text-red-400 bg-red-500/10',
}

export default async function BouwOppDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const opp = await getAcqBuildOppById(id)
  if (!opp) notFound()

  return (
    <div className="space-y-5 max-w-4xl">
      <div>
        <a href="/dashboard/acquisition/build-opportunities" className="flex items-center gap-1 text-xs text-white/40 hover:text-white/70 mb-3 w-fit">
          <ArrowLeft size={12} /> Terug naar BouwRadar
        </a>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center mt-0.5">
              <HardHat size={16} className="text-orange-400" />
            </div>
            <div>
              <h1 className="text-base font-semibold text-white">{opp.title}</h1>
              <div className="flex items-center gap-2 mt-1">
                {opp.municipality && <span className="text-xs text-white/50">{opp.municipality}</span>}
                {opp.province && <span className="text-xs text-white/30">· {opp.province}</span>}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className={`px-2 py-1 rounded-lg text-xs font-medium ${STAGE_COLORS[opp.pipeline_stage] ?? 'text-white/40 bg-white/5'}`}>
              {opp.pipeline_stage}
            </span>
            {opp.source_url && (
              <a href={opp.source_url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1 px-2 py-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs text-white/50 transition-colors">
                <ExternalLink size={11} /> Bron
              </a>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
          <p className="text-xs text-white/50 font-medium uppercase tracking-wide mb-3">Details</p>
          <div className="space-y-3">
            <div>
              <p className="text-[11px] text-white/40">Klant</p>
              <p className="text-sm font-semibold text-white mt-0.5">{opp.client ?? '—'}</p>
            </div>
            <div>
              <p className="text-[11px] text-white/40">Geschatte Waarde</p>
              <p className="text-sm font-semibold text-white mt-0.5">{fmt(opp.estimated_value)}</p>
            </div>
            {opp.opp_type && (
              <div>
                <p className="text-[11px] text-white/40">Type</p>
                <p className="text-sm font-semibold text-white mt-0.5">{opp.opp_type}</p>
              </div>
            )}
            {opp.deadline && (
              <div>
                <p className="text-[11px] text-white/40">Deadline</p>
                <p className="text-sm font-semibold text-white mt-0.5">{new Date(opp.deadline).toLocaleDateString('nl-NL')}</p>
              </div>
            )}
            {opp.source && (
              <div>
                <p className="text-[11px] text-white/40">Bron</p>
                <p className="text-sm font-semibold text-white mt-0.5">{opp.source}</p>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
          <p className="text-xs text-white/50 font-medium uppercase tracking-wide mb-3">Locatie</p>
          <div className="space-y-3">
            {opp.municipality && (
              <div>
                <p className="text-[11px] text-white/40">Gemeente</p>
                <p className="text-sm font-semibold text-white mt-0.5">{opp.municipality}</p>
              </div>
            )}
            {opp.province && (
              <div>
                <p className="text-[11px] text-white/40">Provincie</p>
                <p className="text-sm font-semibold text-white mt-0.5">{opp.province}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {opp.notes && (
        <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
          <p className="text-xs text-white/50 font-medium uppercase tracking-wide mb-2">Notities</p>
          <p className="text-sm text-white/70 whitespace-pre-wrap">{opp.notes}</p>
        </div>
      )}
    </div>
  )
}
