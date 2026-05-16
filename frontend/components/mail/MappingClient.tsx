'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Plus, Trash2, ToggleLeft, ToggleRight, ChevronDown, ChevronUp } from 'lucide-react'

const COMPANIES = ['STRKBEHEER', 'STRKBOUW', 'BOUWPROFFS', 'MODIWERIJO', 'INTELLIGENCE', 'YOUTUBE', 'PRIVÉ']
const CATEGORIES = ['leverancier', 'klant', 'incasso', 'factuur', 'belasting', 'advocaat', 'privé', 'vastgoed', 'support', 'automatisering', 'spam']
const PRIORITIES = ['urgent', 'high', 'normal', 'low', 'spam']

type Rule = {
  id: string
  name: string
  enabled: boolean
  priority: number
  match_from_domain: string | null
  match_from_email: string | null
  match_subject_contains: string | null
  match_to_account: string | null
  set_company: string | null
  set_category: string | null
  set_priority: string | null
  set_is_invoice: boolean | null
  set_is_legal_notice: boolean | null
}

type AccountMapping = {
  account_id: string
  company: string
  default_category: string
  mail_accounts: { email: string; display_name: string | null } | null
}

const COMPANY_COLOR: Record<string, string> = {
  STRKBOUW:     'bg-blue-500/15 text-blue-400',
  STRKBEHEER:   'bg-purple-500/15 text-purple-400',
  BOUWPROFFS:   'bg-amber-500/15 text-amber-400',
  MODIWERIJO:   'bg-emerald-500/15 text-emerald-400',
  INTELLIGENCE: 'bg-teal-500/15 text-teal-400',
  YOUTUBE:      'bg-red-500/15 text-red-400',
  PRIVÉ:        'bg-white/[0.06] text-white/40',
}

const PRIORITY_COLOR: Record<string, string> = {
  urgent: 'text-red-400',
  high:   'text-orange-400',
  normal: 'text-white/50',
  low:    'text-white/30',
  spam:   'text-pink-400',
}

const EMPTY_FORM = {
  name: '',
  priority: 50,
  match_from_domain: '',
  match_from_email: '',
  match_subject_contains: '',
  match_to_account: '',
  set_company: '',
  set_category: '',
  set_priority: '',
  set_is_invoice: '',
  set_is_legal_notice: '',
}

function RuleCard({ rule, onToggle, onDelete }: {
  rule: Rule
  onToggle: (id: string, enabled: boolean) => void
  onDelete: (id: string) => void
}) {
  const [expanded, setExpanded] = useState(false)

  const matchParts = [
    rule.match_from_domain    && `domein: ${rule.match_from_domain}`,
    rule.match_from_email     && `email: ${rule.match_from_email}`,
    rule.match_subject_contains && `onderwerp: "${rule.match_subject_contains}"`,
    rule.match_to_account     && `account: ${rule.match_to_account}`,
  ].filter(Boolean)

  const setParts = [
    rule.set_company   && `→ ${rule.set_company}`,
    rule.set_category  && `cat: ${rule.set_category}`,
    rule.set_priority  && `prio: ${rule.set_priority}`,
    rule.set_is_invoice && `factuur`,
    rule.set_is_legal_notice && `juridisch`,
  ].filter(Boolean)

  return (
    <div className={`bg-[#0d0d1a] border rounded-2xl overflow-hidden mb-2 mx-4 transition-colors ${rule.enabled ? 'border-white/[0.08]' : 'border-white/[0.04] opacity-50'}`}>
      <div className="flex items-center gap-3 p-3">
        <button
          onClick={() => onToggle(rule.id, !rule.enabled)}
          className="flex-shrink-0 text-white/40 hover:text-white/70 transition-colors"
        >
          {rule.enabled
            ? <ToggleRight size={20} className="text-indigo-400" />
            : <ToggleLeft size={20} />
          }
        </button>

        <button
          onClick={() => setExpanded(e => !e)}
          className="flex-1 text-left min-w-0"
        >
          <div className="flex items-center gap-2">
            <p className="text-[13px] font-semibold text-white truncate">{rule.name}</p>
            <span className="text-[9px] text-white/25 flex-shrink-0">p{rule.priority}</span>
          </div>
          <div className="flex flex-wrap gap-1 mt-1">
            {matchParts.map((m, i) => (
              <span key={i} className="text-[9px] px-1.5 py-0.5 rounded bg-white/[0.06] text-white/40">{m}</span>
            ))}
            {setParts.map((s, i) => (
              <span key={i} className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${rule.set_company ? (COMPANY_COLOR[rule.set_company] ?? 'bg-white/[0.06] text-white/50') : 'bg-indigo-500/15 text-indigo-400'}`}>{s}</span>
            ))}
          </div>
        </button>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setExpanded(e => !e)}
            className="p-1.5 text-white/30 hover:text-white/60 transition-colors"
          >
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          <button
            onClick={() => onDelete(rule.id)}
            className="p-1.5 text-white/20 hover:text-red-400 transition-colors"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-3 border-t border-white/[0.06] pt-2 grid grid-cols-2 gap-x-4 gap-y-1">
          {rule.match_from_domain    && <Row label="Domein"   value={rule.match_from_domain} />}
          {rule.match_from_email     && <Row label="Email"    value={rule.match_from_email} />}
          {rule.match_subject_contains && <Row label="Onderwerp" value={`"${rule.match_subject_contains}"`} />}
          {rule.match_to_account     && <Row label="Account"  value={rule.match_to_account} />}
          {rule.set_company          && <Row label="Bedrijf"  value={rule.set_company} />}
          {rule.set_category         && <Row label="Categorie" value={rule.set_category} />}
          {rule.set_priority         && <Row label="Prioriteit" value={rule.set_priority} className={PRIORITY_COLOR[rule.set_priority]} />}
          {rule.set_is_invoice != null && <Row label="Factuur" value={rule.set_is_invoice ? 'ja' : 'nee'} />}
        </div>
      )}
    </div>
  )
}

function Row({ label, value, className = 'text-white/70' }: { label: string; value: string; className?: string }) {
  return (
    <>
      <span className="text-[10px] text-white/30">{label}</span>
      <span className={`text-[10px] ${className} truncate`}>{value}</span>
    </>
  )
}

export default function MappingClient({
  initialRules,
  accountMappings,
}: {
  initialRules: Rule[]
  accountMappings: AccountMapping[]
}) {
  const router = useRouter()
  const [rules, setRules] = useState<Rule[]>(initialRules)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<'rules' | 'accounts'>('rules')

  function update(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function saveRule() {
    if (!form.name.trim()) return
    setSaving(true)
    try {
      const res = await fetch('/api/mail/mapping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:                   form.name,
          priority:               Number(form.priority),
          match_from_domain:      form.match_from_domain || undefined,
          match_from_email:       form.match_from_email || undefined,
          match_subject_contains: form.match_subject_contains || undefined,
          match_to_account:       form.match_to_account || undefined,
          set_company:            form.set_company || undefined,
          set_category:           form.set_category || undefined,
          set_priority:           form.set_priority || undefined,
          set_is_invoice:         form.set_is_invoice === 'true' ? true : form.set_is_invoice === 'false' ? false : undefined,
        }),
      })
      const data = await res.json() as { rule: Rule }
      if (data.rule) {
        setRules(prev => [data.rule, ...prev].sort((a, b) => b.priority - a.priority))
        setForm(EMPTY_FORM)
        setShowForm(false)
      }
    } finally {
      setSaving(false)
    }
  }

  async function toggleRule(id: string, enabled: boolean) {
    setRules(prev => prev.map(r => r.id === id ? { ...r, enabled } : r))
    await fetch(`/api/mail/mapping/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled }),
    })
  }

  async function deleteRule(id: string) {
    setRules(prev => prev.filter(r => r.id !== id))
    await fetch(`/api/mail/mapping/${id}`, { method: 'DELETE' })
  }

  return (
    <div
      className="max-w-lg mx-auto pb-8"
      style={{ paddingTop: 'calc(1rem + env(safe-area-inset-top))' }}
    >
      {/* Header */}
      <div className="px-4 mb-4">
        <div className="flex items-center gap-3 mb-1">
          <button onClick={() => router.back()} className="p-2 -ml-2 text-white/50 hover:text-white/80 transition-colors">
            <ArrowLeft size={20} />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-white">Mail Mapping</h1>
            <p className="text-[11px] text-white/30">Routing regels & account koppelingen</p>
          </div>
          <button
            onClick={() => setShowForm(s => !s)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-[12px] font-semibold rounded-xl transition-colors"
          >
            <Plus size={14} />
            Regel
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mt-3">
          {(['rules', 'accounts'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-1.5 text-[12px] font-medium rounded-xl transition-colors ${
                activeTab === tab ? 'bg-indigo-600 text-white' : 'bg-white/[0.06] text-white/50'
              }`}
            >
              {tab === 'rules' ? `Regels (${rules.length})` : `Accounts (${accountMappings.length})`}
            </button>
          ))}
        </div>
      </div>

      {/* New rule form */}
      {showForm && (
        <div className="mx-4 mb-4 p-4 bg-[#0d0d1a] border border-indigo-500/30 rounded-2xl space-y-3">
          <p className="text-[11px] text-white/50 uppercase tracking-wider">Nieuwe routing regel</p>

          <Field label="Naam" required>
            <input value={form.name} onChange={e => update('name', e.target.value)}
              placeholder="bijv. Belastingdienst" className={INPUT} />
          </Field>

          <Field label="Prioriteit (hoger = eerder)">
            <input type="number" value={form.priority} onChange={e => update('priority', e.target.value)}
              min={1} max={100} className={INPUT} />
          </Field>

          <p className="text-[10px] text-white/30 uppercase tracking-wider pt-1">Match criteria (min. 1)</p>

          <Field label="Afzender domein">
            <input value={form.match_from_domain} onChange={e => update('match_from_domain', e.target.value)}
              placeholder="belastingdienst.nl" className={INPUT} />
          </Field>

          <Field label="Afzender e-mail">
            <input value={form.match_from_email} onChange={e => update('match_from_email', e.target.value)}
              placeholder="noreply@bedrijf.nl" className={INPUT} />
          </Field>

          <Field label="Onderwerp bevat">
            <input value={form.match_subject_contains} onChange={e => update('match_subject_contains', e.target.value)}
              placeholder="factuur" className={INPUT} />
          </Field>

          <Field label="Ontvangend account">
            <input value={form.match_to_account} onChange={e => update('match_to_account', e.target.value)}
              placeholder="info@strkbouw.nl" className={INPUT} />
          </Field>

          <p className="text-[10px] text-white/30 uppercase tracking-wider pt-1">Overrides (min. 1)</p>

          <Field label="Bedrijf">
            <select value={form.set_company} onChange={e => update('set_company', e.target.value)} className={INPUT}>
              <option value="">— geen —</option>
              {COMPANIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </Field>

          <Field label="Categorie">
            <select value={form.set_category} onChange={e => update('set_category', e.target.value)} className={INPUT}>
              <option value="">— geen —</option>
              {CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </Field>

          <Field label="Prioriteit">
            <select value={form.set_priority} onChange={e => update('set_priority', e.target.value)} className={INPUT}>
              <option value="">— geen —</option>
              {PRIORITIES.map(p => <option key={p}>{p}</option>)}
            </select>
          </Field>

          <Field label="Markeer als factuur">
            <select value={form.set_is_invoice} onChange={e => update('set_is_invoice', e.target.value)} className={INPUT}>
              <option value="">— geen —</option>
              <option value="true">Ja</option>
              <option value="false">Nee</option>
            </select>
          </Field>

          <div className="flex gap-2 pt-1">
            <button onClick={saveRule} disabled={saving || !form.name.trim()}
              className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-[12px] font-semibold rounded-xl transition-colors">
              {saving ? 'Opslaan...' : 'Opslaan'}
            </button>
            <button onClick={() => { setShowForm(false); setForm(EMPTY_FORM) }}
              className="px-4 py-2.5 bg-white/[0.06] text-white/50 text-[12px] rounded-xl hover:bg-white/[0.1] transition-colors">
              Annuleren
            </button>
          </div>
        </div>
      )}

      {/* Rules tab */}
      {activeTab === 'rules' && (
        <div>
          {rules.length === 0 ? (
            <div className="py-16 text-center text-white/25 text-sm">Geen regels</div>
          ) : (
            rules.map(rule => (
              <RuleCard key={rule.id} rule={rule} onToggle={toggleRule} onDelete={deleteRule} />
            ))
          )}
        </div>
      )}

      {/* Accounts tab */}
      {activeTab === 'accounts' && (
        <div className="space-y-2 px-4">
          {accountMappings.map(am => (
            <div key={am.account_id} className="flex items-center justify-between p-3 bg-[#0d0d1a] border border-white/[0.08] rounded-xl">
              <div className="min-w-0 flex-1">
                <p className="text-[12px] text-white/80 truncate">
                  {(am.mail_accounts as { email: string; display_name: string | null } | null)?.email ?? '—'}
                </p>
                <p className="text-[10px] text-white/30 mt-0.5">standaard: {am.default_category}</p>
              </div>
              <span className={`ml-3 flex-shrink-0 text-[10px] font-bold px-2 py-0.5 rounded ${COMPANY_COLOR[am.company] ?? 'bg-white/[0.06] text-white/40'}`}>
                {am.company}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const INPUT = 'w-full bg-[#13131f] border border-white/[0.08] rounded-xl px-3 py-2 text-[12px] text-white/80 outline-none focus:border-indigo-500/40'

function Field({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <div>
      <label className="block text-[10px] text-white/40 mb-1">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )
}
