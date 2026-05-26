'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Sparkles, Save, Check, AlertTriangle, Loader2, Building2, FileText,
  ClipboardList, Files, KeyRound, Coins, Plus, Trash2, RefreshCw, Copy, Wand2,
} from 'lucide-react'
import {
  BUSINESS_FIELDS, ACCOUNT_STATUSES, ACCOUNT_TYPES, REVENUE_MODELS, REVENUE_CURRENCIES,
  PAYOUT_FREQUENCIES, PAYOUT_STATUSES, PLACEHOLDER,
  computeMissingFields, generateApplicationTexts, buildRequiredDocuments, buildChecklist,
  accountStatusBadge, fmtMoney,
  type BusinessProfile, type TaskContext,
} from '@/lib/account-setup'
import {
  prepareAccountSetup, updateAccountSetup, setAccountStatus,
  updateBusinessProfile, addRevenue, deleteRevenue,
} from '../../../accounts/actions'
import type { AccountSetupRow, RevenueRow } from './page'

type TaskProp = {
  id: string
  name: string
  description: string | null
  milestone: string | null
  companyId: string | null
  companyName: string
  platform: string | null
  accountType: string | null
  revenueModel: string | null
  revenueAmount: number | null
  revenueCurrency: string | null
  accountStatus: string
  requiresAccountSetup: boolean
}

type Props = {
  task: TaskProp
  profile: BusinessProfile | null
  setup: AccountSetupRow | null
  revenues: RevenueRow[]
  companyColor: string
}

const CARD = 'bg-white/[0.04] border border-white/[0.06] rounded-xl p-5'
const LABEL = 'block text-[11px] text-white/50 mb-1'
const INPUT = 'w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-white/30 transition-colors'

export default function AccountSetupAgent({ task, profile, setup, revenues, companyColor }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const flash = (ok: boolean, text: string) => {
    setMsg({ ok, text })
    setTimeout(() => setMsg(null), 3000)
  }
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, okText: string) =>
    startTransition(async () => {
      const res = await fn()
      if (!res.ok) flash(false, res.error ?? 'Mislukt')
      else { flash(true, okText); router.refresh() }
    })

  // ── Centrale bedrijfsgegevens (live bewerkbaar) ─────────────────────────
  const [prof, setProf] = useState<BusinessProfile>(() => ({ ...(profile ?? {}) }))

  const ctx: TaskContext = useMemo(() => ({
    taskName: task.name,
    taskDescription: task.description,
    milestone: task.milestone,
    platformName: setup?.platform_name ?? task.platform,
    accountType: setup?.account_type ?? task.accountType,
    revenueModel: task.revenueModel,
  }), [task, setup])

  const missing = useMemo(() => computeMissingFields(prof), [prof])
  const texts = useMemo(() => generateApplicationTexts(prof, ctx), [prof, ctx])
  const docs = useMemo(() => buildRequiredDocuments(ctx.accountType), [ctx])
  const checklist = useMemo(() => buildChecklist(ctx, missing), [ctx, missing])

  const badge = accountStatusBadge(task.accountStatus)

  // ── Setup registratievelden ─────────────────────────────────────────────
  const [reg, setReg] = useState({
    platform_name: setup?.platform_name ?? task.platform ?? '',
    platform_url: setup?.platform_url ?? '',
    account_type: setup?.account_type ?? task.accountType ?? '',
    login_email: setup?.login_email ?? '',
    setup_notes: setup?.setup_notes ?? '',
    generated_application_text: setup?.generated_application_text ?? texts.affiliate_application,
  })
  const [statusSel, setStatusSel] = useState(setup?.status ?? task.accountStatus)

  function copy(text: string) {
    navigator.clipboard?.writeText(text).then(() => flash(true, 'Gekopieerd'))
  }

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      {msg && (
        <div className={`flex items-center gap-2 text-[11px] px-3 py-2 rounded-lg border ${msg.ok ? 'text-emerald-300 border-emerald-400/30 bg-emerald-500/10' : 'text-red-300 border-red-400/30 bg-red-500/10'}`}>
          {msg.ok ? <Check size={12} /> : <AlertTriangle size={12} />} {msg.text}
        </div>
      )}

      {/* Status + voorbereiden */}
      <div className={CARD + ' space-y-4'}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-semibold px-2 py-1 rounded ${badge.color}`}>{badge.label}</span>
            <span className="text-[10px] text-white/40">{setup ? 'Account-setup aangemaakt' : 'Nog niet voorbereid'}</span>
          </div>
          <button
            onClick={() => run(() => prepareAccountSetup(task.id), setup ? 'Opnieuw voorbereid' : 'Voorbereid — status: voorbereiden')}
            disabled={pending}
            className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg border transition-colors disabled:opacity-50"
            style={{ backgroundColor: `${companyColor}1a`, borderColor: `${companyColor}55`, color: companyColor }}
          >
            {pending ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
            {setup ? 'Opnieuw voorbereiden' : 'Maak account aan'}
          </button>
        </div>

        {setup && (
          <div className="flex items-end gap-2 pt-1 border-t border-white/[0.06]">
            <div className="flex-1">
              <label className={LABEL}>Status bijwerken</label>
              <select value={statusSel} onChange={(e) => setStatusSel(e.target.value)} className={INPUT}>
                {ACCOUNT_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <button
              onClick={() => run(() => setAccountStatus(setup.id, statusSel), 'Status bijgewerkt')}
              disabled={pending || statusSel === task.accountStatus}
              className="inline-flex items-center gap-1.5 bg-white/[0.08] hover:bg-white/[0.14] disabled:opacity-40 border border-white/10 text-white text-sm font-medium px-3 py-2 rounded-lg transition-colors"
            >
              <Save size={13} /> Bijwerken
            </button>
          </div>
        )}
      </div>

      {/* Taakgegevens */}
      <div className={CARD}>
        <p className="text-[10px] text-white/35 uppercase tracking-wide mb-3 flex items-center gap-1.5"><FileText size={11} /> Taakgegevens (Build Tracker)</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-[11px]">
          <Field label="Milestone" value={task.milestone || PLACEHOLDER} />
          <Field label="Platform" value={task.platform || PLACEHOLDER} />
          <Field label="Accounttype" value={task.accountType || PLACEHOLDER} />
          <Field label="Verdienmodel" value={task.revenueModel || PLACEHOLDER} />
          <Field label="Verwacht bedrag" value={task.revenueAmount != null ? fmtMoney(task.revenueAmount, task.revenueCurrency || 'EUR') : PLACEHOLDER} />
          <Field label="Bedrijf" value={task.companyName} />
        </div>
      </div>

      {/* Centrale bedrijfsgegevens */}
      <div className={CARD + ' space-y-4'}>
        <div className="flex items-center justify-between">
          <p className="text-[10px] text-white/35 uppercase tracking-wide flex items-center gap-1.5"><Building2 size={11} /> Centrale bedrijfsgegevens</p>
          {missing.length > 0
            ? <span className="text-[10px] text-amber-400">{missing.length} verplicht veld(en) ontbreken</span>
            : <span className="text-[10px] text-emerald-400">Compleet</span>}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {BUSINESS_FIELDS.map((f) => {
            const isMissing = f.required && !((prof[f.key] ?? '').toString().trim())
            return (
              <div key={f.key}>
                <label className={LABEL}>
                  {f.label}{f.required && <span className="text-amber-400/70"> *</span>}
                </label>
                <input
                  value={(prof[f.key] ?? '') as string}
                  onChange={(e) => setProf({ ...prof, [f.key]: e.target.value })}
                  placeholder={isMissing ? PLACEHOLDER : ''}
                  className={INPUT + (isMissing ? ' border-amber-400/40 placeholder-amber-400/50' : '')}
                />
              </div>
            )
          })}
        </div>
        <button
          onClick={() => run(() => updateBusinessProfile(task.companyId ?? '', prof), 'Bedrijfsgegevens opgeslagen')}
          disabled={pending || !task.companyId}
          className="inline-flex items-center gap-1.5 bg-white/[0.08] hover:bg-white/[0.14] disabled:opacity-50 border border-white/10 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          {pending ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Bedrijfsgegevens opslaan
        </button>
        {!task.companyId && <p className="text-[10px] text-white/40">Taak is niet aan een bedrijf gekoppeld — gegevens kunnen niet centraal worden opgeslagen.</p>}
      </div>

      {/* Ontbrekende gegevens */}
      {missing.length > 0 && (
        <div className={CARD}>
          <p className="text-[10px] text-white/35 uppercase tracking-wide mb-3 flex items-center gap-1.5"><AlertTriangle size={11} className="text-amber-400" /> Ontbrekende gegevens</p>
          <div className="flex flex-wrap gap-2">
            {missing.map((m) => (
              <span key={m} className="text-[11px] px-2 py-1 rounded-md bg-amber-500/10 border border-amber-400/25 text-amber-200">
                {m}: <span className="font-mono text-amber-300/80">{PLACEHOLDER}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Gegenereerde teksten */}
      <div className={CARD + ' space-y-4'}>
        <p className="text-[10px] text-white/35 uppercase tracking-wide flex items-center gap-1.5"><Wand2 size={11} /> Gegenereerde teksten</p>

        <GenBlock label="Bedrijfsomschrijving" value={texts.business_description} onCopy={copy} />
        <GenBlock label="LinkedIn / About" value={texts.linkedin_about} onCopy={copy} />
        <GenBlock label="CTA" value={texts.cta} onCopy={copy} />

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className={LABEL + ' mb-0'}>Affiliate-/aanvraagtekst (bewerkbaar)</label>
            <div className="flex gap-2">
              <button onClick={() => setReg({ ...reg, generated_application_text: texts.affiliate_application })}
                className="inline-flex items-center gap-1 text-[10px] text-white/50 hover:text-white/80">
                <RefreshCw size={10} /> Genereer opnieuw
              </button>
              <button onClick={() => copy(reg.generated_application_text)}
                className="inline-flex items-center gap-1 text-[10px] text-white/50 hover:text-white/80">
                <Copy size={10} /> Kopieer
              </button>
            </div>
          </div>
          <textarea
            rows={9}
            value={reg.generated_application_text}
            onChange={(e) => setReg({ ...reg, generated_application_text: e.target.value })}
            className={INPUT + ' resize-none leading-relaxed font-mono text-[12px]'}
          />
        </div>
      </div>

      {/* Registratievelden */}
      <div className={CARD + ' space-y-4'}>
        <p className="text-[10px] text-white/35 uppercase tracking-wide flex items-center gap-1.5"><KeyRound size={11} /> Registratievelden voorbereiden</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={LABEL}>Platformnaam</label>
            <input value={reg.platform_name} onChange={(e) => setReg({ ...reg, platform_name: e.target.value })} placeholder={PLACEHOLDER} className={INPUT} />
          </div>
          <div>
            <label className={LABEL}>Platform-URL</label>
            <input value={reg.platform_url} onChange={(e) => setReg({ ...reg, platform_url: e.target.value })} placeholder={PLACEHOLDER} className={INPUT} />
          </div>
          <div>
            <label className={LABEL}>Accounttype</label>
            <select value={reg.account_type} onChange={(e) => setReg({ ...reg, account_type: e.target.value })} className={INPUT}>
              <option value="">{PLACEHOLDER}</option>
              {ACCOUNT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className={LABEL}>Login e-mail</label>
            <input value={reg.login_email} onChange={(e) => setReg({ ...reg, login_email: e.target.value })} placeholder={PLACEHOLDER} className={INPUT} />
          </div>
        </div>
        <div>
          <label className={LABEL}>Notities</label>
          <textarea rows={3} value={reg.setup_notes} onChange={(e) => setReg({ ...reg, setup_notes: e.target.value })} placeholder={PLACEHOLDER} className={INPUT + ' resize-none'} />
        </div>
        <button
          onClick={() => {
            if (!setup) { flash(false, 'Klik eerst op "Maak account aan" om voor te bereiden'); return }
            run(() => updateAccountSetup({ id: setup.id, ...reg }), 'Registratievelden opgeslagen')
          }}
          disabled={pending}
          className="inline-flex items-center gap-1.5 bg-white/[0.08] hover:bg-white/[0.14] disabled:opacity-50 border border-white/10 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          {pending ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Registratievelden opslaan
        </button>
      </div>

      {/* Benodigde documenten + checklist */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className={CARD}>
          <p className="text-[10px] text-white/35 uppercase tracking-wide mb-3 flex items-center gap-1.5"><Files size={11} /> Benodigde documenten</p>
          <ul className="space-y-1.5">
            {docs.map((d) => (
              <li key={d} className="text-[12px] text-white/70 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-white/30" /> {d}
              </li>
            ))}
          </ul>
        </div>
        <div className={CARD}>
          <p className="text-[10px] text-white/35 uppercase tracking-wide mb-3 flex items-center gap-1.5"><ClipboardList size={11} /> Registratie-checklist</p>
          <ul className="space-y-1.5">
            {checklist.map((c, i) => (
              <li key={i} className="text-[12px] flex items-start gap-2">
                <Check size={13} className={c.ready ? 'text-emerald-400 shrink-0 mt-0.5' : 'text-white/20 shrink-0 mt-0.5'} />
                <span className={c.ready ? 'text-white/70' : 'text-white/50'}>
                  {c.label}
                  {c.note && <span className="block text-[10px] text-amber-400/70">{c.note}</span>}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Verdiensten */}
      <RevenuePanel setupId={setup?.id ?? null} revenues={revenues} pending={pending} run={run} defaults={{
        revenue_type: task.revenueModel,
        currency: task.revenueCurrency || 'EUR',
        expected_amount: task.revenueAmount,
      }} />
    </div>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-white/35 mb-0.5">{label}</p>
      <p className="text-white/80">{value}</p>
    </div>
  )
}

function GenBlock({ label, value, onCopy }: { label: string; value: string; onCopy: (t: string) => void }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className={LABEL + ' mb-0'}>{label}</span>
        <button onClick={() => onCopy(value)} className="inline-flex items-center gap-1 text-[10px] text-white/50 hover:text-white/80">
          <Copy size={10} /> Kopieer
        </button>
      </div>
      <p className="text-[12px] text-white/70 bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-2 whitespace-pre-wrap leading-relaxed">{value}</p>
    </div>
  )
}

type RunFn = (fn: () => Promise<{ ok: boolean; error?: string }>, okText: string) => void

function RevenuePanel({
  setupId, revenues, pending, run, defaults,
}: {
  setupId: string | null
  revenues: RevenueRow[]
  pending: boolean
  run: RunFn
  defaults: { revenue_type: string | null; currency: string; expected_amount: number | null }
}) {
  const [form, setForm] = useState({
    revenue_type: defaults.revenue_type ?? '',
    expected_amount: defaults.expected_amount != null ? String(defaults.expected_amount) : '',
    actual_amount: '',
    currency: defaults.currency,
    commission_percentage: '',
    payout_frequency: 'maandelijks',
    payout_status: 'geen',
    notes: '',
  })

  return (
    <div className={CARD + ' space-y-4'}>
      <p className="text-[10px] text-white/35 uppercase tracking-wide flex items-center gap-1.5"><Coins size={11} /> Verdiensten</p>

      {revenues.length > 0 && (
        <div className="space-y-2">
          {revenues.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-3 bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-2">
              <div className="min-w-0">
                <p className="text-[12px] text-white/80 truncate">{r.revenue_type || PLACEHOLDER}</p>
                <p className="text-[10px] text-white/45">
                  verwacht {fmtMoney(r.expected_amount, r.currency)} · werkelijk {fmtMoney(r.actual_amount, r.currency)}
                  {r.payout_frequency ? ` · ${r.payout_frequency}` : ''} · {r.payout_status || 'geen'}
                </p>
              </div>
              <button onClick={() => run(() => deleteRevenue(r.id), 'Verdienste verwijderd')} disabled={pending} className="text-white/30 hover:text-red-400 transition-colors shrink-0">
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div>
          <label className={LABEL}>Verdienmodel</label>
          <select value={form.revenue_type} onChange={(e) => setForm({ ...form, revenue_type: e.target.value })} className={INPUT}>
            <option value="">{PLACEHOLDER}</option>
            {REVENUE_MODELS.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <div>
          <label className={LABEL}>Verwacht bedrag</label>
          <input type="number" value={form.expected_amount} onChange={(e) => setForm({ ...form, expected_amount: e.target.value })} className={INPUT} />
        </div>
        <div>
          <label className={LABEL}>Werkelijk bedrag</label>
          <input type="number" value={form.actual_amount} onChange={(e) => setForm({ ...form, actual_amount: e.target.value })} className={INPUT} />
        </div>
        <div>
          <label className={LABEL}>Valuta</label>
          <select value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} className={INPUT}>
            {REVENUE_CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className={LABEL}>Commissie %</label>
          <input type="number" value={form.commission_percentage} onChange={(e) => setForm({ ...form, commission_percentage: e.target.value })} className={INPUT} />
        </div>
        <div>
          <label className={LABEL}>Uitbetaalfrequentie</label>
          <select value={form.payout_frequency} onChange={(e) => setForm({ ...form, payout_frequency: e.target.value })} className={INPUT}>
            {PAYOUT_FREQUENCIES.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>
        <div>
          <label className={LABEL}>Payout-status</label>
          <select value={form.payout_status} onChange={(e) => setForm({ ...form, payout_status: e.target.value })} className={INPUT}>
            {PAYOUT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="col-span-2 sm:col-span-3">
          <label className={LABEL}>Notitie</label>
          <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder={PLACEHOLDER} className={INPUT} />
        </div>
      </div>

      <button
        onClick={() => {
          if (!setupId) return
          run(() => addRevenue({
            account_setup_id: setupId,
            revenue_type: form.revenue_type || null,
            expected_amount: form.expected_amount ? Number(form.expected_amount) : null,
            actual_amount: form.actual_amount ? Number(form.actual_amount) : null,
            currency: form.currency,
            commission_percentage: form.commission_percentage ? Number(form.commission_percentage) : null,
            payout_frequency: form.payout_frequency,
            payout_status: form.payout_status,
            notes: form.notes || null,
          }), 'Verdienste toegevoegd')
        }}
        disabled={pending || !setupId}
        className="inline-flex items-center gap-1.5 bg-white/[0.08] hover:bg-white/[0.14] disabled:opacity-50 border border-white/10 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
      >
        {pending ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} Verdienste toevoegen
      </button>
      {!setupId && <p className="text-[10px] text-white/40">Bereid eerst het account voor om verdiensten vast te leggen.</p>}
    </div>
  )
}
