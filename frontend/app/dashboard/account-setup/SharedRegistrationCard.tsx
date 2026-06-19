'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight, Copy, Check, KeyRound } from 'lucide-react'
import clsx from 'clsx'
import { SHARED_REGISTRATION } from '@/lib/affiliate-programs/setup-data'

function CopyValue({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      setCopied(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={clsx(
        'inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium tabular-nums transition-colors max-w-full',
        copied
          ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
          : 'border-white/10 bg-white/[0.03] text-white/80 hover:border-white/25'
      )}
      title="Kopieer"
    >
      <span className="truncate">{value}</span>
      {copied ? <Check size={11} className="shrink-0" /> : <Copy size={11} className="shrink-0 opacity-60" />}
    </button>
  )
}

export function SharedRegistrationCard() {
  const [open, setOpen] = useState(false)

  return (
    <div className="bg-white/[0.04] rounded-xl border border-white/[0.06] overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <KeyRound size={16} className="text-white/50" />
          <div className="text-left">
            <p className="text-[13px] font-semibold text-white">Vaste registratiegegevens</p>
            <p className="text-[10px] text-white/45">1× invullen, overal hergebruiken — geen wachtwoorden hier</p>
          </div>
        </div>
        {open ? <ChevronDown size={16} className="text-white/40" /> : <ChevronRight size={16} className="text-white/40" />}
      </button>

      {open && (
        <div className="border-t border-white/[0.06] p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {SHARED_REGISTRATION.map((field) => (
              <div key={field.label} className="flex items-center justify-between gap-2 min-w-0">
                <span className="text-[11px] text-white/50 shrink-0">{field.label}</span>
                <CopyValue value={field.value} />
              </div>
            ))}
          </div>
          <p className="text-[10px] text-amber-200/70 mt-3 flex items-center gap-1.5">
            <KeyRound size={11} className="shrink-0" />
            Wachtwoorden horen in je wachtwoordmanager — niet in dit dashboard.
          </p>
        </div>
      )}
    </div>
  )
}
