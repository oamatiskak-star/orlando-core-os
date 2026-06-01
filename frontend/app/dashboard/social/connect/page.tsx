'use client'

import { useCallback, useEffect, useState } from 'react'
import { Linkedin, Facebook, Plug, CheckCircle2, AlertCircle, Link2, ExternalLink, Trash2, KeyRound, Globe } from 'lucide-react'
import clsx from 'clsx'

type Conn = {
  id: string
  platform: string
  company: string
  account_label: string
  external_account_id: string | null
  external_account_name: string | null
  profile_url: string | null
  redirect_uri: string | null
  scopes: string[] | null
  status: string
  last_error: string | null
  has_credentials: boolean
  has_token: boolean
  updated_at: string
}

const META: Record<string, { label: string; icon: React.ElementType; accent: string; ring: string; setupDoc: string; scopes: string }> = {
  linkedin: {
    label: 'LinkedIn',
    icon: Linkedin,
    accent: 'text-[#0A66C2]',
    ring:   'border-[#0A66C2]/30 bg-[#0A66C2]/10',
    setupDoc: 'LinkedIn Developer App → Community Management API → Organization Page admin',
    scopes: 'w_organization_social, r_organization_social, w_member_social',
  },
  facebook: {
    label: 'Facebook',
    icon: Facebook,
    accent: 'text-[#1877F2]',
    ring:   'border-[#1877F2]/30 bg-[#1877F2]/10',
    setupDoc: 'Meta Developers App → Page Access Token (long-lived) → docs/FACEBOOK_SETUP.md',
    scopes: 'pages_show_list, pages_manage_posts, pages_read_engagement',
  },
}

const STATUS: Record<string, { label: string; cls: string; icon: React.ElementType }> = {
  connected:    { label: 'Verbonden',    cls: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', icon: CheckCircle2 },
  configured:   { label: 'Geconfigureerd', cls: 'text-amber-400 bg-amber-500/10 border-amber-500/20',     icon: KeyRound },
  error:        { label: 'Fout',         cls: 'text-red-400 bg-red-500/10 border-red-500/20',             icon: AlertCircle },
  disconnected: { label: 'Niet verbonden', cls: 'text-white/40 bg-white/5 border-white/10',               icon: Plug },
}

type Draft = {
  id?: string
  platform: string
  account_label: string
  external_account_id: string
  external_account_name: string
  profile_url: string
  client_id: string
  client_secret: string
  access_token: string
}

export default function SocialConnectPage() {
  const [conns, setConns]   = useState<Conn[]>([])
  const [loading, setLoad]  = useState(true)
  const [modal, setModal]   = useState<Draft | null>(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoad(true)
    const r = await fetch('/api/social/connections?company=modiwe-software', { cache: 'no-store' })
    if (r.ok) setConns((await r.json()).connections ?? [])
    setLoad(false)
  }, [])

  useEffect(() => { load() }, [load])

  const openConnect = (c: Conn) => setModal({
    id: c.id,
    platform: c.platform,
    account_label: c.account_label,
    external_account_id: c.external_account_id ?? '',
    external_account_name: c.external_account_name ?? '',
    profile_url: c.profile_url ?? '',
    client_id: '', client_secret: '', access_token: '',
  })

  const save = async () => {
    if (!modal) return
    setSaving(true)
    const body: Record<string, unknown> = {
      platform: modal.platform,
      company: 'modiwe-software',
      account_label: modal.account_label || 'Aquier',
      external_account_id: modal.external_account_id || undefined,
      external_account_name: modal.external_account_name || undefined,
      profile_url: modal.profile_url || undefined,
    }
    if (modal.client_id)     body.client_id = modal.client_id
    if (modal.client_secret) body.client_secret = modal.client_secret
    if (modal.access_token)  body.access_token = modal.access_token
    const r = await fetch('/api/social/connections', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })
    if (r.ok) { setModal(null); load() }
    setSaving(false)
  }

  const disconnect = async (c: Conn) => {
    if (!confirm(`${META[c.platform]?.label ?? c.platform} ontkoppelen? Tokens worden gewist.`)) return
    await fetch(`/api/social/connections/${c.id}`, { method: 'DELETE' })
    load()
  }

  const connected = conns.filter(c => c.status === 'connected').length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-white">Social Koppelingen</h1>
          <p className="text-sm text-white/65 mt-0.5">Verbind de Aquier LinkedIn- en Facebook-pagina met het dashboard</p>
        </div>
        <span className="text-xs text-white/50">{connected}/{conns.length} verbonden</span>
      </div>

      {loading ? (
        <div className="text-center py-12 text-white/30 text-sm">Laden…</div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {conns.map(c => {
            const m = META[c.platform] ?? { label: c.platform, icon: Globe, accent: 'text-white/70', ring: 'border-white/10 bg-white/5', setupDoc: '', scopes: '' }
            const s = STATUS[c.status] ?? STATUS.disconnected
            const Icon = m.icon
            const SIcon = s.icon
            return (
              <div key={c.id} className="bg-white/[0.06] border border-white/8 rounded-2xl p-5 space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={clsx('w-10 h-10 rounded-xl border flex items-center justify-center', m.ring)}>
                      <Icon size={18} className={m.accent} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">{m.label}</p>
                      <p className="text-xs text-white/45">{c.account_label}{c.external_account_name ? ` · ${c.external_account_name}` : ''}</p>
                    </div>
                  </div>
                  <span className={clsx('flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] border', s.cls)}>
                    <SIcon size={11} /> {s.label}
                  </span>
                </div>

                <div className="text-[11px] text-white/40 space-y-1">
                  {m.scopes && <p><span className="text-white/30">Scopes:</span> {m.scopes}</p>}
                  {c.has_credentials && <p className="text-amber-400/70">App-credentials opgeslagen</p>}
                  {c.has_token && <p className="text-emerald-400/70">Access token actief</p>}
                  {c.last_error && <p className="text-red-400/80">⚠ {c.last_error}</p>}
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => openConnect(c)}
                    className={clsx('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border transition-colors',
                      c.has_token ? 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10'
                                  : 'bg-indigo-500/15 border-indigo-500/25 text-indigo-300 hover:bg-indigo-500/25')}
                  >
                    <Link2 size={12} /> {c.has_token ? 'Bewerken' : 'Verbinden'}
                  </button>
                  {c.profile_url && (
                    <a href={c.profile_url} target="_blank" rel="noreferrer"
                       className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-white/5 border border-white/10 text-white/60 hover:text-white transition-colors">
                      <ExternalLink size={12} /> Open pagina
                    </a>
                  )}
                  {(c.has_token || c.has_credentials) && (
                    <button onClick={() => disconnect(c)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-white/5 border border-white/10 text-white/40 hover:text-red-400 hover:border-red-500/20 transition-colors">
                      <Trash2 size={12} /> Ontkoppel
                    </button>
                  )}
                </div>

                {m.setupDoc && (
                  <p className="text-[10px] text-white/30 border-t border-white/5 pt-3">Setup: {m.setupDoc}</p>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#111] border border-white/10 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto flex flex-col">
            <div className="sticky top-0 bg-[#111] border-b border-white/8 px-5 py-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-white">{META[modal.platform]?.label ?? modal.platform} verbinden</h2>
              <button onClick={() => setModal(null)} className="text-white/40 hover:text-white text-xl leading-none">×</button>
            </div>

            <div className="p-5 space-y-4">
              <p className="text-xs text-white/45 leading-relaxed">
                Plak de OAuth-app-gegevens en/of een geldig (long-lived) access token van de {META[modal.platform]?.label} pagina.
                Velden zijn server-side versleuteld opgeslagen en worden nooit naar de browser teruggestuurd.
              </p>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Account label" v={modal.account_label} on={v => setModal(m => ({ ...m!, account_label: v }))} ph="Aquier" />
                <Field label="Pagina/Org ID" v={modal.external_account_id} on={v => setModal(m => ({ ...m!, external_account_id: v }))} ph="urn:li:organization:…" />
              </div>
              <Field label="Pagina-naam (weergave)" v={modal.external_account_name} on={v => setModal(m => ({ ...m!, external_account_name: v }))} ph="Aquier" />
              <Field label="Pagina-URL" v={modal.profile_url} on={v => setModal(m => ({ ...m!, profile_url: v }))} ph="https://www.linkedin.com/company/aquier" />

              <div className="border-t border-white/8 pt-4 space-y-3">
                <p className="text-[11px] uppercase tracking-wide text-white/35">OAuth app (optioneel)</p>
                <Field label="Client ID" v={modal.client_id} on={v => setModal(m => ({ ...m!, client_id: v }))} ph="App client id" />
                <Field label="Client Secret" v={modal.client_secret} on={v => setModal(m => ({ ...m!, client_secret: v }))} ph="••••••••" type="password" />
                <Field label="Access Token (long-lived)" v={modal.access_token} on={v => setModal(m => ({ ...m!, access_token: v }))} ph="••••••••" type="password" />
              </div>
            </div>

            <div className="sticky bottom-0 bg-[#111] border-t border-white/8 px-5 py-4 flex justify-end gap-3">
              <button onClick={() => setModal(null)} className="px-4 py-2 rounded-lg text-sm text-white/50 hover:text-white hover:bg-white/5 transition-colors">Annuleren</button>
              <button onClick={save} disabled={saving}
                className="px-4 py-2 rounded-lg text-sm bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/30 transition-colors disabled:opacity-50">
                {saving ? 'Opslaan…' : 'Opslaan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Field({ label, v, on, ph, type = 'text' }: { label: string; v: string; on: (v: string) => void; ph?: string; type?: string }) {
  return (
    <div>
      <label className="text-xs text-white/50 mb-1 block">{label}</label>
      <input
        type={type}
        value={v}
        onChange={e => on(e.target.value)}
        placeholder={ph}
        autoComplete="off"
        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/25 focus:outline-none focus:border-indigo-500/50"
      />
    </div>
  )
}
