'use client'

import { useState } from 'react'
import { Webhook, Plus, X, Pause, Trash2, RefreshCw, Copy, CheckCheck } from 'lucide-react'
import { createWebhook, toggleWebhook, regenerateSecret, deleteWebhook } from './actions'

type WebhookDef = {
  id: string
  naam: string
  company: string
  endpoint_path: string
  secret: string
  workflow_id: string | null
  method: string
  status: string
  last_triggered_at: string | null
  trigger_count: number
  created_at: string
}

type Workflow = { id: string; naam: string }

const STATUS_COLORS: Record<string, string> = {
  actief: 'text-green-400 bg-green-500/10',
  inactief: 'text-white/38 bg-white/5',
}

const COMPANIES = ['MODIWÉ', 'MEDIA', 'STRKBEHEER', 'STRKBOUW', 'PROFFS']
const METHODS = ['POST', 'PUT', 'PATCH', 'GET']

function WebhookRow({ webhook, workflows }: { webhook: WebhookDef; workflows: Workflow[] }) {
  const [toggling, setToggling] = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const [copied, setCopied] = useState(false)

  async function handleToggle() {
    setToggling(true)
    await toggleWebhook(webhook.id, webhook.status)
    setToggling(false)
  }

  async function handleRegenerate() {
    if (!confirm('Secret regenereren? De oude URL werkt daarna niet meer.')) return
    setRegenerating(true)
    await regenerateSecret(webhook.id)
    setRegenerating(false)
  }

  function copyUrl() {
    const url = `${window.location.origin}/api/webhooks/${webhook.endpoint_path}`
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const connectedWorkflow = workflows.find(w => w.id === webhook.workflow_id)
  const lastTriggered = webhook.last_triggered_at
    ? new Date(webhook.last_triggered_at).toLocaleString('nl-NL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
    : '—'

  return (
    <div className="bg-white/[0.06] border border-white/5 rounded-xl p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-white">{webhook.naam}</span>
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${STATUS_COLORS[webhook.status] ?? 'text-white/50 bg-white/5'}`}>
              {webhook.status}
            </span>
            <span className="px-1.5 py-0.5 rounded bg-indigo-500/10 text-[10px] text-indigo-400 font-mono">{webhook.method}</span>
          </div>
          <p className="text-[10px] text-white/38 mt-0.5">{webhook.company}</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-white/30">Getriggerd</p>
          <p className="text-sm font-bold text-white">{webhook.trigger_count}</p>
          <p className="text-[10px] text-white/30">{lastTriggered}</p>
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center gap-2 bg-white/5 rounded-lg px-3 py-2">
          <code className="text-[11px] text-white/60 font-mono flex-1 truncate">/api/webhooks/{webhook.endpoint_path}</code>
          <button onClick={copyUrl} className="text-white/38 hover:text-indigo-400 transition-colors flex-shrink-0">
            {copied ? <CheckCheck size={12} className="text-green-400" /> : <Copy size={12} />}
          </button>
        </div>
        <div className="flex items-center gap-2 bg-white/5 rounded-lg px-3 py-1.5">
          <span className="text-[10px] text-white/30">secret:</span>
          <code className="text-[11px] text-indigo-300 font-mono flex-1 truncate">{webhook.secret}</code>
          <button onClick={handleRegenerate} disabled={regenerating} className="text-white/38 hover:text-amber-400 transition-colors flex-shrink-0">
            <RefreshCw size={11} className={regenerating ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {connectedWorkflow && (
        <p className="text-[10px] text-white/45">
          → Workflow: <span className="text-indigo-400">{connectedWorkflow.naam}</span>
        </p>
      )}

      <div className="flex gap-2 border-t border-white/5 pt-2">
        <button onClick={handleToggle} disabled={toggling}
          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg border border-white/10 text-white/60 hover:text-amber-400 hover:border-amber-500/30 text-xs transition-colors disabled:opacity-30">
          <Pause size={10} /> {webhook.status === 'actief' ? 'Pauzeer' : 'Activeer'}
        </button>
        <button onClick={() => { if (confirm(`"${webhook.naam}" verwijderen?`)) deleteWebhook(webhook.id) }}
          className="w-8 flex items-center justify-center py-1.5 rounded-lg border border-white/10 text-white/60 hover:text-red-400 hover:border-red-500/30 text-xs transition-colors">
          <Trash2 size={10} />
        </button>
      </div>
    </div>
  )
}

function NieuweWebhookModal({ onClose, workflows }: { onClose: () => void; workflows: Workflow[] }) {
  const [pending, setPending] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setPending(true)
    const fd = new FormData(e.currentTarget)
    await createWebhook(fd)
    setPending(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[#181830] border border-white/10 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5 sticky top-0 bg-[#181830] z-10">
          <h2 className="text-sm font-semibold text-white">Nieuwe Webhook</h2>
          <button onClick={onClose} className="text-white/50 hover:text-white transition-colors"><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs text-white/50 mb-1">Naam *</label>
            <input name="naam" required placeholder="bijv. Stripe Payment Webhook"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-indigo-500/60 transition-colors" />
          </div>
          <div>
            <label className="block text-xs text-white/50 mb-1">Endpoint Path *</label>
            <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg px-3 py-2">
              <span className="text-xs text-white/30 flex-shrink-0">/api/webhooks/</span>
              <input name="endpoint_path" required placeholder="stripe/payment"
                className="flex-1 bg-transparent text-sm text-white placeholder-white/20 outline-none font-mono" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-white/50 mb-1">Bedrijf</label>
              <select name="company" className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-indigo-500/60 transition-colors">
                {COMPANIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-white/50 mb-1">HTTP Methode</label>
              <select name="method" className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-indigo-500/60 transition-colors">
                {METHODS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </div>
          {workflows.length > 0 && (
            <div>
              <label className="block text-xs text-white/50 mb-1">Koppel aan Workflow</label>
              <select name="workflow_id" className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-indigo-500/60 transition-colors">
                <option value="">— geen koppeling —</option>
                {workflows.map(w => <option key={w.id} value={w.id}>{w.naam}</option>)}
              </select>
            </div>
          )}

          <div className="p-3 bg-indigo-500/5 border border-indigo-500/20 rounded-lg">
            <p className="text-[11px] text-indigo-400">Een unieke secret wordt automatisch gegenereerd bij aanmaken.</p>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={pending}
              className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium py-2.5 rounded-lg transition-colors">
              {pending ? 'Aanmaken...' : 'Webhook aanmaken'}
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

export default function WebhookList({ webhooks, workflows }: { webhooks: WebhookDef[]; workflows: Workflow[] }) {
  const [showNew, setShowNew] = useState(false)

  const actief = webhooks.filter(w => w.status === 'actief').length
  const totalTriggers = webhooks.reduce((s, w) => s + (w.trigger_count ?? 0), 0)

  return (
    <>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 text-xs text-white/50">
          <span>{actief} actief</span>
          <span>{totalTriggers} totaal getriggerd</span>
        </div>
        <button onClick={() => setShowNew(true)}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium px-4 py-2 rounded-lg transition-colors">
          <Plus size={13} />
          Nieuwe webhook
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {webhooks.map(wh => <WebhookRow key={wh.id} webhook={wh} workflows={workflows} />)}
        {webhooks.length === 0 && (
          <div className="col-span-2 flex flex-col items-center justify-center py-16 gap-3 bg-white/[0.02] border border-white/5 rounded-xl">
            <Webhook size={24} className="text-white/20" />
            <p className="text-sm text-white/50">Geen webhooks geconfigureerd</p>
            <button onClick={() => setShowNew(true)} className="text-xs text-indigo-400 hover:text-indigo-300">
              Maak je eerste webhook aan
            </button>
          </div>
        )}
      </div>

      {showNew && <NieuweWebhookModal onClose={() => setShowNew(false)} workflows={workflows} />}
    </>
  )
}
