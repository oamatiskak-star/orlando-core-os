'use client'

import { useState, useEffect } from 'react'
import { CheckCircle, XCircle, Link2, X, Eye, EyeOff, ExternalLink, AlertTriangle } from 'lucide-react'
import clsx from 'clsx'

type ConnStatus = {
  status?: 'connected' | 'error' | 'disconnected'
  connected_at?: string
  metadata?: Record<string, unknown>
}
type StatusMap = Record<string, ConnStatus>

// ─── BTW Deadlines ────────────────────────────────────────────────────────────

const BTW_DEADLINES = [
  { label: 'Q1 2026 (jan–mrt)', deadline: '2026-04-30', done: true },
  { label: 'Q2 2026 (apr–jun)', deadline: '2026-07-31', done: false },
  { label: 'Q3 2026 (jul–sep)', deadline: '2026-10-31', done: false },
  { label: 'Q4 2026 (okt–dec)', deadline: '2027-01-31', done: false },
]

function daysLeft(dateStr: string) {
  const diff = new Date(dateStr).getTime() - Date.now()
  return Math.ceil(diff / 86_400_000)
}

// ─── Modals ───────────────────────────────────────────────────────────────────

function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-[#0f0f14] border border-white/10 rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-white/5">
          <h3 className="text-sm font-semibold text-white">{title}</h3>
          <button onClick={onClose} className="text-white/50 hover:text-white"><X size={15} /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}

function BunqModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [apiKey, setApiKey] = useState('')
  const [show, setShow] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    setLoading(true); setError(null)
    const res = await fetch('/api/integrations/bunq/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey }),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) { setError(data.error); return }
    onSaved(); onClose()
  }

  return (
    <ModalShell title="bunq koppelen" onClose={onClose}>
      <div className="space-y-4">
        <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4 space-y-1">
          <p className="text-xs font-semibold text-emerald-400">API Key genereren</p>
          <p className="text-[11px] text-white/65 leading-relaxed">
            Open de bunq app → <strong className="text-white/60">Profiel</strong> → <strong className="text-white/60">Beveiliging</strong> → <strong className="text-white/60">API Keys</strong> → Nieuwe key aanmaken met <em>Read</em>-rechten.
          </p>
          <a href="https://www.bunq.com" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[11px] text-emerald-400 hover:text-emerald-300 mt-1">
            bunq.com <ExternalLink size={9} />
          </a>
        </div>

        <div className="space-y-1.5">
          <label className="text-[11px] text-white/65">bunq API Key</label>
          <div className="flex items-center gap-2 bg-white/[0.06] border border-white/10 rounded-lg px-3 py-2.5">
            <input
              type={show ? 'text' : 'password'}
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              placeholder="sandbox_xxxxxxxxxxxxxxxx"
              className="flex-1 bg-transparent text-xs text-white outline-none placeholder:text-white/38 font-mono"
            />
            <button onClick={() => setShow(v => !v)} className="text-white/50 hover:text-white">
              {show ? <EyeOff size={13} /> : <Eye size={13} />}
            </button>
          </div>
        </div>

        {error && <p className="text-[11px] text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>}

        <button
          onClick={save}
          disabled={loading || !apiKey}
          className="w-full py-2.5 bg-emerald-500/20 border border-emerald-500/30 rounded-xl text-sm font-semibold text-emerald-400 hover:bg-emerald-500/30 transition-all disabled:opacity-50"
        >
          {loading ? 'Verbinden…' : 'Koppelen'}
        </button>
      </div>
    </ModalShell>
  )
}

function INGModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [clientId, setClientId] = useState('')
  const [clientSecret, setClientSecret] = useState('')
  const [iban, setIban] = useState('')
  const [show, setShow] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    setLoading(true); setError(null)
    const res = await fetch('/api/integrations/ing/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId, clientSecret, iban }),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) { setError(data.error); return }
    onSaved(); onClose()
  }

  return (
    <ModalShell title="ING Zakelijk koppelen" onClose={onClose}>
      <div className="space-y-4">
        <div className="bg-orange-500/5 border border-orange-500/20 rounded-xl p-4 space-y-1">
          <p className="text-xs font-semibold text-orange-400">ING Developer Portal</p>
          <p className="text-[11px] text-white/65 leading-relaxed">
            Registreer je app op het ING Developer Portal om een Client ID en Secret te krijgen. ING Open Banking (PSD2) vereist eIDAS-certificaten voor productieverificatie.
          </p>
          <a href="https://developer.ing.com" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[11px] text-orange-400 hover:text-orange-300 mt-1">
            developer.ing.com <ExternalLink size={9} />
          </a>
        </div>

        {[
          { label: 'Client ID', value: clientId, set: setClientId, placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx', secret: false },
          { label: 'Client Secret', value: clientSecret, set: setClientSecret, placeholder: '••••••••••••••••', secret: true },
          { label: 'IBAN (optioneel)', value: iban, set: setIban, placeholder: 'NL12 INGB 0123 4567 89', secret: false },
        ].map(f => (
          <div key={f.label} className="space-y-1.5">
            <label className="text-[11px] text-white/65">{f.label}</label>
            <div className="flex items-center gap-2 bg-white/[0.06] border border-white/10 rounded-lg px-3 py-2.5">
              <input
                type={f.secret && !show ? 'password' : 'text'}
                value={f.value}
                onChange={e => f.set(e.target.value)}
                placeholder={f.placeholder}
                className="flex-1 bg-transparent text-xs text-white outline-none placeholder:text-white/38 font-mono"
              />
              {f.secret && (
                <button onClick={() => setShow(v => !v)} className="text-white/50 hover:text-white">
                  {show ? <EyeOff size={13} /> : <Eye size={13} />}
                </button>
              )}
            </div>
          </div>
        ))}

        {error && <p className="text-[11px] text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>}

        <button
          onClick={save}
          disabled={loading || !clientId || !clientSecret}
          className="w-full py-2.5 bg-orange-500/20 border border-orange-500/30 rounded-xl text-sm font-semibold text-orange-400 hover:bg-orange-500/30 transition-all disabled:opacity-50"
        >
          {loading ? 'Opslaan…' : 'Opslaan'}
        </button>
      </div>
    </ModalShell>
  )
}

function BelastingModal({ onClose }: { onClose: () => void }) {
  return (
    <ModalShell title="Belastingdienst — BTW Deadlines" onClose={onClose}>
      <div className="space-y-3">
        <div className="bg-green-500/5 border border-green-500/20 rounded-xl p-4 space-y-1">
          <p className="text-[11px] text-white/65 leading-relaxed">
            De Belastingdienst biedt geen directe API-koppeling. Aangifte en betaling verlopen via Mijn Belastingdienst Zakelijk of via je boekhoudpakket (Moneybird).
          </p>
          <a href="https://mijn.belastingdienst.nl" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[11px] text-green-400 hover:text-green-300 mt-1">
            Mijn Belastingdienst <ExternalLink size={9} />
          </a>
        </div>

        <div className="space-y-2">
          {BTW_DEADLINES.map(d => {
            const left = daysLeft(d.deadline)
            const urgent = !d.done && left <= 30
            return (
              <div key={d.label} className={clsx('flex items-center justify-between p-3 rounded-xl border', d.done ? 'border-white/5 bg-white/[0.02]' : urgent ? 'border-red-500/20 bg-red-500/5' : 'border-white/5 bg-white/[0.02]')}>
                <div>
                  <p className="text-xs font-medium text-white/70">{d.label}</p>
                  <p className="text-[10px] text-white/50">Deadline: {new Date(d.deadline).toLocaleDateString('nl-NL')}</p>
                </div>
                {d.done
                  ? <span className="text-[10px] text-green-400 bg-green-500/10 px-2 py-0.5 rounded-full">Ingediend</span>
                  : <span className={clsx('text-[10px] px-2 py-0.5 rounded-full', urgent ? 'text-red-400 bg-red-500/10' : 'text-amber-400 bg-amber-500/10')}>
                    {left > 0 ? `${left} dagen` : 'Verlopen'}
                  </span>}
              </div>
            )
          })}
        </div>

        <button
          onClick={onClose}
          className="w-full py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white/50 hover:text-white transition-all"
        >
          Sluiten
        </button>
      </div>
    </ModalShell>
  )
}

// ─── Moneybird env check ──────────────────────────────────────────────────────

function MoneybirdSetupInfo() {
  return (
    <ModalShell title="Moneybird instellen" onClose={() => {}}>
      <div className="space-y-4">
        <div className="bg-sky-500/5 border border-sky-500/20 rounded-xl p-4 space-y-2">
          <p className="text-xs font-semibold text-sky-400">Stap 1 — App registreren</p>
          <p className="text-[11px] text-white/65 leading-relaxed">
            Ga naar Moneybird → Instellingen → Koppelingen → API → Nieuwe applicatie. Vul in als Redirect URI:
          </p>
          <code className="block text-[10px] text-sky-300 bg-sky-500/5 px-2 py-1.5 rounded font-mono break-all">
            https://dashboard.strkbeheer.nl/api/integrations/moneybird/callback
          </code>
          <p className="text-xs font-semibold text-sky-400 mt-3">Stap 2 — Env vars toevoegen</p>
          <code className="block text-[10px] text-white/65 bg-white/5 px-2 py-1.5 rounded font-mono">
            MONEYBIRD_CLIENT_ID=...<br />
            MONEYBIRD_CLIENT_SECRET=...
          </code>
        </div>
        <a href="https://moneybird.com/user/applications" target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-1.5 w-full py-2.5 bg-sky-500/20 border border-sky-500/30 rounded-xl text-sm text-sky-400 hover:bg-sky-500/30 transition-all">
          Moneybird App registreren <ExternalLink size={12} />
        </a>
      </div>
    </ModalShell>
  )
}

// ─── Main panel ───────────────────────────────────────────────────────────────

export default function IntegrationsPanel() {
  const [statuses, setStatuses] = useState<StatusMap>({})
  const [modal, setModal] = useState<string | null>(null)
  const [hasMBEnv, setHasMBEnv] = useState(true)

  async function loadStatuses() {
    const res = await fetch('/api/integrations/status')
    const data = await res.json()
    setStatuses(data)
  }

  async function checkMBEnv() {
    // Check if Moneybird is configured by hitting connect (which returns 500 if not)
    const r = await fetch('/api/integrations/moneybird/connect', { method: 'HEAD', redirect: 'manual' })
    setHasMBEnv(r.status !== 500)
  }

  useEffect(() => {
    loadStatuses()
    checkMBEnv()
  }, [])

  async function disconnect(type: string) {
    await fetch('/api/integrations/disconnect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type }),
    })
    loadStatuses()
  }

  const INTEGRATIONS = [
    {
      id: 'moneybird',
      name: 'Moneybird',
      type: 'Boekhoudpakket',
      letter: 'M',
      color: '#0ea5e9',
      description: 'Facturen, offertes, BTW-aangifte en mutaties',
    },
    {
      id: 'bunq',
      name: 'bunq',
      type: 'Bankrekening',
      letter: 'b',
      color: '#00d97e',
      description: 'Zakelijke rekeningen, transacties en saldo',
    },
    {
      id: 'ing',
      name: 'ING Zakelijk',
      type: 'Bankrekening',
      letter: 'I',
      color: '#f97316',
      description: 'Open Banking PSD2 — rekeningsaldo en mutaties',
    },
    {
      id: 'belasting',
      name: 'Belastingdienst',
      type: 'BTW & Aangifte',
      letter: 'B',
      color: '#16a34a',
      description: 'BTW-deadlines en aangifte overzicht per kwartaal',
    },
  ]

  const activeCount = INTEGRATIONS.filter(i => statuses[i.id]?.status === 'connected').length

  return (
    <>
      {modal === 'bunq' && <BunqModal onClose={() => setModal(null)} onSaved={loadStatuses} />}
      {modal === 'ing' && <INGModal onClose={() => setModal(null)} onSaved={loadStatuses} />}
      {modal === 'belasting' && <BelastingModal onClose={() => setModal(null)} />}
      {modal === 'moneybird-setup' && <MoneybirdSetupInfo />}

      <div className="bg-white/[0.06] border border-white/5 rounded-xl p-5">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <Link2 size={14} className="text-white/65" />
            <h2 className="text-sm font-semibold text-white">Externe Koppelingen</h2>
          </div>
          <span className="text-[11px] text-white/50">{activeCount}/{INTEGRATIONS.length} actief</span>
        </div>
        <p className="text-[11px] text-white/50 mb-5">
          Verbind je boekhoudpakket, bank en belastingdienst voor automatische administratie.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {INTEGRATIONS.map(int => {
            const conn = statuses[int.id]
            const isConnected = conn?.status === 'connected'
            const meta = conn?.metadata as Record<string, unknown> | undefined

            return (
              <div key={int.id} className={clsx('bg-white/[0.02] border rounded-xl p-4 flex flex-col gap-3 transition-colors', isConnected ? 'border-white/10' : 'border-white/5')}>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0" style={{ backgroundColor: int.color + '25' }}>
                    <span style={{ color: int.color }}>{int.letter}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white leading-tight">{int.name}</p>
                    <p className="text-[11px] text-white/50">{int.type}</p>
                  </div>
                </div>

                <p className="text-[10px] text-white/45 leading-relaxed">{int.description}</p>

                <div className="flex items-center gap-2">
                  {isConnected ? (
                    <div className="flex items-center gap-1.5 text-[11px] text-green-400">
                      <CheckCircle size={11} />
                      <span>Actief</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-[11px] text-white/50">
                      <XCircle size={11} />
                      <span>Niet gekoppeld</span>
                    </div>
                  )}
                </div>

                {isConnected && (
                  <div className="text-[10px] text-white/45 space-y-0.5">
                    {meta?.administration_name ? <p>Administratie: {String(meta.administration_name)}</p> : null}
                    {meta?.display_name ? <p>Account: {String(meta.display_name)}</p> : null}
                    {meta?.iban ? <p>IBAN: {String(meta.iban)}</p> : null}
                    {conn.connected_at ? (
                      <p>Gekoppeld: {new Date(conn.connected_at).toLocaleDateString('nl-NL')}</p>
                    ) : null}
                  </div>
                )}

                <div className="mt-auto pt-1 flex flex-col gap-1.5">
                  {isConnected ? (
                    <button
                      onClick={() => { if (int.id === 'belasting') setModal('belasting'); else disconnect(int.id) }}
                      className="w-full border border-white/10 text-white/65 hover:text-red-400 hover:border-red-500/20 text-xs font-medium px-3 py-2 rounded-lg transition-colors"
                    >
                      {int.id === 'belasting' ? 'Deadlines bekijken' : 'Ontkoppelen'}
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        if (int.id === 'moneybird') {
                          if (hasMBEnv) { window.location.href = '/api/integrations/moneybird/connect' }
                          else setModal('moneybird-setup')
                        } else {
                          setModal(int.id)
                        }
                      }}
                      className="w-full text-xs font-medium px-3 py-2 rounded-lg transition-colors text-white"
                      style={{ backgroundColor: int.color + '30', borderWidth: 1, borderColor: int.color + '40' }}
                    >
                      Koppelen
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}
