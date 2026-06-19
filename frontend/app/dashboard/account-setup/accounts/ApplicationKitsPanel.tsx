'use client'

import { useState } from 'react'
import { ExternalLink, Copy, Check } from 'lucide-react'
import {
  APPLICATION_PROFILE, APPLICATION_KITS, PROMO_METHOD_EN, CHANNEL_URLS,
} from '@/lib/affiliate-programs/application-kit'
import { LiveAssistSession } from './LiveAssistSession'

function CopyBtn({ text }: { text: string }) {
  const [done, setDone] = useState(false)
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text)
          setDone(true)
          setTimeout(() => setDone(false), 1200)
        } catch { /* clipboard kan geblokkeerd zijn */ }
      }}
      className="shrink-0 text-white/35 hover:text-white/80 transition-colors"
      title="Kopieer"
      aria-label="Kopieer"
    >
      {done ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
    </button>
  )
}

function Field({ label, value, sensitive }: { label: string; value: string; sensitive?: boolean }) {
  return (
    <div className="flex items-start gap-2 py-1">
      <span className="w-36 shrink-0 text-[10px] uppercase tracking-wide text-white/35">{label}</span>
      <span className={`flex-1 text-[11px] font-mono break-all ${sensitive ? 'text-amber-300/80' : 'text-white/80'}`}>
        {value}
      </span>
      <CopyBtn text={value} />
    </div>
  )
}

const COMPLIANCE_DOT = (c?: string) => {
  if (!c) return 'bg-white/20'
  if (c.startsWith('GROEN')) return 'bg-emerald-400/70'
  if (c.startsWith('VS-only') || c.startsWith('LET OP')) return 'bg-amber-400/70'
  return 'bg-rose-400/70'
}

export function ApplicationKitsPanel() {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <h2 className="text-[12px] font-semibold text-white/85">📋 Aanmeld-kits (invul-klaar)</h2>
        <span className="text-[10px] text-white/35">{APPLICATION_KITS.length} programma&apos;s · klik om uit te vouwen</span>
      </div>

      {/* Live co-watch: agents kijken mee tijdens het invullen */}
      <LiveAssistSession />

      {/* Gedeeld profiel — geldt voor élke aanmelding */}
      <details className="bg-white/[0.04] rounded-xl border border-white/[0.06] p-4">
        <summary className="text-[11px] text-white/80 cursor-pointer select-none font-medium">
          🧾 Gedeeld aanmeldprofiel — kopieer in elk formulier
        </summary>
        <div className="mt-3 border-t border-white/[0.06] pt-3">
          {APPLICATION_PROFILE.map(f => (
            <Field key={f.label} label={f.label} value={f.value} sensitive={f.sensitive} />
          ))}
          <div className="mt-3 pt-3 border-t border-white/[0.06]">
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="text-[10px] uppercase tracking-wide text-white/35">Promotional method (EN)</span>
              <CopyBtn text={PROMO_METHOD_EN} />
            </div>
            <p className="text-[11px] text-white/70 leading-relaxed">{PROMO_METHOD_EN}</p>
          </div>
          <div className="mt-3 pt-3 border-t border-white/[0.06]">
            <span className="text-[10px] uppercase tracking-wide text-white/35">Kanaal-URL&apos;s</span>
            <div className="mt-1">
              {Object.entries(CHANNEL_URLS).map(([name, url]) => (
                <Field key={name} label={name} value={url} sensitive={url.includes('‹')} />
              ))}
            </div>
          </div>
          <p className="mt-3 text-[10px] text-amber-300/70">
            ⚠️ Geel = nog invullen (KvK/BTW/IBAN/kanaal-URL). Vul je echte waarden in vóór aanmelding.
          </p>
        </div>
      </details>

      {/* Per-programma kits */}
      <div className="space-y-2">
        {APPLICATION_KITS.map(k => (
          <details key={k.program} className="bg-white/[0.04] rounded-xl border border-white/[0.06] p-4 group">
            <summary className="flex items-center gap-2 cursor-pointer select-none">
              <span className={`h-1.5 w-1.5 rounded-full ${COMPLIANCE_DOT(k.compliance)}`} />
              <span className="text-[12px] text-white/90 font-medium">{k.program}</span>
              <span className="text-[10px] text-white/45">· {k.payoutModel}</span>
              <span className="ml-auto text-[10px] text-white/35">{k.network}</span>
            </summary>
            <div className="mt-3 border-t border-white/[0.06] pt-3 space-y-2 text-[11px]">
              <a
                href={k.signupUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-400/30 rounded text-emerald-200 text-[11px]"
              >
                Open aanmeldpagina <ExternalLink size={11} />
              </a>

              <Field label="Aanmeld-link" value={k.signupUrl} />
              <Field label="Netwerk" value={k.network} />
              <Field label="Payout" value={k.payoutModel} />
              {k.cookie && <Field label="Cookie" value={k.cookie} />}
              <Field label="Kanalen" value={k.channels.join(', ')} />

              {k.compliance && (
                <div className="flex items-start gap-2 py-1">
                  <span className="w-36 shrink-0 text-[10px] uppercase tracking-wide text-white/35">Compliance</span>
                  <span className="flex-1 text-[11px] text-white/70">{k.compliance}</span>
                </div>
              )}

              <div className="pt-2 border-t border-white/[0.06]">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-[10px] uppercase tracking-wide text-white/35">Promotional method (invul-klaar)</span>
                  <CopyBtn text={k.promoText} />
                </div>
                <p className="text-[11px] text-white/70 leading-relaxed">{k.promoText}</p>
              </div>

              {k.notes && k.notes.length > 0 && (
                <ul className="pt-2 border-t border-white/[0.06] space-y-1">
                  {k.notes.map((n, i) => (
                    <li key={i} className="text-[10.5px] text-white/55">• {n}</li>
                  ))}
                </ul>
              )}
            </div>
          </details>
        ))}
      </div>
    </div>
  )
}
