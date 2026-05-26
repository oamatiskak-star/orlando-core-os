'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  MapPin, ArrowLeft, AlertCircle, TrendingUp, MessageSquare,
  ExternalLink, CheckCircle, XCircle, PhoneCall, ArrowRight,
  Newspaper, Clock,
} from 'lucide-react'

interface Lead {
  id: string
  address: string
  city: string | null
  province: string | null
  lead_type: string | null
  distress_signals: string[]
  days_vacant: number | null
  roi_prognose: number | null
  contact_strategy: string | null
  dev_scenario: string | null
  owner_info: Record<string, unknown> | null
  notes: string | null
  source_url: string | null
  status: string
  detected_at: string
  created_at: string
}

const STATUS_COLORS: Record<string, string> = {
  nieuw:     'text-sky-400 bg-sky-500/10 border-sky-500/20',
  contacted: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  afgewezen: 'text-red-400 bg-red-500/10 border-red-500/20',
  omgezet:   'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
}

const TYPE_LABELS: Record<string, string> = {
  faillissement: 'Faillissement',
  stilstand:     'Stilgelegd project',
  leegstand:     'Leegstand',
  onderbenutt:   'Onderbenut',
  slechte_staat: 'Slechte staat',
}

export default function OffmarketDetailPage() {
  const params  = useParams()
  const router  = useRouter()
  const id      = params.id as string

  const [lead, setLead]         = useState<Lead | null>(null)
  const [loading, setLoading]   = useState(true)
  const [updating, setUpdating] = useState(false)

  useEffect(() => {
    fetch(`/api/acquisition/offmarket/${id}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { setLead(d?.data ?? null); setLoading(false) })
      .catch(() => setLoading(false))
  }, [id])

  async function updateStatus(status: string) {
    if (!lead) return
    setUpdating(true)
    const res = await fetch(`/api/acquisition/offmarket/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    if (res.ok) {
      const d = await res.json()
      setLead(d.data)
    }
    setUpdating(false)
  }

  async function convertToDeal() {
    if (!lead) return
    setUpdating(true)
    // Maak een acq_deal aan vanuit deze lead
    const res = await fetch('/api/acquisition/deals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title:          `${TYPE_LABELS[lead.lead_type ?? ''] ?? 'OffMarket'} — ${lead.address}`,
        address:        lead.address,
        city:           lead.city,
        province:       lead.province,
        deal_type:      lead.lead_type ?? 'offmarket',
        pipeline_stage: 'radar',
        source:         'offmarket_engine',
        notes:          lead.contact_strategy ?? lead.notes,
        roi_pct:        lead.roi_prognose,
      }),
    })
    if (res.ok) {
      const d = await res.json()
      await updateStatus('omgezet')
      router.push(`/dashboard/acquisition/deals/${d.data?.id ?? ''}`)
    }
    setUpdating(false)
  }

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <p className="text-xs text-white/30">Laden...</p>
    </div>
  )

  if (!lead) return (
    <div className="flex items-center justify-center py-20">
      <p className="text-xs text-white/30">Lead niet gevonden</p>
    </div>
  )

  // Extraheer bronlabel uit notes (format: "Titel — Bron: X")
  const noteParts  = (lead.notes ?? '').split(' — Bron: ')
  const noteTitle  = noteParts[0] || null
  const noteSource = noteParts[1] || null

  return (
    <div className="space-y-5 max-w-3xl">

      {/* Back */}
      <a href="/dashboard/acquisition/offmarket"
         className="flex items-center gap-1 text-xs text-white/40 hover:text-white/70 w-fit">
        <ArrowLeft size={12} /> OffMarket Engine
      </a>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mt-0.5">
            <MapPin size={16} className="text-rose-400" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-white">{lead.address}</h1>
            <p className="text-xs text-white/50 mt-0.5">
              {lead.city ?? '—'}{lead.province ? `, ${lead.province}` : ''}
            </p>
          </div>
        </div>
        <span className={`px-2 py-1 rounded-lg text-xs font-medium border shrink-0 ${STATUS_COLORS[lead.status] ?? 'text-white/40 bg-white/5 border-white/5'}`}>
          {lead.status}
        </span>
      </div>

      {/* ── BRON SIGNAAL ─────────────────────────────────────────────────────── */}
      <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4 space-y-3">
        <p className="text-xs text-white/50 font-medium uppercase tracking-wide">Gevonden Signaal</p>

        <div className="flex flex-wrap gap-2">
          {lead.lead_type && (
            <span className="px-2 py-1 rounded-lg text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
              {TYPE_LABELS[lead.lead_type] ?? lead.lead_type}
            </span>
          )}
          {Array.isArray(lead.distress_signals) && lead.distress_signals.map((sig: string) => (
            <span key={sig} className="px-2 py-1 rounded-lg text-xs bg-white/5 text-white/50 border border-white/5">
              {sig}
            </span>
          ))}
        </div>

        {noteTitle && (
          <p className="text-sm text-white/70">{noteTitle}</p>
        )}

        <div className="flex items-center gap-3 flex-wrap pt-1">
          {noteSource && (
            <span className="flex items-center gap-1 text-xs text-white/30">
              <Newspaper size={11} /> {noteSource}
            </span>
          )}
          {lead.days_vacant && (
            <span className="flex items-center gap-1 text-xs text-rose-400">
              <AlertCircle size={11} /> {lead.days_vacant} dagen leegstand
            </span>
          )}
          <span className="flex items-center gap-1 text-xs text-white/30">
            <Clock size={11} /> {new Date(lead.created_at ?? lead.detected_at).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })}
          </span>
        </div>

        {/* Bronlink */}
        {lead.source_url && (
          <a
            href={lead.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-white/70 hover:text-white transition-colors w-fit"
          >
            <ExternalLink size={12} />
            Bekijk origineel bericht
          </a>
        )}
      </div>

      {/* ── ACTIES ────────────────────────────────────────────────────────────── */}
      {lead.status !== 'omgezet' && lead.status !== 'afgewezen' && (
        <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
          <p className="text-xs text-white/50 font-medium uppercase tracking-wide mb-3">Vervolgstappen</p>
          <div className="flex flex-wrap gap-2">

            {lead.status === 'nieuw' && (
              <button
                onClick={() => updateStatus('contacted')}
                disabled={updating}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 text-xs text-amber-400 transition-colors disabled:opacity-50"
              >
                <PhoneCall size={12} /> Markeer als Gecontacteerd
              </button>
            )}

            <button
              onClick={convertToDeal}
              disabled={updating}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-xs text-emerald-400 transition-colors disabled:opacity-50"
            >
              <ArrowRight size={12} /> Omzetten naar Deal
            </button>

            <button
              onClick={() => updateStatus('afgewezen')}
              disabled={updating}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-xs text-red-400 transition-colors disabled:opacity-50"
            >
              <XCircle size={12} /> Afwijzen
            </button>
          </div>
        </div>
      )}

      {lead.status === 'omgezet' && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-emerald-500/5 border border-emerald-500/15 text-xs text-emerald-400">
          <CheckCircle size={13} /> Omgezet naar deal
        </div>
      )}

      {/* ── SCENARIO + STRATEGIE ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
          <p className="text-xs text-white/50 font-medium uppercase tracking-wide mb-2">Ontwikkelscenario</p>
          {lead.dev_scenario ? (
            <p className="text-sm text-white/70 whitespace-pre-wrap leading-relaxed">{lead.dev_scenario}</p>
          ) : (
            <div className="flex flex-col items-center py-6 gap-2">
              <TrendingUp size={14} className="text-white/20" />
              <p className="text-xs text-white/30">Nog geen AI-scenario</p>
            </div>
          )}
          {lead.roi_prognose != null && (
            <div className="mt-3 pt-3 border-t border-white/5">
              <p className="text-[11px] text-white/40">ROI Prognose</p>
              <p className="text-lg font-bold text-emerald-400">{lead.roi_prognose.toFixed(1)}%</p>
            </div>
          )}
        </div>

        <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
          <p className="text-xs text-white/50 font-medium uppercase tracking-wide mb-2">Contactstrategie</p>
          {lead.contact_strategy ? (
            <p className="text-sm text-white/70 whitespace-pre-wrap leading-relaxed">{lead.contact_strategy}</p>
          ) : (
            <div className="flex flex-col items-center py-6 gap-2">
              <MessageSquare size={14} className="text-white/20" />
              <p className="text-xs text-white/30">Geen contactstrategie</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
