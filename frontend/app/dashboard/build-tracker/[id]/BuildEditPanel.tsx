'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Save, Check, AlertTriangle, Loader2, KeyRound } from 'lucide-react'
import { updateBuild } from '../actions'
import { ACCOUNT_TYPES, REVENUE_MODELS, REVENUE_CURRENCIES } from '@/lib/account-setup'

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: 'planned', label: 'Gepland' },
  { value: 'building', label: 'In bouw' },
  { value: 'testing', label: 'Test' },
  { value: 'deploying', label: 'Deployment' },
  { value: 'live', label: 'Live' },
  { value: 'paused', label: 'Gepauzeerd' },
  { value: 'failed', label: 'Mislukt' },
]

type AccountConfig = {
  requires_account_setup: boolean
  account_platform: string | null
  account_type: string | null
  expected_revenue_model: string | null
  expected_revenue_amount: number | null
  revenue_currency: string | null
}

type Props = {
  id: string
  status: string
  progress: number
  currentMilestone: string | null
  description: string | null
  companyColor: string
  account: AccountConfig
}

export default function BuildEditPanel({ id, status, progress, currentMilestone, description, companyColor, account }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState({
    status,
    progress_pct: progress,
    current_milestone: currentMilestone ?? '',
    description: description ?? '',
  })

  const [acct, setAcct] = useState({
    requires_account_setup: account.requires_account_setup,
    account_platform: account.account_platform ?? '',
    account_type: account.account_type ?? '',
    expected_revenue_model: account.expected_revenue_model ?? '',
    expected_revenue_amount: account.expected_revenue_amount != null ? String(account.expected_revenue_amount) : '',
    revenue_currency: account.revenue_currency ?? 'EUR',
  })

  function save() {
    setError(null)
    setSaved(false)
    startTransition(async () => {
      const res = await updateBuild({
        id,
        status: form.status,
        progress_pct: form.progress_pct,
        current_milestone: form.current_milestone,
        description: form.description,
        requires_account_setup: acct.requires_account_setup,
        account_platform: acct.account_platform,
        account_type: acct.account_type,
        expected_revenue_model: acct.expected_revenue_model,
        expected_revenue_amount: acct.expected_revenue_amount ? Number(acct.expected_revenue_amount) : null,
        revenue_currency: acct.revenue_currency,
      })
      if (!res.ok) {
        setError(res.error ?? 'Opslaan mislukt')
        return
      }
      setSaved(true)
      router.refresh()
      setTimeout(() => setSaved(false), 2500)
    })
  }

  return (
    <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-5 space-y-4">
      <p className="text-[10px] text-white/35 uppercase tracking-wide">Build bijwerken</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-[11px] text-white/50 mb-1">Status</label>
          <select
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value })}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-white/30 transition-colors"
          >
            {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-[11px] text-white/50 mb-1">Voortgang — {form.progress_pct}%</label>
          <input
            type="range" min={0} max={100} step={5}
            value={form.progress_pct}
            onChange={(e) => setForm({ ...form, progress_pct: Number(e.target.value) })}
            className="w-full mt-2.5 accent-current"
            style={{ color: companyColor }}
          />
        </div>
      </div>

      <div>
        <label className="block text-[11px] text-white/50 mb-1">Huidige milestone</label>
        <input
          value={form.current_milestone}
          onChange={(e) => setForm({ ...form, current_milestone: e.target.value })}
          placeholder="bijv. M3 — API integratie"
          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-white/30 transition-colors"
        />
      </div>

      <div>
        <label className="block text-[11px] text-white/50 mb-1">Taak­omschrijving</label>
        <textarea
          rows={5}
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          placeholder="Wat moet er nog gebeuren om deze build af te ronden…"
          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-white/30 transition-colors resize-none leading-relaxed"
        />
      </div>

      {/* Account Setup config */}
      <div className="pt-2 border-t border-white/[0.06] space-y-3">
        <label className="flex items-center gap-2 text-[11px] text-white/60 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={acct.requires_account_setup}
            onChange={(e) => setAcct({ ...acct, requires_account_setup: e.target.checked })}
            className="accent-current"
            style={{ color: companyColor }}
          />
          <KeyRound size={12} /> Deze taak vereist een account-/affiliate-registratie
        </label>

        {acct.requires_account_setup && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] text-white/50 mb-1">Platform</label>
              <input
                value={acct.account_platform}
                onChange={(e) => setAcct({ ...acct, account_platform: e.target.value })}
                placeholder="bijv. Amazon Partners, LinkedIn, Bol Partner"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-white/30 transition-colors"
              />
            </div>
            <div>
              <label className="block text-[11px] text-white/50 mb-1">Accounttype</label>
              <select
                value={acct.account_type}
                onChange={(e) => setAcct({ ...acct, account_type: e.target.value })}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-white/30 transition-colors"
              >
                <option value="">— kies —</option>
                {ACCOUNT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] text-white/50 mb-1">Verwacht verdienmodel</label>
              <select
                value={acct.expected_revenue_model}
                onChange={(e) => setAcct({ ...acct, expected_revenue_model: e.target.value })}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-white/30 transition-colors"
              >
                <option value="">— kies —</option>
                {REVENUE_MODELS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="block text-[11px] text-white/50 mb-1">Verwacht bedrag</label>
                <input
                  type="number"
                  value={acct.expected_revenue_amount}
                  onChange={(e) => setAcct({ ...acct, expected_revenue_amount: e.target.value })}
                  placeholder="0"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-white/30 transition-colors"
                />
              </div>
              <div className="w-24">
                <label className="block text-[11px] text-white/50 mb-1">Valuta</label>
                <select
                  value={acct.revenue_currency}
                  onChange={(e) => setAcct({ ...acct, revenue_currency: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-white/30 transition-colors"
                >
                  {REVENUE_CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 text-[11px] text-red-400">
          <AlertTriangle size={12} /> {error}
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          onClick={save}
          disabled={pending}
          className="inline-flex items-center gap-1.5 bg-white/[0.08] hover:bg-white/[0.14] disabled:opacity-50 border border-white/10 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          {pending ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
          Opslaan
        </button>
        {saved && (
          <span className="flex items-center gap-1 text-[11px] text-emerald-400">
            <Check size={12} /> Opgeslagen
          </span>
        )}
      </div>
    </div>
  )
}
