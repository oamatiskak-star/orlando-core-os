'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  Settings as SettingsIcon, ChevronLeft, Save, KeyRound,
  Palette, Calendar, Target as TargetIcon, AlertCircle,
} from 'lucide-react'
import clsx from 'clsx'

type Channel = {
  id: string
  name: string
  handle: string | null
  niche: string
  language: string
  persona_owner: string | null
  status: 'idea'|'incubating'|'live'|'scaling'|'killed'|'paused'
  target_views_10d: number
  branding: Record<string, unknown>
  upload_strategy: Record<string, unknown>
  posting_schedule: Record<string, unknown>
}

type Credential = {
  id: string
  platform: string
  status: string
  external_account_name: string | null
  expires_at: string | null
  last_error: string | null
}

const STATUSES = ['idea','incubating','live','scaling','paused','killed'] as const

const STATUS_COLORS: Record<string, string> = {
  idea:       'bg-white/[0.06] text-white/55',
  incubating: 'bg-amber-500/10 text-amber-300',
  live:       'bg-emerald-500/10 text-emerald-300',
  scaling:    'bg-violet-500/10 text-violet-300',
  paused:     'bg-white/[0.08] text-white/45',
  killed:     'bg-red-500/10 text-red-400',
}

export default function SettingsView() {
  const [channels, setChannels]       = useState<Channel[]>([])
  const [selectedId, setSelectedId]   = useState<string>('')
  const [draft, setDraft]             = useState<Channel | null>(null)
  const [credentials, setCredentials] = useState<Credential[]>([])
  const [saving, setSaving]           = useState(false)
  const [savedMsg, setSavedMsg]       = useState('')
  const [loadError, setLoadError]     = useState('')

  // ── Posting schedule: array<HH:MM> ───────────────────────────────────────
  const scheduleTimes = useMemo<string[]>(() => {
    if (!draft) return []
    const raw = (draft.posting_schedule as { times?: unknown })?.times
    return Array.isArray(raw) ? raw.filter((t): t is string => typeof t === 'string') : []
  }, [draft])

  // ── Load channels ────────────────────────────────────────────────────────
  const loadChannels = useCallback(async () => {
    try {
      const r = await fetch('/api/media-holding/channels')
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? `${r.status}`)
      const j = await r.json()
      setChannels(j.channels ?? [])
      if (!selectedId && j.channels?.length) setSelectedId(j.channels[0].id)
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Kan kanalen niet laden')
    }
  }, [selectedId])

  // ── Load selected channel + credentials ─────────────────────────────────
  const loadDetail = useCallback(async (id: string) => {
    setDraft(null)
    setCredentials([])
    setSavedMsg('')
    try {
      const [cRes, kRes] = await Promise.all([
        fetch(`/api/media-holding/channels/${id}`),
        fetch(`/api/media-holding/channels/${id}/credentials`),
      ])
      if (cRes.ok) setDraft((await cRes.json()).channel as Channel)
      if (kRes.ok) setCredentials(((await kRes.json()).credentials ?? []) as Credential[])
    } catch {
      // silent — UI toont fallback
    }
  }, [])

  useEffect(() => { loadChannels() }, [loadChannels])
  useEffect(() => { if (selectedId) loadDetail(selectedId) }, [selectedId, loadDetail])

  function patchDraft<K extends keyof Channel>(key: K, value: Channel[K]) {
    setDraft((d) => d ? { ...d, [key]: value } : d)
    setSavedMsg('')
  }
  function patchBranding(key: string, value: string) {
    setDraft((d) => d ? { ...d, branding: { ...d.branding, [key]: value } } : d)
    setSavedMsg('')
  }
  function patchStrategy(key: string, value: string | number) {
    setDraft((d) => d ? { ...d, upload_strategy: { ...d.upload_strategy, [key]: value } } : d)
    setSavedMsg('')
  }
  function setScheduleTimes(times: string[]) {
    setDraft((d) => d ? { ...d, posting_schedule: { ...d.posting_schedule, times } } : d)
    setSavedMsg('')
  }

  async function save() {
    if (!draft) return
    setSaving(true); setSavedMsg('')
    try {
      const r = await fetch(`/api/media-holding/channels/${draft.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:             draft.name,
          handle:           draft.handle,
          niche:            draft.niche,
          language:         draft.language,
          status:           draft.status,
          target_views_10d: draft.target_views_10d,
          branding:         draft.branding,
          upload_strategy:  draft.upload_strategy,
          posting_schedule: draft.posting_schedule,
        }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(j.error ?? `${r.status}`)
      setDraft(j.channel as Channel)
      setSavedMsg('Opgeslagen ✓')
      // refresh sidebar zonder selectie te verliezen
      loadChannels()
    } catch (e) {
      setSavedMsg(e instanceof Error ? `Fout: ${e.message}` : 'Onbekende fout')
    } finally {
      setSaving(false)
    }
  }

  const brand = (k: string) => (draft?.branding?.[k] as string | undefined) ?? ''
  const strat = (k: string) => (draft?.upload_strategy?.[k] as string | number | undefined) ?? ''

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard/media-holding" className="text-white/40 hover:text-white">
          <ChevronLeft size={16} />
        </Link>
        <div className="w-9 h-9 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
          <SettingsIcon size={16} className="text-violet-400" />
        </div>
        <div>
          <h1 className="text-base font-semibold text-white">Media Settings</h1>
          <p className="text-xs text-white/50">Kanaalconfiguratie · targets · branding · API keys</p>
        </div>
      </div>

      {loadError && (
        <div className="flex items-center gap-2 bg-red-500/5 border border-red-500/20 text-red-300 text-xs rounded-lg p-3">
          <AlertCircle size={13} /> {loadError}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Sidebar: channel list */}
        <aside className="bg-white/[0.04] border border-white/5 rounded-xl p-2 max-h-[640px] overflow-y-auto">
          {channels.length === 0 ? (
            <p className="text-[11px] text-white/40 p-3">Geen kanalen — voeg er één toe via Channels.</p>
          ) : channels.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedId(c.id)}
              className={clsx(
                'w-full text-left p-2.5 rounded-lg transition-colors mb-1',
                selectedId === c.id ? 'bg-violet-500/10 border border-violet-500/20' : 'hover:bg-white/[0.05] border border-transparent',
              )}
            >
              <div className="flex items-center justify-between mb-0.5">
                <p className="text-xs font-medium text-white/90 line-clamp-1">{c.name}</p>
                <span className={clsx('px-1.5 py-0.5 rounded text-[9px] font-medium', STATUS_COLORS[c.status])}>
                  {c.status}
                </span>
              </div>
              <p className="text-[10px] text-white/40 line-clamp-1">{c.niche} · {c.language.toUpperCase()}</p>
            </button>
          ))}
        </aside>

        {/* Detail form */}
        <section className="lg:col-span-3 space-y-4">
          {!draft ? (
            <div className="bg-white/[0.04] border border-white/5 rounded-xl p-10 text-center text-xs text-white/40">
              Selecteer een kanaal om instellingen te bewerken.
            </div>
          ) : (
            <>
              {/* Basis */}
              <Card icon={<SettingsIcon size={13} />} title="Basisgegevens">
                <Grid2>
                  <Field label="Naam">
                    <input
                      value={draft.name}
                      onChange={(e) => patchDraft('name', e.target.value)}
                      className="w-full bg-white/[0.06] border border-white/10 rounded-lg px-3 py-2 text-xs text-white"
                    />
                  </Field>
                  <Field label="Handle">
                    <input
                      value={draft.handle ?? ''}
                      onChange={(e) => patchDraft('handle', e.target.value || null)}
                      placeholder="@slicetheory"
                      className="w-full bg-white/[0.06] border border-white/10 rounded-lg px-3 py-2 text-xs text-white"
                    />
                  </Field>
                  <Field label="Niche">
                    <input
                      value={draft.niche}
                      onChange={(e) => patchDraft('niche', e.target.value)}
                      className="w-full bg-white/[0.06] border border-white/10 rounded-lg px-3 py-2 text-xs text-white"
                    />
                  </Field>
                  <Field label="Taal">
                    <input
                      value={draft.language}
                      onChange={(e) => patchDraft('language', e.target.value.toLowerCase())}
                      maxLength={5}
                      className="w-full bg-white/[0.06] border border-white/10 rounded-lg px-3 py-2 text-xs text-white"
                    />
                  </Field>
                  <Field label="Status">
                    <select
                      value={draft.status}
                      onChange={(e) => patchDraft('status', e.target.value as Channel['status'])}
                      className="w-full bg-white/[0.06] border border-white/10 rounded-lg px-3 py-2 text-xs text-white"
                    >
                      {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </Field>
                  <Field label="Persona">
                    <input
                      value={draft.persona_owner ?? ''}
                      onChange={(e) => patchDraft('persona_owner', e.target.value || null)}
                      placeholder="Nova"
                      className="w-full bg-white/[0.06] border border-white/10 rounded-lg px-3 py-2 text-xs text-white"
                    />
                  </Field>
                </Grid2>
              </Card>

              {/* Targets */}
              <Card icon={<TargetIcon size={13} />} title="Targets">
                <Grid2>
                  <Field label="Doelviews per 10 dagen">
                    <input
                      type="number"
                      value={draft.target_views_10d}
                      onChange={(e) => patchDraft('target_views_10d', Number(e.target.value) || 0)}
                      className="w-full bg-white/[0.06] border border-white/10 rounded-lg px-3 py-2 text-xs text-white"
                    />
                  </Field>
                  <Field label="Shorts per dag">
                    <input
                      type="number"
                      value={strat('shorts_per_day')}
                      onChange={(e) => patchStrategy('shorts_per_day', Number(e.target.value) || 0)}
                      className="w-full bg-white/[0.06] border border-white/10 rounded-lg px-3 py-2 text-xs text-white"
                    />
                  </Field>
                  <Field label="Longs per week">
                    <input
                      type="number"
                      value={strat('longs_per_week')}
                      onChange={(e) => patchStrategy('longs_per_week', Number(e.target.value) || 0)}
                      className="w-full bg-white/[0.06] border border-white/10 rounded-lg px-3 py-2 text-xs text-white"
                    />
                  </Field>
                  <Field label="Format mix (vrij tekst)">
                    <input
                      value={strat('format_mix') as string}
                      onChange={(e) => patchStrategy('format_mix', e.target.value)}
                      placeholder="60% loops · 30% talking-head · 10% remix"
                      className="w-full bg-white/[0.06] border border-white/10 rounded-lg px-3 py-2 text-xs text-white"
                    />
                  </Field>
                </Grid2>
              </Card>

              {/* Branding */}
              <Card icon={<Palette size={13} />} title="Branding">
                <Grid2>
                  <Field label="Primary kleur">
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={brand('primary_color') || '#8b5cf6'}
                        onChange={(e) => patchBranding('primary_color', e.target.value)}
                        className="w-10 h-9 rounded-lg bg-white/[0.06] border border-white/10 cursor-pointer"
                      />
                      <input
                        value={brand('primary_color')}
                        onChange={(e) => patchBranding('primary_color', e.target.value)}
                        className="flex-1 bg-white/[0.06] border border-white/10 rounded-lg px-3 py-2 text-xs text-white"
                      />
                    </div>
                  </Field>
                  <Field label="Accent kleur">
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={brand('accent_color') || '#6366f1'}
                        onChange={(e) => patchBranding('accent_color', e.target.value)}
                        className="w-10 h-9 rounded-lg bg-white/[0.06] border border-white/10 cursor-pointer"
                      />
                      <input
                        value={brand('accent_color')}
                        onChange={(e) => patchBranding('accent_color', e.target.value)}
                        className="flex-1 bg-white/[0.06] border border-white/10 rounded-lg px-3 py-2 text-xs text-white"
                      />
                    </div>
                  </Field>
                  <Field label="Logo URL">
                    <input
                      value={brand('logo_url')}
                      onChange={(e) => patchBranding('logo_url', e.target.value)}
                      placeholder="https://…"
                      className="w-full bg-white/[0.06] border border-white/10 rounded-lg px-3 py-2 text-xs text-white"
                    />
                  </Field>
                  <Field label="Watermark URL">
                    <input
                      value={brand('watermark_url')}
                      onChange={(e) => patchBranding('watermark_url', e.target.value)}
                      placeholder="https://…"
                      className="w-full bg-white/[0.06] border border-white/10 rounded-lg px-3 py-2 text-xs text-white"
                    />
                  </Field>
                  <Field label="Channel tagline">
                    <input
                      value={brand('tagline')}
                      onChange={(e) => patchBranding('tagline', e.target.value)}
                      placeholder="High-retention loops"
                      className="w-full bg-white/[0.06] border border-white/10 rounded-lg px-3 py-2 text-xs text-white"
                    />
                  </Field>
                </Grid2>
              </Card>

              {/* Posting schedule */}
              <Card icon={<Calendar size={13} />} title="Posting schedule">
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-2">
                    {scheduleTimes.length === 0 && (
                      <p className="text-[11px] text-white/40">Nog geen tijden ingesteld.</p>
                    )}
                    {scheduleTimes.map((t, i) => (
                      <div key={i} className="flex items-center gap-1 bg-white/[0.06] border border-white/10 rounded-lg pl-2">
                        <input
                          type="time"
                          value={t}
                          onChange={(e) => {
                            const next = [...scheduleTimes]; next[i] = e.target.value
                            setScheduleTimes(next)
                          }}
                          className="bg-transparent text-xs text-white outline-none py-1.5"
                        />
                        <button
                          onClick={() => setScheduleTimes(scheduleTimes.filter((_, k) => k !== i))}
                          className="px-2 text-white/40 hover:text-red-400 text-xs"
                        >×</button>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() => setScheduleTimes([...scheduleTimes, '09:00'])}
                    className="text-[11px] text-violet-300 hover:text-violet-200"
                  >
                    + Tijd toevoegen
                  </button>
                </div>
              </Card>

              {/* Credentials overzicht */}
              <Card icon={<KeyRound size={13} />} title="API Keys & OAuth">
                {credentials.length === 0 ? (
                  <p className="text-[11px] text-white/40">
                    Geen credentials geconfigureerd. Gebruik <span className="text-violet-300">Channels → OAuth</span> om YouTube/TikTok te koppelen.
                  </p>
                ) : (
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-[10px] uppercase text-white/40 tracking-wider">
                        <th className="text-left py-1.5">Platform</th>
                        <th className="text-left">Status</th>
                        <th className="text-left">Account</th>
                        <th className="text-left">Verloopt</th>
                      </tr>
                    </thead>
                    <tbody>
                      {credentials.map((c) => (
                        <tr key={c.id} className="border-t border-white/5">
                          <td className="py-2 text-white/85 capitalize">{c.platform}</td>
                          <td>
                            <span className={clsx(
                              'px-1.5 py-0.5 rounded text-[10px]',
                              c.status === 'connected' ? 'bg-emerald-500/10 text-emerald-300' :
                              c.status === 'configured' ? 'bg-amber-500/10 text-amber-300' :
                              'bg-red-500/10 text-red-300',
                            )}>{c.status}</span>
                          </td>
                          <td className="text-white/70">{c.external_account_name ?? '—'}</td>
                          <td className="text-white/55 text-[11px]">
                            {c.expires_at ? new Date(c.expires_at).toLocaleDateString('nl-NL') : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </Card>

              {/* Save bar */}
              <div className="sticky bottom-2 flex items-center justify-between bg-[#0f1117]/95 backdrop-blur border border-white/10 rounded-xl p-3 z-10">
                <p className={clsx(
                  'text-xs',
                  savedMsg.startsWith('Fout') ? 'text-red-300' :
                  savedMsg ? 'text-emerald-300' : 'text-white/40',
                )}>
                  {savedMsg || 'Wijzigingen niet opgeslagen.'}
                </p>
                <button
                  onClick={save}
                  disabled={saving}
                  className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-xs font-medium px-4 py-2 rounded-lg"
                >
                  <Save size={13} />
                  {saving ? 'Opslaan…' : 'Opslaan'}
                </button>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  )
}

function Card({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white/[0.04] border border-white/5 rounded-xl">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5">
        <span className="text-violet-400">{icon}</span>
        <h3 className="text-xs font-semibold text-white/85">{title}</h3>
      </div>
      <div className="p-4">{children}</div>
    </div>
  )
}

function Grid2({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{children}</div>
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[10px] text-white/40 uppercase tracking-wider mb-1 block">{label}</span>
      {children}
    </label>
  )
}
