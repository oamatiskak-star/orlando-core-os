'use client'

import { useState, useEffect, useCallback } from 'react'
import { Settings, Globe, Key, Bell, AlertTriangle, Copy, CheckCircle } from 'lucide-react'

type Pref = {
  id: string | null
  channel: string
  event_type: string
  label: string
  desc: string
  enabled: boolean
}

const PLATFORM_INFO = [
  { label: 'App naam',  value: 'Orlando Core OS' },
  { label: 'URL',       value: process.env.NEXT_PUBLIC_APP_URL ?? 'dashboard.strkbeheer.nl' },
  { label: 'Tijdzone',  value: 'Europe/Amsterdam (UTC+2)' },
  { label: 'Database',  value: 'Supabase PostgreSQL' },
  { label: 'Hosting',   value: 'Vercel + Render.com' },
  { label: 'Versie',    value: 'v2.0.0' },
]

const API_REFS = [
  { service: 'Supabase URL',    value: process.env.NEXT_PUBLIC_SUPABASE_URL ?? '(zie .env)', masked: false },
  { service: 'Supabase Anon',   value: '••••••••••••••••••••••••••••••••••••••••',           masked: true  },
  { service: 'GitHub',          value: 'Connected as oamatiskak-star',                       masked: false },
]

export default function InstellingenPage() {
  const [prefs, setPrefs]       = useState<Pref[]>([])
  const [loading, setLoading]   = useState(true)
  const [copied, setCopied]     = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/instellingen')
      if (res.ok) { const j = await res.json(); setPrefs(j.prefs ?? []) }
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  async function togglePref(pref: Pref) {
    setPrefs(prev => prev.map(p => p.channel === pref.channel && p.event_type === pref.event_type ? { ...p, enabled: !p.enabled } : p))
    await fetch('/api/instellingen', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel: pref.channel, event_type: pref.event_type, enabled: !pref.enabled }),
    })
  }

  function copyToClipboard(text: string, key: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key)
      setTimeout(() => setCopied(null), 2000)
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-gray-500/10 border border-gray-500/20 flex items-center justify-center">
          <Settings size={16} className="text-gray-400" />
        </div>
        <div>
          <h1 className="text-base font-semibold text-white">Instellingen</h1>
          <p className="text-xs text-white/50">Platforminstellingen, configuratie en notificatievoorkeuren.</p>
        </div>
      </div>

      {/* Platform */}
      <div className="bg-white/[0.06] border border-white/5 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Globe size={14} className="text-white/65" />
          <h2 className="text-sm font-semibold text-white">Platform</h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {PLATFORM_INFO.map((item) => (
            <div key={item.label}>
              <p className="text-[11px] text-white/50 mb-1">{item.label}</p>
              <p className="text-xs text-white/70 font-medium">{item.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* API Connections */}
      <div className="bg-white/[0.06] border border-white/5 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Key size={14} className="text-white/65" />
          <h2 className="text-sm font-semibold text-white">API Verbindingen</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                {['Service', 'Waarde', 'Status', 'Actie'].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-[10px] font-medium text-white/50 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {API_REFS.map((row) => (
                <tr key={row.service} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                  <td className="px-4 py-3 text-xs text-white/70 font-medium">{row.service}</td>
                  <td className="px-4 py-3 text-xs text-white/65 font-mono max-w-[280px] truncate">{row.value}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-500/10 text-green-400">Actief</span>
                  </td>
                  <td className="px-4 py-3">
                    {!row.masked && (
                      <button
                        onClick={() => copyToClipboard(row.value, row.service)}
                        className="flex items-center gap-1.5 border border-white/10 text-white/50 hover:text-white hover:border-white/20 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
                      >
                        {copied === row.service ? <CheckCircle size={10} className="text-green-400" /> : <Copy size={10} />}
                        {copied === row.service ? 'Gekopieerd' : 'Kopieer'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Notification preferences */}
      <div className="bg-white/[0.06] border border-white/5 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Bell size={14} className="text-white/65" />
          <h2 className="text-sm font-semibold text-white">Notificaties</h2>
        </div>
        {loading ? (
          <div className="py-4 text-xs text-white/40">Laden…</div>
        ) : (
          <div className="space-y-3">
            {prefs.map((pref) => (
              <div key={`${pref.channel}:${pref.event_type}`} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                <div>
                  <p className="text-xs text-white/70 font-medium">{pref.label}</p>
                  <p className="text-[11px] text-white/50">{pref.desc}</p>
                </div>
                <button
                  onClick={() => togglePref(pref)}
                  className={`relative w-9 h-5 rounded-full transition-colors flex-shrink-0 ${pref.enabled ? 'bg-indigo-600' : 'bg-white/10'}`}
                >
                  <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${pref.enabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Danger Zone */}
      <div className="bg-white/[0.02] border border-red-500/20 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-2">
          <AlertTriangle size={14} className="text-red-400" />
          <h2 className="text-sm font-semibold text-red-400">Gevaarlijke Zone</h2>
        </div>
        <p className="text-[11px] text-white/50 mb-4">
          Deze actie is onomkeerbaar. Alle data, BV-koppelingen en agent-configuraties worden permanent verwijderd.
        </p>
        <button className="border border-red-500/30 text-red-400 hover:bg-red-500/10 text-xs font-medium px-4 py-2 rounded-lg transition-colors">
          Account verwijderen
        </button>
      </div>
    </div>
  )
}
