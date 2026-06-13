'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ExternalLink, Loader2, Check, AlertTriangle, Clock } from 'lucide-react'
import { resolveHumanAction } from '../actions'

export type ManualAction = {
  id: string
  program_id: string | null
  action_kind: string
  title: string
  description: string | null
  status: string
  due_at: string | null
  created_at: string
  metadata: Record<string, unknown> | null
  program: { name: string; url: string | null } | null
}

// Verwachte tijd per soort actie (mission Fase 3: "verwachte tijd").
const EST_TIME: Record<string, string> = {
  kyc_upload: '~10 min',
  sms_verify: '~2 min',
  captcha: '~1 min',
  manual_review: '~5 min',
  tax_form: '~15 min',
  payout_setup: '~10 min',
  login_2fa: '~2 min',
  approve_submit: '~1 min',
  approve_action: '~1 min',
  other: '~5 min',
}

// Volgende stap per soort actie.
const NEXT_STEP: Record<string, string> = {
  kyc_upload: 'Upload de gevraagde documenten en markeer als afgerond.',
  sms_verify: 'Voer de SMS-code in het browservenster in.',
  captcha: 'Los de CAPTCHA op in het Chrome-venster op de Mac.',
  manual_review: 'Open de aanmeldpagina, rond de affiliate-aanvraag af en voer daarna de referral-code in.',
  tax_form: 'Vul het belastingformulier in bij de affiliate-partner.',
  payout_setup: 'Stel de uitbetalingsgegevens in en vraag payout aan.',
  login_2fa: 'Bevestig de 2FA in het browservenster.',
  approve_submit: 'Controleer de ingevulde velden en keur verzending goed.',
  approve_action: 'Keur de voorgestelde actie goed om door te gaan.',
  other: 'Rond de actie af en markeer als afgerond.',
}

function urlOf(a: ManualAction): string | null {
  const m = a.metadata ?? {}
  const su = m['signup_url']
  if (typeof su === 'string' && su) return su
  return a.program?.url ?? null
}

function neededOf(a: ManualAction): string | null {
  const m = a.metadata ?? {}
  const field = m['field']
  const source = m['source']
  if (typeof field === 'string' && field) return `Veld: ${field}${typeof source === 'string' ? ` (${source})` : ''}`
  return null
}

export default function ManualRequiredCards({ initialActions }: { initialActions: ManualAction[] }) {
  const router = useRouter()
  const [actions, setActions] = useState<ManualAction[]>(initialActions)
  const [busy, setBusy] = useState<string | null>(null)

  async function resolve(id: string) {
    setBusy(id)
    try {
      const fd = new FormData()
      fd.set('action_id', id)
      fd.set('decision', 'resolved')
      await resolveHumanAction(fd)
      setActions(prev => prev.filter(a => a.id !== id))
      router.refresh()
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <AlertTriangle size={14} className="text-amber-400" />
        <h2 className="text-sm font-semibold text-white">Manual Required</h2>
        <span className="text-[10px] text-white/40">{actions.length} verplichte actie{actions.length === 1 ? '' : 's'}</span>
      </div>

      {actions.length === 0 ? (
        <div className="bg-white/[0.04] border border-white/8 rounded-xl p-6 text-center">
          <Check size={20} className="mx-auto text-emerald-400/70 mb-2" />
          <p className="text-xs text-white/55">Geen menselijke acties open. Hermes voert alles automatisch uit.</p>
        </div>
      ) : (
        <div className="grid gap-2.5 md:grid-cols-2">
          {actions.map((a) => {
            const url = urlOf(a)
            const needed = neededOf(a)
            return (
              <div key={a.id} className="bg-amber-500/[0.06] border border-amber-500/25 rounded-xl p-3.5">
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <div className="min-w-0">
                    <p className="text-[9px] uppercase tracking-wider text-amber-300/70 font-semibold">MANUAL REQUIRED · {a.program?.name ?? 'programma'}</p>
                    <p className="text-[13px] font-semibold text-white leading-tight">{a.title}</p>
                  </div>
                  <span className="shrink-0 inline-flex items-center gap-1 text-[10px] text-amber-200/80">
                    <Clock size={10} /> {EST_TIME[a.action_kind] ?? '~5 min'}
                  </span>
                </div>

                {a.description && <p className="text-[11px] text-white/60 mb-2">{a.description}</p>}

                <dl className="space-y-1 mb-3 text-[10px]">
                  {url && (
                    <div className="flex gap-1.5">
                      <dt className="text-white/40 w-16 shrink-0">URL</dt>
                      <dd className="min-w-0"><a href={url} target="_blank" rel="noreferrer" className="text-cyan-300 hover:text-cyan-200 inline-flex items-center gap-1 truncate">{url} <ExternalLink size={9} className="shrink-0" /></a></dd>
                    </div>
                  )}
                  {needed && (
                    <div className="flex gap-1.5"><dt className="text-white/40 w-16 shrink-0">Benodigd</dt><dd className="text-white/65">{needed}</dd></div>
                  )}
                  <div className="flex gap-1.5"><dt className="text-white/40 w-16 shrink-0">Volgende</dt><dd className="text-white/65">{NEXT_STEP[a.action_kind] ?? NEXT_STEP.other}</dd></div>
                </dl>

                <div className="flex items-center gap-2">
                  {url && (
                    <a href={url} target="_blank" rel="noreferrer"
                      className="inline-flex items-center gap-1 bg-cyan-500/15 border border-cyan-500/30 hover:bg-cyan-500/25 text-cyan-200 text-[10px] font-medium px-2.5 py-1 rounded-lg">
                      <ExternalLink size={11} /> Open
                    </a>
                  )}
                  <button onClick={() => resolve(a.id)} disabled={busy === a.id}
                    className="inline-flex items-center gap-1 bg-emerald-500/15 border border-emerald-500/30 hover:bg-emerald-500/25 disabled:opacity-50 text-emerald-200 text-[10px] font-medium px-2.5 py-1 rounded-lg">
                    {busy === a.id ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />} Afgerond
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
