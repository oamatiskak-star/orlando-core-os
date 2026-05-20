import { MapPin, AlertCircle } from 'lucide-react'
import { getAcqOffmarketLeads } from '@/lib/supabase/acquisition'

const STATUS_COLORS: Record<string, string> = {
  nieuw: 'text-sky-400 bg-sky-500/10',
  contacted: 'text-amber-400 bg-amber-500/10',
  afgewezen: 'text-red-400 bg-red-500/10',
  omgezet: 'text-emerald-400 bg-emerald-500/10',
}

const TYPE_COLORS: Record<string, string> = {
  leegstand: 'text-rose-400 bg-rose-500/10',
  faillissement: 'text-orange-400 bg-orange-500/10',
  slechte_staat: 'text-amber-400 bg-amber-500/10',
  energielabel_fg: 'text-red-400 bg-red-500/10',
  stilstand: 'text-violet-400 bg-violet-500/10',
  onderbenutt: 'text-sky-400 bg-sky-500/10',
}

export default async function OffmarketPage() {
  const leads = await getAcqOffmarketLeads()

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
          <MapPin size={16} className="text-rose-400" />
        </div>
        <div>
          <h1 className="text-base font-semibold text-white">OffMarket Engine</h1>
          <p className="text-xs text-white/50">Langdurige leegstand, faillissementen en distressed objecten — {leads.length} leads</p>
        </div>
      </div>

      {leads.length === 0 ? (
        <div className="bg-white/[0.02] border border-white/5 rounded-xl">
          <div className="flex flex-col items-center justify-center py-16 gap-2">
            <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center">
              <MapPin size={16} className="text-white/20" />
            </div>
            <p className="text-sm text-white/30">Geen off-market leads gevonden</p>
            <p className="text-xs text-white/20 text-center max-w-xs">Configureer OffMarketAI agent om automatisch distressed objecten te detecteren</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {leads.map(lead => (
            <a key={lead.id} href={`/dashboard/acquisition/offmarket/${lead.id}`}
              className="bg-white/[0.02] border border-white/5 rounded-xl p-4 hover:border-rose-500/20 transition-all group block">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <p className="text-sm font-medium text-white group-hover:text-rose-300 transition-colors">{lead.address}</p>
                  <p className="text-[11px] text-white/40 mt-0.5">{lead.city ?? '—'}{lead.province ? `, ${lead.province}` : ''}</p>
                </div>
                <span className={`px-2 py-0.5 rounded text-[10px] font-medium shrink-0 ${STATUS_COLORS[lead.status] ?? 'text-white/40 bg-white/5'}`}>
                  {lead.status}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {lead.lead_type && (
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${TYPE_COLORS[lead.lead_type] ?? 'text-white/40 bg-white/5'}`}>
                    {lead.lead_type.replace('_', ' ')}
                  </span>
                )}
                {Array.isArray(lead.distress_signals) && lead.distress_signals.slice(0, 3).map((sig: string) => (
                  <span key={sig} className="px-1.5 py-0.5 rounded text-[10px] bg-white/5 text-white/40">{sig}</span>
                ))}
              </div>
              {lead.days_vacant && (
                <p className="text-[11px] text-rose-400/70 flex items-center gap-1">
                  <AlertCircle size={10} /> {lead.days_vacant} dagen leegstand
                </p>
              )}
              {lead.roi_prognose && (
                <p className="text-[11px] text-emerald-400/70 mt-1">ROI prognose: {lead.roi_prognose.toFixed(1)}%</p>
              )}
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
