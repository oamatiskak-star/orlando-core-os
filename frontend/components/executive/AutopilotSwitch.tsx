'use client'

import { useState } from 'react'
import clsx from 'clsx'
import { Loader2, Power } from 'lucide-react'

export type AutopilotLink = {
  link_key: string
  description: string | null
  enabled: boolean
  threshold: number | null
  trigger_count: number
  last_triggered_at: string | null
}

export function AutopilotSwitch({
  link, onToggle,
}: {
  link: AutopilotLink
  onToggle: (link_key: string, next: boolean) => Promise<void>
}) {
  const [busy, setBusy] = useState(false)
  const handle = async () => {
    if (busy) return
    setBusy(true)
    try {
      await onToggle(link.link_key, !link.enabled)
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className={clsx(
      'border rounded-xl p-3 transition-colors',
      link.enabled
        ? 'border-emerald-400/30 bg-emerald-500/[0.05]'
        : 'border-white/10 bg-white/[0.03]',
    )}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-medium text-white/90 truncate">{link.link_key.replace(/_/g, ' → ')}</div>
          {link.description ? <div className="text-[11px] text-white/50 mt-0.5 line-clamp-2">{link.description}</div> : null}
          <div className="text-[10px] text-white/40 mt-1.5 tabular-nums">
            {link.threshold != null ? <>threshold {link.threshold} · </> : null}
            triggers {link.trigger_count}
            {link.last_triggered_at ? <> · laatste {new Date(link.last_triggered_at).toLocaleString('nl-NL')}</> : null}
          </div>
        </div>
        <button
          type="button"
          onClick={handle}
          disabled={busy}
          aria-label={link.enabled ? 'Disable autopilot' : 'Enable autopilot'}
          className={clsx(
            'shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] font-medium',
            link.enabled
              ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-200 hover:bg-emerald-500/25'
              : 'bg-white/[0.04] border-white/10 text-white/60 hover:bg-white/[0.08]',
          )}
        >
          {busy ? <Loader2 size={11} className="animate-spin" /> : <Power size={11} />}
          {link.enabled ? 'ON' : 'OFF'}
        </button>
      </div>
    </div>
  )
}
