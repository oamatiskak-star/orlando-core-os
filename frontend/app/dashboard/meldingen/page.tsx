'use client'

import { useState, useEffect, useCallback } from 'react'
import { Bell, Bot, Settings, CreditCard, Shield, CheckCheck, Trash2, Plus, X } from 'lucide-react'
import clsx from 'clsx'

type Notification = {
  id: string
  type: string
  titel: string | null
  bericht: string
  gelezen: boolean
  link_url: string | null
  created_at: string
}

const TYPE_CONFIG: Record<string, { icon: typeof Bot; iconColor: string; iconBg: string; borderColor: string; badge: string }> = {
  Agent:      { icon: Bot,        iconColor: 'text-green-400',  iconBg: 'bg-green-500/10',  borderColor: 'border-l-green-500/40',  badge: 'bg-cyan-500/10 text-cyan-400'   },
  Systeem:    { icon: Settings,   iconColor: 'text-sky-400',    iconBg: 'bg-sky-500/10',    borderColor: 'border-l-sky-500/40',    badge: 'bg-white/5 text-white/65'       },
  Auth:       { icon: Shield,     iconColor: 'text-blue-400',   iconBg: 'bg-blue-500/10',   borderColor: 'border-l-blue-500/40',   badge: 'bg-blue-500/10 text-blue-400'   },
  Financieel: { icon: CreditCard, iconColor: 'text-purple-400', iconBg: 'bg-purple-500/10', borderColor: 'border-l-purple-500/40', badge: 'bg-purple-500/10 text-purple-400'},
}

const FALLBACK = { icon: Bell, iconColor: 'text-white/65', iconBg: 'bg-white/5', borderColor: 'border-l-white/10', badge: 'bg-white/5 text-white/65' }

function fmtTime(dateStr: string) {
  const d = new Date(dateStr)
  const now = new Date()
  const diff = Math.floor((now.getTime() - d.getTime()) / 1000)
  if (diff < 60)   return `${diff}s geleden`
  if (diff < 3600) return `${Math.floor(diff / 60)}m geleden`
  if (diff < 86400) return `${Math.floor(diff / 3600)}u geleden`
  if (diff < 172800) return 'Gisteren'
  return `${Math.floor(diff / 86400)}d geleden`
}

const EMPTY_FORM = { type: 'Systeem', titel: '', bericht: '' }
const TYPES = ['Agent', 'Systeem', 'Auth', 'Financieel']

export default function MeldingenPage() {
  const [items, setItems] = useState<Notification[]>([])
  const [activeTab, setActiveTab] = useState('Alle')
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/notifications')
      if (res.ok) {
        const j = await res.json()
        setItems(j.notifications ?? [])
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = items.filter(n => {
    if (activeTab === 'Ongelezen') return !n.gelezen
    if (activeTab === 'Agents')    return n.type === 'Agent'
    if (activeTab === 'Systeem')   return n.type === 'Systeem'
    if (activeTab === 'Financieel')return n.type === 'Financieel'
    return true
  })

  const unread = items.filter(n => !n.gelezen).length

  async function markRead(id: string) {
    await fetch(`/api/notifications/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ gelezen: true }) })
    setItems(prev => prev.map(n => n.id === id ? { ...n, gelezen: true } : n))
  }

  async function markAllRead() {
    await fetch('/api/notifications', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'mark_all_read' }) })
    setItems(prev => prev.map(n => ({ ...n, gelezen: true })))
  }

  async function del(id: string) {
    await fetch(`/api/notifications/${id}`, { method: 'DELETE' })
    setItems(prev => prev.filter(n => n.id !== id))
  }

  async function save() {
    if (!form.bericht.trim()) { setError('Bericht is verplicht'); return }
    setSaving(true); setError('')
    try {
      const res = await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: form.type, titel: form.titel || null, bericht: form.bericht }),
      })
      if (!res.ok) { const j = await res.json(); setError(j.error ?? 'Fout'); return }
      setShowModal(false)
      await load()
    } finally {
      setSaving(false)
    }
  }

  const tabs = ['Alle', 'Ongelezen', 'Agents', 'Systeem', 'Financieel']

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative w-9 h-9 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
            <Bell size={16} className="text-red-400" />
            {unread > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </div>
          <div>
            <h1 className="text-base font-semibold text-white">Meldingen</h1>
            <p className="text-xs text-white/50">Notificaties, alerts en systeem meldingen over alle BV&apos;s.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {unread > 0 && (
            <button
              onClick={markAllRead}
              className="flex items-center gap-2 border border-white/10 text-white/50 hover:text-white hover:border-white/20 text-xs font-medium px-4 py-2 rounded-lg transition-colors"
            >
              <CheckCheck size={13} /> Alles gelezen
            </button>
          )}
          <button
            onClick={() => { setForm({ ...EMPTY_FORM }); setError(''); setShowModal(true) }}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium px-4 py-2 rounded-lg transition-colors"
          >
            <Plus size={13} /> Toevoegen
          </button>
        </div>
      </div>

      <div className="flex items-center gap-1 p-1 bg-white/[0.06] border border-white/5 rounded-xl w-fit">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={clsx(
              'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
              activeTab === tab ? 'bg-indigo-600 text-white' : 'text-white/65 hover:text-white/70'
            )}
          >
            {tab}{tab === 'Ongelezen' && unread > 0 ? ` (${unread})` : ''}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {loading ? (
          <div className="bg-white/[0.06] border border-white/5 rounded-xl p-10 text-center text-xs text-white/40">Laden…</div>
        ) : filtered.length === 0 ? (
          <div className="bg-white/[0.06] border border-white/5 rounded-xl p-10 text-center text-xs text-white/40">Geen meldingen</div>
        ) : filtered.map((n) => {
          const cfg = TYPE_CONFIG[n.type] ?? FALLBACK
          const Icon = cfg.icon
          return (
            <div
              key={n.id}
              className={clsx(
                'bg-white/[0.06] border border-white/5 border-l-2 rounded-xl p-4 flex items-start gap-3 transition-opacity',
                cfg.borderColor,
                n.gelezen && 'opacity-55'
              )}
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${cfg.iconBg}`}>
                <Icon size={14} className={cfg.iconColor} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={clsx('px-2 py-0.5 rounded-full text-[10px] font-semibold', cfg.badge)}>{n.type}</span>
                  {n.titel && <span className="text-[11px] text-white/65 font-medium">{n.titel}</span>}
                  {!n.gelezen && <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 flex-shrink-0" />}
                </div>
                <p className="text-xs text-white/70 leading-relaxed">{n.bericht}</p>
              </div>
              <div className="flex flex-col items-end gap-2 flex-shrink-0">
                <span className="text-[11px] text-white/45 whitespace-nowrap">{fmtTime(n.created_at)}</span>
                <div className="flex items-center gap-2">
                  {!n.gelezen && (
                    <button onClick={() => markRead(n.id)} className="text-[11px] text-indigo-400 hover:text-indigo-300 transition-colors whitespace-nowrap">
                      Gelezen
                    </button>
                  )}
                  <button onClick={() => del(n.id)} className="text-white/25 hover:text-red-400 transition-colors">
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#0f1117] border border-white/10 rounded-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-white/5">
              <h2 className="text-sm font-semibold text-white">Nieuwe melding</h2>
              <button onClick={() => setShowModal(false)}><X size={16} className="text-white/50 hover:text-white" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-[11px] text-white/50 mb-1.5">Type</label>
                <select
                  className="w-full bg-white/[0.06] border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  value={form.type}
                  onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                >
                  {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[11px] text-white/50 mb-1.5">Titel (optioneel)</label>
                <input
                  className="w-full bg-white/[0.06] border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:border-indigo-500"
                  placeholder="Korte titel…"
                  value={form.titel}
                  onChange={e => setForm(f => ({ ...f, titel: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-[11px] text-white/50 mb-1.5">Bericht *</label>
                <textarea
                  rows={3}
                  className="w-full bg-white/[0.06] border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:border-indigo-500 resize-none"
                  placeholder="Meldingstekst…"
                  value={form.bericht}
                  onChange={e => setForm(f => ({ ...f, bericht: e.target.value }))}
                />
              </div>
              {error && <p className="text-xs text-red-400">{error}</p>}
              <div className="flex gap-3 pt-1">
                <button onClick={() => setShowModal(false)} className="flex-1 border border-white/10 text-white/60 hover:text-white text-xs font-medium py-2.5 rounded-lg transition-colors">Annuleren</button>
                <button onClick={save} disabled={saving} className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-medium py-2.5 rounded-lg transition-colors">
                  {saving ? 'Opslaan…' : 'Toevoegen'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
