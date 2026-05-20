'use client'

import Link from 'next/link'
import { Eye, ExternalLink } from 'lucide-react'
import { EmptyState } from '@/components/executive/EmptyState'

export default function ExecutiveCompete() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-red-500/10 border border-red-400/30 flex items-center justify-center">
            <Eye size={16} className="text-red-300" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-white/80">Competitor Surveillance</h1>
            <p className="text-[11px] text-white/40 mt-0.5">Executive view — competitor scanner staat gepauzeerd ten gunste van Viral Intelligence</p>
          </div>
        </div>
        <Link
          href="/dashboard/media-holding/compete"
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] rounded-lg bg-white/[0.04] border border-white/10 hover:bg-white/[0.08] text-white/60"
        >
          <ExternalLink size={11} />
          Open Operational Compete
        </Link>
      </div>

      <div className="bg-white/[0.04] border border-white/5 rounded-xl p-4">
        <EmptyState
          icon={<Eye size={18} />}
          title="Competitor scanner paused"
          hint="Per 2026-05-20 is per-kanaal competitor surveillance gepauzeerd ten gunste van Viral Intelligence radar. Wanneer specifieke concurrenten weer relevant worden, reactiveer competitor-surveillance-yt worker en kom hier terug voor breakout/format-shift signalen."
        />
      </div>
    </div>
  )
}
