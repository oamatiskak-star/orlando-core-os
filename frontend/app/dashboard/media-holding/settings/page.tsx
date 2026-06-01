'use client'

import { useState } from 'react'
import SettingsView from './SettingsView'
import CrossPlatformView from '../cross-platform/page'

// Samengevoegd: Settings (kanaal-config) + Cross-Platform (OAuth per platform) in één pagina.
const TABS = [
  { key: 'config', label: 'Kanaal-instellingen' },
  { key: 'platforms', label: 'Platforms & OAuth' },
] as const

type TabKey = (typeof TABS)[number]['key']

export default function ChannelConfigPage() {
  const [tab, setTab] = useState<TabKey>('config')
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
      {tab === 'config' ? <SettingsView /> : <CrossPlatformView />}
    </div>
  )
}
