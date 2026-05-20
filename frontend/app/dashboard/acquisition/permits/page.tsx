import { ScrollText, ExternalLink } from 'lucide-react'
import { getAcqPermits } from '@/lib/supabase/acquisition'

const STATUS_COLORS: Record<string, string> = {
  aangevraagd: 'text-sky-400 bg-sky-500/10',
  verleend: 'text-emerald-400 bg-emerald-500/10',
  geweigerd: 'text-red-400 bg-red-500/10',
  bezwaar: 'text-orange-400 bg-orange-500/10',
  ingetrokken: 'text-white/40 bg-white/5',
}

export default async function PermitsPage() {
  const permits = await getAcqPermits()

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
          <ScrollText size={16} className="text-violet-400" />
        </div>
        <div>
          <h1 className="text-base font-semibold text-white">Permit Intelligence</h1>
          <p className="text-xs text-white/50">Vergunningaanvragen en bestemmingswijzigingen — {permits.length} gevonden</p>
        </div>
      </div>

      {permits.length === 0 ? (
        <div className="bg-white/[0.02] border border-white/5 rounded-xl">
          <div className="flex flex-col items-center justify-center py-16 gap-2">
            <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center">
              <ScrollText size={16} className="text-white/20" />
            </div>
            <p className="text-sm text-white/30">Geen vergunningen gevonden</p>
            <p className="text-xs text-white/20 text-center max-w-xs">PermitAI agent scant omgevingsloket.nl voor relevante vergunningaanvragen</p>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {permits.map(permit => (
            <div key={permit.id} className="bg-white/[0.02] border border-white/5 rounded-xl px-4 py-3 flex items-start justify-between gap-4 hover:border-white/10 transition-colors">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-sm font-medium text-white truncate">{permit.address ?? permit.municipality}</p>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-medium shrink-0 ${STATUS_COLORS[permit.status] ?? 'text-white/40 bg-white/5'}`}>
                    {permit.status}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-[11px] text-white/40">
                  <span>{permit.municipality}</span>
                  {permit.permit_type && <span>· {permit.permit_type}</span>}
                  {permit.applicant && <span>· {permit.applicant}</span>}
                  {permit.area_m2 && <span>· {permit.area_m2} m²</span>}
                </div>
                {permit.submitted_at && (
                  <p className="text-[10px] text-white/30 mt-1">Ingediend: {new Date(permit.submitted_at).toLocaleDateString('nl-NL')}</p>
                )}
              </div>
              <div className="flex items-center gap-3 shrink-0">
                {permit.relevance_score !== null && (
                  <div className="text-center">
                    <p className="text-[9px] text-white/30">Relevantie</p>
                    <span className={`text-sm font-bold ${
                      (permit.relevance_score) >= 70 ? 'text-emerald-400' :
                      (permit.relevance_score) >= 40 ? 'text-amber-400' :
                      'text-white/40'
                    }`}>{permit.relevance_score}</span>
                  </div>
                )}
                {permit.source_url && (
                  <a href={permit.source_url} target="_blank" rel="noopener noreferrer"
                    className="text-white/30 hover:text-white/60 transition-colors">
                    <ExternalLink size={13} />
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
