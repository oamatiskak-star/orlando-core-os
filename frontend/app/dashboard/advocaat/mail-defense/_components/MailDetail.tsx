'use client'

import { useState } from 'react'
import { Mail, AlertTriangle, Clock, Brain, CheckCircle, Pencil } from 'lucide-react'
import type { MailDefenseItem } from '@/lib/advocaat/types'

const CLASS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  curator_bericht:    { label: 'Curator',           color: 'text-red-400',     bg: 'bg-red-500/8 border-red-500/25' },
  dagvaarding:        { label: 'Dagvaarding',       color: 'text-red-400',     bg: 'bg-red-500/8 border-red-500/25' },
  ingebrekestelling:  { label: 'Ingebrekestelling', color: 'text-orange-400',  bg: 'bg-orange-500/8 border-orange-500/25' },
  sommatiebrief:      { label: 'Sommatie',          color: 'text-orange-400',  bg: 'bg-orange-500/8 border-orange-500/25' },
  vonnis:             { label: 'Vonnis',            color: 'text-red-400',     bg: 'bg-red-500/8 border-red-500/25' },
  incasso:            { label: 'Incasso',           color: 'text-yellow-400',  bg: 'bg-yellow-500/8 border-white/[0.06]' },
  deadline_alert:     { label: 'Deadline',          color: 'text-orange-400',  bg: 'bg-orange-500/5 border-orange-500/15' },
  juridisch_neutraal: { label: 'Juridisch',         color: 'text-blue-400',    bg: 'bg-blue-500/5 border-blue-500/15' },
  neutraal:           { label: 'Neutraal',          color: 'text-white/40',    bg: 'bg-white/[0.03] border-white/[0.07]' },
}

const URGENCY_COLOR: Record<string, string> = {
  kritiek: 'text-red-400 bg-red-500/10 border-red-500/30',
  hoog:    'text-orange-400 bg-orange-500/10 border-orange-500/25',
  medium:  'text-yellow-400 bg-yellow-500/8 border-white/[0.06]',
  laag:    'text-white/40 bg-white/[0.04] border-white/[0.08]',
}

function fmt(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })
}

function daysUntil(d: string | null) {
  if (!d) return null
  return Math.ceil((new Date(d).getTime() - Date.now()) / 86400000)
}

interface Props {
  item: MailDefenseItem
  onCompose: () => void
  onRefresh: () => void
}

export function MailDetail({ item, onCompose }: Props) {
  const [expanded, setExpanded] = useState(false)

  const cc = CLASS_CONFIG[item.classification] ?? CLASS_CONFIG.neutraal
  const dl = daysUntil(item.deadline_detected)

  return (
    <div className="space-y-4">

      {/* 1. Header card */}
      <div className={`p-4 rounded-xl border ${cc.bg}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-white leading-snug">
              {item.subject ?? '(Geen onderwerp)'}
            </h3>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {item.from_name && (
                <span className="text-xs text-white/40">{item.from_name}</span>
              )}
              {item.from_address && (
                <span className="text-xs text-white/40">{item.from_address}</span>
              )}
              <span className="text-xs text-white/30">{fmt(item.received_at)}</span>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <span className={`text-[10px] font-bold px-2 py-1 rounded border ${URGENCY_COLOR[item.urgency] ?? URGENCY_COLOR.laag}`}>
              {item.urgency.toUpperCase()}
            </span>
            <span className="text-[9px] text-white/30">Risico: {item.risk_score}/100</span>
          </div>
        </div>

        {item.classification !== 'neutraal' && (
          <div className="mt-3 p-2 rounded-lg bg-black/20">
            <span className={`text-xs font-bold ${cc.color}`}>
              ⚠ Classificatie: {cc.label}
            </span>
          </div>
        )}
      </div>

      {/* 2. Body text preview */}
      {item.body_text && (
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-3">
          <div className="flex items-center gap-2 mb-2">
            <Mail className="w-3.5 h-3.5 text-white/40 shrink-0" />
            <span className="text-xs font-medium text-white/70">Originele mail tekst</span>
          </div>
          <p className="text-xs text-white/50 leading-relaxed whitespace-pre-wrap">
            {expanded ? item.body_text : item.body_text.slice(0, 300)}
            {!expanded && item.body_text.length > 300 && '…'}
          </p>
          {item.body_text.length > 300 && (
            <button
              onClick={() => setExpanded(prev => !prev)}
              className="mt-2 text-[10px] text-white/40 hover:text-white/70 transition-colors underline underline-offset-2"
            >
              {expanded ? 'Minder tonen' : 'Meer tonen'}
            </button>
          )}
        </div>
      )}

      {/* 3. Deadline block */}
      {item.deadline_detected && (
        <div className={`flex items-start gap-3 p-3 rounded-xl border ${dl !== null && dl <= 7 ? 'bg-red-500/8 border-red-500/25' : 'bg-orange-500/5 border-orange-500/15'}`}>
          <Clock className={`w-4 h-4 shrink-0 mt-0.5 ${dl !== null && dl <= 7 ? 'text-red-400' : 'text-orange-400'}`} />
          <div>
            <div className="text-xs font-medium text-white">
              Deadline gedetecteerd: {fmt(item.deadline_detected)}
            </div>
            {item.deadline_text && (
              <div className="text-[10px] text-white/50 mt-0.5 italic">
                &quot;{item.deadline_text}&quot;
              </div>
            )}
            {dl !== null && (
              <div className={`text-xs font-bold mt-1 ${dl <= 7 ? 'text-red-400' : 'text-orange-400'}`}>
                Nog {dl} dag{dl !== 1 ? 'en' : ''}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 4. Action required block */}
      {item.action_required && (
        <div className="p-3 rounded-xl bg-orange-500/8 border border-orange-500/20">
          <div className="flex items-center gap-2 mb-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-orange-400 shrink-0" />
            <span className="text-xs font-medium text-orange-300">Actie Vereist</span>
          </div>
          <p className="text-xs text-white/60 leading-relaxed">
            {item.action_description ?? 'Zie AI analyse voor aanbevolen actie.'}
          </p>
        </div>
      )}

      {/* 5. AI Summary block */}
      {item.ai_summary && (
        <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.07]">
          <div className="flex items-center gap-2 mb-2">
            <Brain className="w-3.5 h-3.5 text-violet-400 shrink-0" />
            <span className="text-xs font-medium text-white">AI Analyse</span>
          </div>
          <p className="text-xs text-white/60 leading-relaxed">{item.ai_summary}</p>
        </div>
      )}

      {/* 6. AI Draft already exists block */}
      {item.ai_draft && (
        <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
          <div className="flex items-center gap-2 mb-1.5">
            <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="text-xs font-medium text-emerald-300">AI concept reeds aangemaakt</span>
          </div>
          {item.draft_created_at && (
            <p className="text-[10px] text-white/40 mb-2">
              Aangemaakt op {fmt(item.draft_created_at)}
            </p>
          )}
          <pre className="text-[10px] text-white/30 font-mono leading-relaxed whitespace-pre-wrap break-all mb-3 bg-black/20 rounded-lg p-2">
            {item.ai_draft.slice(0, 200)}{item.ai_draft.length > 200 ? '…' : ''}
          </pre>
          <button
            onClick={onCompose}
            className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors underline underline-offset-2"
          >
            Heropen concept
          </button>
        </div>
      )}

      {/* 7. Compose CTA */}
      <button
        onClick={onCompose}
        className="flex items-center gap-2 bg-orange-500 hover:bg-orange-400 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors w-full justify-center"
      >
        <Pencil className="w-4 h-4 shrink-0" />
        {item.ai_draft ? 'AI Antwoord aanpassen' : 'Stel AI Antwoord op'}
      </button>

      {/* 8. NEVER AUTO-SEND footer */}
      <div className="flex items-center gap-2 p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] text-[10px] text-white/30">
        <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
        Dit systeem genereert alleen concepten. Nooit automatisch verzonden.
      </div>

    </div>
  )
}
