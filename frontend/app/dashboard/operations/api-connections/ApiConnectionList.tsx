'use client'

import { useState } from 'react'
import { PlugZap, Plus, X, Trash2, Zap } from 'lucide-react'
import { createApiConnection, testApiConnection, deleteApiConnection } from './actions'

type ApiConnection = {
  id: string
  naam: string
  company: string
  service: string
  base_url: string | null
  auth_type: string
  status: string
  last_tested_at: string | null
  last_error: string | null
  created_at: string
}

const STATUS_COLORS: Record<string, string> = {
  actief: 'text-green-400 bg-green-500/10',
  error: 'text-red-400 bg-red-500/10',
  inactief: 'text-white/38 bg-white/5',
}

const SERVICE_ICONS: Record<string, string> = {
  openai: '🤖',
  anthropic: '🧠',
  supabase: '🗄️',
  stripe: '💳',
  twilio: '📱',
  sendgrid: '📧',
  mailgun: '✉️',
  github: '🐙',
  slack: '💬',
  telegram: '📨',
  moneybird: '💰',
  zapier: '⚡',
  make: '🔗',
  hubspot: '🎯',
  salesforce: '☁️',
  google: '🔍',
  aws: '☁️',
  custom: '🔌',
}

const COMPANIES = ['MODIWÉ', 'MEDIA', 'STRKBEHEER', 'STRKBOUW', 'PROFFS']
const SERVICES = Object.keys(SERVICE_ICONS)
const AUTH_TYPES = ['api_key', 'bearer', 'oauth2', 'basic', 'none']

function ConnectionCard({ conn }: { conn: ApiConnection }) {
  const [testing, setTesting] = useState(false)

  async function handleTest() {
    setTesting(true)
    await testApiConnection(conn.id)
    setTesting(false)
  }

  const lastTested = conn.last_tested_at
    ? new Date(conn.last_tested_at).toLocaleString('nl-NL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
    : '—'

  return (
    <div className="bg-white/[0.06] border border-white/5 rounded-xl p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-lg">
            {SERVICE_ICONS[conn.service] ?? SERVICE_ICONS.custom}
          </div>
          <div>
            <p className="text-sm font-semibold text-white">{conn.naam}</p>
            <p className="text-[10px] text-white/45">{conn.service} · {conn.company}</p>
          </div>
        </div>
        <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${STATUS_COLORS[conn.status] ?? 'text-white/50 bg-white/5'}`}>
          {conn.status}
        </span>
      </div>

      {conn.base_url && (
        <p className="text-[10px] text-white/38 font-mono truncate">{conn.base_url}</p>
      )}

      <div className="flex items-center gap-2">
        <span className="px-1.5 py-0.5 rounded bg-white/5 text-[10px] text-white/38">{conn.auth_type}</span>
        <span className="text-[10px] text-white/25">getest: {lastTested}</span>
      </div>

      {conn.last_error && (
        <p className="text-[10px] text-red-400/80 font-mono bg-red-500/5 rounded px-2 py-1 truncate">{conn.last_error}</p>
      )}

      <div className="flex gap-2 border-t border-white/5 pt-2">
        <button onClick={handleTest} disabled={testing}
          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg border border-white/10 text-white/60 hover:text-sky-400 hover:border-sky-500/30 text-xs transition-colors disabled:opacity-30">
          <Zap size={10} className={testing ? 'animate-pulse' : ''} />
          {testing ? 'Testen...' : 'Test verbinding'}
        </button>
        <button onClick={() => { if (confirm(`"${conn.naam}" verwijderen?`)) deleteApiConnection(conn.id) }}
          className="w-8 flex items-center justify-center py-1.5 rounded-lg border border-white/10 text-white/60 hover:text-red-400 hover:border-red-500/30 text-xs transition-colors">
          <Trash2 size={10} />
        </button>
      </div>
    </div>
  )
}

function NieuweConnectionModal({ onClose }: { onClose: () => void }) {
  const [pending, setPending] = useState(false)
  const [service, setService] = useState('openai')
  const [authType, setAuthType] = useState('api_key')
  const [apiKey, setApiKey] = useState('')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setPending(true)
    const fd = new FormData(e.currentTarget)
    const credentials: Record<string, string> = {}
    if (authType === 'api_key') credentials.api_key = apiKey
    if (authType === 'bearer') credentials.token = apiKey
    if (authType === 'basic') { credentials.username = apiKey; credentials.password = '' }
    fd.set('service', service)
    fd.set('auth_type', authType)
    fd.set('credentials', JSON.stringify(credentials))
    await createApiConnection(fd)
    setPending(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[#181830] border border-white/10 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5 sticky top-0 bg-[#181830] z-10">
          <h2 className="text-sm font-semibold text-white">Nieuwe API Verbinding</h2>
          <button onClick={onClose} className="text-white/50 hover:text-white transition-colors"><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs text-white/50 mb-1">Naam *</label>
            <input name="naam" required placeholder="bijv. OpenAI Production"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-indigo-500/60 transition-colors" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-white/50 mb-1">Bedrijf</label>
              <select name="company" className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-indigo-500/60 transition-colors">
                {COMPANIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-white/50 mb-1">Service</label>
              <select value={service} onChange={e => setService(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-indigo-500/60 transition-colors">
                {SERVICES.map(s => <option key={s} value={s}>{SERVICE_ICONS[s]} {s}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs text-white/50 mb-1">Base URL</label>
            <input name="base_url" placeholder="https://api.example.com/v1"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-indigo-500/60 transition-colors font-mono" />
          </div>
          <div>
            <label className="block text-xs text-white/50 mb-1">Auth Type</label>
            <select value={authType} onChange={e => setAuthType(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-indigo-500/60 transition-colors">
              {AUTH_TYPES.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          {authType !== 'none' && (
            <div>
              <label className="block text-xs text-white/50 mb-1">
                {authType === 'api_key' ? 'API Key' : authType === 'bearer' ? 'Bearer Token' : 'Credentials'}
              </label>
              <input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)}
                placeholder={authType === 'api_key' ? 'sk-...' : 'Token of credentials'}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-indigo-500/60 transition-colors font-mono" />
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={pending}
              className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium py-2.5 rounded-lg transition-colors">
              {pending ? 'Aanmaken...' : 'Verbinding aanmaken'}
            </button>
            <button type="button" onClick={onClose}
              className="px-4 border border-white/10 text-white/50 hover:text-white text-sm rounded-lg transition-colors">
              Annuleren
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function ApiConnectionList({ connections }: { connections: ApiConnection[] }) {
  const [showNew, setShowNew] = useState(false)

  const actief = connections.filter(c => c.status === 'actief').length
  const errors = connections.filter(c => c.status === 'error').length

  return (
    <>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 text-xs text-white/50">
          <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-green-500" />{actief} actief</span>
          {errors > 0 && <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-red-500" />{errors} fout</span>}
        </div>
        <button onClick={() => setShowNew(true)}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium px-4 py-2 rounded-lg transition-colors">
          <Plus size={13} />
          Nieuwe verbinding
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {connections.map(conn => <ConnectionCard key={conn.id} conn={conn} />)}
        {connections.length === 0 && (
          <div className="col-span-3 flex flex-col items-center justify-center py-16 gap-3 bg-white/[0.02] border border-white/5 rounded-xl">
            <PlugZap size={24} className="text-white/20" />
            <p className="text-sm text-white/50">Geen API verbindingen</p>
            <button onClick={() => setShowNew(true)} className="text-xs text-indigo-400 hover:text-indigo-300">
              Koppel je eerste API
            </button>
          </div>
        )}
      </div>

      {showNew && <NieuweConnectionModal onClose={() => setShowNew(false)} />}
    </>
  )
}
