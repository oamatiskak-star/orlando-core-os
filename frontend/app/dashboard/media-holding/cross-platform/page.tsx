'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Network, ChevronLeft, Play, Music2, Image, Globe, Camera, KeyRound, Link2, CheckCircle2, XCircle, AlertTriangle, Plus } from 'lucide-react'
import clsx from 'clsx'

type Channel = {
  id: string
  name: string
  niche: string
  language: string
  status: string
}

type Cred = {
  id: string
  platform: 'youtube'|'tiktok'|'instagram'|'facebook'|'snapchat'
  status: 'not_configured'|'configured'|'oauth_pending'|'connected'|'error'|'expired'
  redirect_uri: string | null
  scopes: string[]
  external_account_id: string | null
  external_account_name: string | null
  expires_at: string | null
  last_error: string | null
}

const PLATFORMS = ['youtube','tiktok','instagram','facebook','snapchat'] as const
const PLATFORM_ICONS = {
  youtube:   Play,
  tiktok:    Music2,
  instagram: Image,
  facebook:  Globe,
  snapchat:  Camera,
} as const

const STATUS_CONFIG: Record<Cred['status'], { color: string; icon: typeof CheckCircle2 }> = {
  not_configured: { color: 'bg-white/[0.06] text-white/40',         icon: XCircle },
  configured:     { color: 'bg-amber-500/10 text-amber-300',         icon: KeyRound },
  oauth_pending:  { color: 'bg-indigo-500/10 text-indigo-300',       icon: Link2 },
  connected:      { color: 'bg-emerald-500/10 text-emerald-300',     icon: CheckCircle2 },
  error:          { color: 'bg-red-500/10 text-red-400',             icon: AlertTriangle },
  expired:        { color: 'bg-orange-500/10 text-orange-400',       icon: AlertTriangle },
}

export default function CrossPlatformPage() {
  const [channels, setChannels] = useState<Channel[]>([])
  const [credsByChannel, setCredsByChannel] = useState<Record<string, Cred[]>>({})
  const [loading, setLoading] = useState(true)
  const [showCredsModal, setShowCredsModal] = useState<{ channelId: string; platform: string } | null>(null)
  const [showNewChannel, setShowNewChannel] = useState(false)
  const search = useSearchParams()
  const oauthSuccess = search.get('oauth_success')
  const oauthError   = search.get('oauth_error')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const cRes = await fetch('/api/media-holding/channels')
      const cJ = cRes.ok ? await cRes.json() : { channels: [] }
      const chs: Channel[] = cJ.channels ?? []
      setChannels(chs)

      // Fetch credentials per channel parallel
      const credsMap: Record<string, Cred[]> = {}
      await Promise.all(chs.map(async (ch) => {
        const r = await fetch(`/api/media-holding/channels/${ch.id}/credentials`)
        if (r.ok) {
          const j = await r.json()
          credsMap[ch.id] = j.credentials ?? []
        } else {
          credsMap[ch.id] = []
        }
      }))
      setCredsByChannel(credsMap)
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  async function startOAuth(channelId: string, platform: string) {
    const r = await fetch(`/api/media-holding/channels/${channelId}/oauth/init`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ platform }),
    })
    if (r.ok) {
      const j = await r.json()
      window.location.href = j.auth_url
    } else {
      const j = await r.json().catch(() => ({}))
      alert(`OAuth init mislukt: ${j.error ?? r.status}`)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/media-holding" className="text-white/40 hover:text-white">
            <ChevronLeft size={16} />
          </Link>
          <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
            <Network size={16} className="text-indigo-400" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-white">Cross-Platform Distribution</h1>
            <p className="text-xs text-white/50">Persona: <span className="text-indigo-300">Atlas</span> — verbindt elk kanaal met YouTube/TikTok/IG/FB/Snapchat. Phase 9: alleen YouTube OAuth geïmplementeerd.</p>
          </div>
        </div>
        <button
          onClick={() => setShowNewChannel(true)}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium px-4 py-2 rounded-lg"
        >
          <Plus size={13} /> Nieuw kanaal
        </button>
      </div>

      {oauthSuccess && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-4 py-2.5 text-[12px] text-emerald-300">
          OAuth voor <strong>{oauthSuccess}</strong> succesvol. Channel is nu connected.
        </div>
      )}
      {oauthError && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-2.5 text-[12px] text-red-300">
          OAuth fout: <code>{oauthError}</code>
        </div>
      )}

      {loading ? (
        <div className="p-10 text-center text-xs text-white/40">Laden…</div>
      ) : channels.length === 0 ? (
        <div className="p-10 text-center bg-white/[0.04] border border-white/5 rounded-xl">
          <Network size={32} className="mx-auto text-white/30 mb-3" />
          <p className="text-sm text-white/65">Nog geen kanalen.</p>
          <p className="text-[11px] text-white/40 mt-1">Klik &quot;Nieuw kanaal&quot; om je eerste channel toe te voegen.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {channels.map((ch) => {
            const creds = credsByChannel[ch.id] ?? []
            const credByPlatform: Record<string, Cred | undefined> = {}
            creds.forEach((c) => { credByPlatform[c.platform] = c })

            return (
              <div key={ch.id} className="bg-white/[0.06] border border-white/5 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-sm font-semibold text-white">{ch.name}</h3>
                    <p className="text-[11px] text-white/45">{ch.niche} · {ch.language} · {ch.status}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {PLATFORMS.map((p) => {
                    const cred = credByPlatform[p]
                    const status = cred?.status ?? 'not_configured'
                    const Icon = PLATFORM_ICONS[p]
                    const cfg = STATUS_CONFIG[status]
                    const StatusIcon = cfg.icon

                    return (
                      <div key={p} className={clsx('rounded-lg border p-3', cfg.color.replace('text-', 'border-').replace('bg-', 'border-').replace('/10', '/20').replace('/06', '/10'))}>
                        <div className="flex items-center justify-between mb-2">
                          <Icon size={14} className="text-white/70" />
                          <span className={clsx('flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded', cfg.color)}>
                            <StatusIcon size={10} /> {status.replace('_', ' ')}
                          </span>
                        </div>
                        <p className="text-[10px] text-white/55 uppercase tracking-wider mb-1">{p}</p>
                        {cred?.external_account_name && (
                          <p className="text-[11px] text-white/75 truncate" title={cred.external_account_name}>{cred.external_account_name}</p>
                        )}
                        {cred?.last_error && (
                          <p className="text-[10px] text-red-300 mt-1 truncate" title={cred.last_error}>⚠️ {cred.last_error}</p>
                        )}
                        <div className="mt-2 flex flex-col gap-1">
                          {status === 'not_configured' && p === 'youtube' && (
                            <button
                              onClick={() => setShowCredsModal({ channelId: ch.id, platform: p })}
                              className="text-[10px] text-indigo-300 hover:text-indigo-200"
                            >
                              Voer OAuth client toe
                            </button>
                          )}
                          {status === 'configured' && p === 'youtube' && (
                            <button
                              onClick={() => startOAuth(ch.id, p)}
                              className="text-[10px] text-indigo-300 hover:text-indigo-200"
                            >
                              Verbind via Google
                            </button>
                          )}
                          {status === 'connected' && (
                            <button
                              onClick={() => setShowCredsModal({ channelId: ch.id, platform: p })}
                              className="text-[10px] text-emerald-300 hover:text-emerald-200"
                            >
                              Beheer
                            </button>
                          )}
                          {status === 'error' && p === 'youtube' && (
                            <button
                              onClick={() => startOAuth(ch.id, p)}
                              className="text-[10px] text-orange-300 hover:text-orange-200"
                            >
                              Opnieuw verbinden
                            </button>
                          )}
                          {p !== 'youtube' && (
                            <span className="text-[10px] text-white/30">— niet beschikbaar in Phase 9</span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showCredsModal && (
        <CredentialsModal
          channelId={showCredsModal.channelId}
          platform={showCredsModal.platform}
          onClose={() => setShowCredsModal(null)}
          onSaved={() => { setShowCredsModal(null); load() }}
        />
      )}

      {showNewChannel && (
        <NewChannelModal onClose={() => setShowNewChannel(false)} onCreated={() => { setShowNewChannel(false); load() }} />
      )}
    </div>
  )
}

function CredentialsModal({ channelId, platform, onClose, onSaved }: { channelId: string; platform: string; onClose: () => void; onSaved: () => void }) {
  const [clientId, setClientId] = useState('')
  const [clientSecret, setClientSecret] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function save() {
    if (!clientId.trim() || !clientSecret.trim()) { setError('client_id en client_secret zijn vereist'); return }
    setSaving(true); setError('')
    try {
      const r = await fetch(`/api/media-holding/channels/${channelId}/credentials`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform, client_id: clientId.trim(), client_secret: clientSecret.trim() }),
      })
      if (r.ok) {
        onSaved()
      } else {
        const j = await r.json().catch(() => ({}))
        setError(j.error ?? 'Opslaan faalde')
      }
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-[#0f1117] border border-white/10 rounded-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-white/5">
          <h2 className="text-sm font-semibold text-white">OAuth client voor {platform}</h2>
          <button onClick={onClose} className="text-white/50 hover:text-white">✕</button>
        </div>
        <div className="p-5 space-y-3">
          <p className="text-[11px] text-white/55">
            Plak hier de OAuth 2.0 Client ID + Secret uit Google Cloud Console voor dit specifieke kanaal.
            De redirect URI wordt automatisch op deze app gezet — zorg dat &apos;<code>{`${typeof window !== 'undefined' ? window.location.origin : ''}/api/media-holding/oauth/${platform}/callback`}</code>&apos; is geautoriseerd in Google Cloud.
          </p>
          <div>
            <label className="block text-[11px] text-white/50 mb-1.5">Client ID</label>
            <input
              className="w-full bg-white/[0.06] border border-white/10 rounded-lg px-3 py-2 text-xs text-white"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              placeholder="...apps.googleusercontent.com"
            />
          </div>
          <div>
            <label className="block text-[11px] text-white/50 mb-1.5">Client Secret</label>
            <input
              type="password"
              className="w-full bg-white/[0.06] border border-white/10 rounded-lg px-3 py-2 text-xs text-white font-mono"
              value={clientSecret}
              onChange={(e) => setClientSecret(e.target.value)}
              placeholder="GOCSPX-..."
            />
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
          <div className="flex gap-2 pt-2">
            <button onClick={onClose} className="flex-1 border border-white/10 text-white/60 text-xs py-2 rounded-lg">Annuleer</button>
            <button onClick={save} disabled={saving} className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs py-2 rounded-lg">
              {saving ? 'Opslaan…' : 'Opslaan'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function NewChannelModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState('')
  const [niche, setNiche] = useState('')
  const [language, setLanguage] = useState('nl')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function save() {
    if (!name.trim() || !niche.trim()) { setError('naam en niche zijn vereist'); return }
    setSaving(true); setError('')
    try {
      const r = await fetch('/api/media-holding/channels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), niche: niche.trim(), language, status: 'incubating' }),
      })
      if (r.ok) onCreated()
      else {
        const j = await r.json().catch(() => ({}))
        setError(j.error ?? 'Aanmaken faalde')
      }
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-[#0f1117] border border-white/10 rounded-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-white/5">
          <h2 className="text-sm font-semibold text-white">Nieuw kanaal</h2>
          <button onClick={onClose} className="text-white/50 hover:text-white">✕</button>
        </div>
        <div className="p-5 space-y-3">
          <div>
            <label className="block text-[11px] text-white/50 mb-1.5">Naam</label>
            <input
              className="w-full bg-white/[0.06] border border-white/10 rounded-lg px-3 py-2 text-xs text-white"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="AquierTv"
            />
          </div>
          <div>
            <label className="block text-[11px] text-white/50 mb-1.5">Niche</label>
            <input
              className="w-full bg-white/[0.06] border border-white/10 rounded-lg px-3 py-2 text-xs text-white"
              value={niche}
              onChange={(e) => setNiche(e.target.value)}
              placeholder="marble systems / cinematic loops / etc"
            />
          </div>
          <div>
            <label className="block text-[11px] text-white/50 mb-1.5">Taal</label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="w-full bg-white/[0.06] border border-white/10 rounded-lg px-3 py-2 text-xs text-white"
            >
              <option value="nl">Nederlands</option>
              <option value="en">English</option>
              <option value="es">Español</option>
              <option value="de">Deutsch</option>
              <option value="fr">Français</option>
              <option value="pt">Português</option>
            </select>
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
          <div className="flex gap-2 pt-2">
            <button onClick={onClose} className="flex-1 border border-white/10 text-white/60 text-xs py-2 rounded-lg">Annuleer</button>
            <button onClick={save} disabled={saving} className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs py-2 rounded-lg">
              {saving ? 'Opslaan…' : 'Kanaal aanmaken'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
