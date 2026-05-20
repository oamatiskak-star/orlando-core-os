import { notFound } from 'next/navigation'
import { MapPin, ArrowLeft, AlertCircle, TrendingUp, User, MessageSquare } from 'lucide-react'
import { getAcqOffmarketLeadById } from '@/lib/supabase/acquisition'

const STATUS_COLORS: Record<string, string> = {
  nieuw: 'text-sky-400 bg-sky-500/10',
  contacted: 'text-amber-400 bg-amber-500/10',
  afgewezen: 'text-red-400 bg-red-500/10',
  omgezet: 'text-emerald-400 bg-emerald-500/10',
}

export default async function OffmarketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const lead = await getAcqOffmarketLeadById(id)
  if (!lead) notFound()

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <a href="/dashboard/acquisition/offmarket" className="flex items-center gap-1 text-xs text-white/40 hover:text-white/70 mb-3 w-fit">
          <ArrowLeft size={12} /> OffMarket Engine
        </a>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mt-0.5">
              <MapPin size={16} className="text-rose-400" />
            </div>
            <div>
              <h1 className="text-base font-semibold text-white">{lead.address}</h1>
              <p className="text-xs text-white/50 mt-0.5">{lead.city ?? '—'}{lead.province ? `, ${lead.province}` : ''}</p>
            </div>
          </div>
          <span className={`px-2 py-1 rounded-lg text-xs font-medium shrink-0 ${STATUS_COLORS[lead.status] ?? 'text-white/40 bg-white/5'}`}>
            {lead.status}
          </span>
        </div>
      </div>

      {/* Distress signals */}
      <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
        <p className="text-xs text-white/50 font-medium uppercase tracking-wide mb-3">Distress Signalen</p>
        <div className="flex flex-wrap gap-2 mb-3">
          {lead.lead_type && (
            <span className="px-2 py-1 rounded-lg text-xs font-medium bg-rose-500/10 text-rose-400">{lead.lead_type.replace('_', ' ')}</span>
          )}
          {Array.isArray(lead.distress_signals) && lead.distress_signals.map((sig: string) => (
            <span key={sig} className="px-2 py-1 rounded-lg text-xs bg-white/5 text-white/50">{sig}</span>
          ))}
        </div>
        {lead.days_vacant && (
          <p className="flex items-center gap-1.5 text-sm text-rose-400">
            <AlertCircle size={14} /> {lead.days_vacant} dagen leegstand
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Ontwikkelscenario */}
        <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
          <p className="text-xs text-white/50 font-medium uppercase tracking-wide mb-2">Ontwikkelscenario</p>
          {lead.dev_scenario ? (
            <p className="text-sm text-white/70 whitespace-pre-wrap">{lead.dev_scenario}</p>
          ) : (
            <div className="flex flex-col items-center py-6 gap-2">
              <TrendingUp size={14} className="text-white/20" />
              <p className="text-xs text-white/30">Nog geen scenario gegenereerd</p>
            </div>
          )}
          {lead.roi_prognose && (
            <div className="mt-3 pt-3 border-t border-white/5">
              <p className="text-[11px] text-white/40">ROI Prognose</p>
              <p className="text-lg font-bold text-emerald-400">{lead.roi_prognose.toFixed(1)}%</p>
            </div>
          )}
        </div>

        {/* Contactstrategie */}
        <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
          <p className="text-xs text-white/50 font-medium uppercase tracking-wide mb-2">Contactstrategie</p>
          {lead.contact_strategy ? (
            <p className="text-sm text-white/70 whitespace-pre-wrap">{lead.contact_strategy}</p>
          ) : (
            <div className="flex flex-col items-center py-6 gap-2">
              <MessageSquare size={14} className="text-white/20" />
              <p className="text-xs text-white/30">Geen contactstrategie</p>
            </div>
          )}
        </div>
      </div>

      {/* Owner info */}
      {lead.owner_info && Object.keys(lead.owner_info).length > 0 && (
        <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
          <p className="text-xs text-white/50 font-medium uppercase tracking-wide mb-2">Eigenaar Info</p>
          <div className="flex items-start gap-2">
            <User size={12} className="text-white/40 mt-0.5" />
            <pre className="text-xs text-white/60 whitespace-pre-wrap">{JSON.stringify(lead.owner_info, null, 2)}</pre>
          </div>
        </div>
      )}

      {/* Notes */}
      {lead.notes && (
        <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
          <p className="text-xs text-white/50 font-medium uppercase tracking-wide mb-2">Notities</p>
          <p className="text-sm text-white/70 whitespace-pre-wrap">{lead.notes}</p>
        </div>
      )}

      <p className="text-[11px] text-white/20">Gedetecteerd op {new Date(lead.detected_at).toLocaleDateString('nl-NL')}</p>
    </div>
  )
}
