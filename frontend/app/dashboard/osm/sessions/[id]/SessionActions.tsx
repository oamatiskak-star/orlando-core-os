'use client'

import { useTransition } from 'react'
import { Pause, Check, PlayCircle, RefreshCw } from 'lucide-react'
import { setSessionStatus } from '../../actions'

type Props = {
  id: string
  status: 'active' | 'paused' | 'context_full' | 'crashed' | 'done'
}

export default function SessionActions({ id, status }: Props) {
  const [pending, startTransition] = useTransition()

  const update = (next: Props['status']) => {
    startTransition(async () => {
      await setSessionStatus(id, next)
    })
  }

  return (
    <div className="flex items-center gap-1.5">
      {status !== 'active' && status !== 'done' && (
        <button
          type="button"
          onClick={() => update('active')}
          disabled={pending}
          className="inline-flex items-center gap-1 px-2 py-1 text-[10px] rounded-md bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 transition-colors disabled:opacity-50"
          title="Hervatten (status → active)"
        >
          {pending ? <RefreshCw size={10} className="animate-spin" /> : <PlayCircle size={10} />}
          Hervat
        </button>
      )}
      {status !== 'paused' && status !== 'done' && (
        <button
          type="button"
          onClick={() => update('paused')}
          disabled={pending}
          className="inline-flex items-center gap-1 px-2 py-1 text-[10px] rounded-md bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 transition-colors disabled:opacity-50"
          title="Pauzeren (status → paused)"
        >
          {pending ? <RefreshCw size={10} className="animate-spin" /> : <Pause size={10} />}
          Pauze
        </button>
      )}
      {status !== 'done' && (
        <button
          type="button"
          onClick={() => update('done')}
          disabled={pending}
          className="inline-flex items-center gap-1 px-2 py-1 text-[10px] rounded-md bg-white/[0.04] hover:bg-white/[0.08] text-white/60 border border-white/[0.08] transition-colors disabled:opacity-50"
          title="Afronden (status → done)"
        >
          {pending ? <RefreshCw size={10} className="animate-spin" /> : <Check size={10} />}
          Klaar
        </button>
      )}
    </div>
  )
}
