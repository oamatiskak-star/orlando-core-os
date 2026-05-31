'use client'

import { useState } from 'react'
import MonetizationView from './MonetizationView'
import AffiliateEngineView from '../affiliate-engine/page'

// Samengevoegd: Monetization (revenue-streams) + Affiliate Engine (deep-dive) in één pagina.
const TABS = [
  { key: 'overzicht', label: 'Overzicht & Streams' },
  { key: 'affiliate', label: 'Affiliate Deep-dive' },
] as const

type TabKey = (typeof TABS)[number]['key']

export default function RevenuePage() {
  const [tab, setTab] = useState<TabKey>('overzicht')
  return (
    <div className="space-y-4">
      <div className="flex gap-1 border-b border-white/8">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-xs font-medium border-b-2 -mb-px transition-colors ${
              tab === t.key ? 'border-indigo-400 text-white' : 'border-transparent text-white/45 hover:text-white/70'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'overzicht' ? <MonetizationView /> : <AffiliateEngineView />}
    </div>
  )
}
