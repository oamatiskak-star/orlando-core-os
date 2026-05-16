'use client'

import { useState } from 'react'
import { Filter, Plus, ToggleLeft, ToggleRight, Trash2, Shield, ChevronDown, ChevronUp } from 'lucide-react'

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
  agent_type: string | null
}

type Account = { id: string; email: string; display_name: string | null }

const CATEGORIES = ['factuur', 'incasso', 'advocaat', 'belasting', 'support', 'leverancier', 'intern', 'overig']
const PRIORITIES = ['urgent', 'high', 'normal', 'low']
const COMPANIES = ['STRKBEHEER', 'STRKBOUW', 'BOUWPROFFS', 'MODIWERIJO', 'INTELLIGENCE', 'YOUTUBE', 'PRIVÉ']
const AGENT_TYPES = ['legal', 'classifier', 'reply', 'invoice', 'attachment']

export default function MailRulesDashboardClient({
  initialRules,
  accounts,
}: {
  initialRules: Rule[]
  accounts: Account[]
}) {
  const [rules, setRules] = useState(initialRules)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [saving, setSaving] = useState<string | null>(null)
  const [showNew, setShowNew] = useState(false)
  const [filter, setFilter] = useState<'all' | 'legal' | 'domain' | 'subject'>('all')

  const [newRule, setNewRule] = useState<Omit<Rule, 'id'>>({
    name: '', enabled: true, priority: 80,
    match_from_domain: '', match_from_email: '', match_subject_contains: '', match_to_account: '',
    set_company: null, set_category: null, set_priority: 'normal',
    set_is_invoice: false, set_is_legal_notice: false, agent_type: null,
  })

  const filtered = rules.filter(r => {
    if (filter === 'legal') return r.agent_type === 'legal'
    if (filter === 'domain') return r.match_from_domain != null
    if (filter === 'subject') return r.match_subject_contains != null
    return true
  })

  async function toggleRule(id: string, enabled: boolean) {
    setSaving(id)
    try {
      await fetch(`/api/mail/mapping/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      })
      setRules(r => r.map(rule => rule.id === id ? { ...rule, enabled } : rule))
    } finally { setSaving(null) }
  }

  async function deleteRule(id: string) {
    if (!confirm('Verwijder deze routing rule?')) return
    await fetch(`/api/mail/mapping/${id}`, { method: 'DELETE' })
    setRules(r => r.filter(rule => rule.id !== id))
  }

  async function createRule() {
    const res = await fetch('/api/mail/mapping', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...newRule,
        match_from_domain: newRule.match_from_domain || null,
        match_from_email: newRule.match_from_email || null,
        match_subject_contains: newRule.match_subject_contains || null,
        match_to_account: newRule.match_to_account || null,
      }),
    })
    if (res.ok) {
      const data = await res.json()
      setRules(r => [data, ...r])
      setShowNew(false)
    }
  }

  const legalCount = rules.filter(r => r.agent_type === 'legal' && r.enabled).length
  const domainCount = rules.filter(r => r.match_from_domain && r.enabled).length

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
          <Filter size={16} className="text-indigo-400" />
        </div>
        <div>
          <h1 className="text-base font-semibold text-white">Routing Rules</h1>
          <p className="text-xs text-white/50">{rules.filter(r => r.enabled).length} actief — {legalCount} juridisch — {domainCount} domein</p>
        </div>
        <button onClick={() => setShowNew(s => !s)}
          className="ml-auto flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600/20 border border-indigo-500/30 rounded-lg text-[11px] text-indigo-300 hover:bg-indigo-600/30 transition-colors">
          <Plus size={12} /> Nieuwe Regel
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1">
        {([['all', 'Alle'], ['legal', 'Juridisch'], ['domain', 'Domein'], ['subject', 'Subject']] as const).map(([id, label]) => (
          <button key={id} onClick={() => setFilter(id)}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-medium transition-colors ${filter === id ? 'bg-indigo-600 text-white' : 'bg-white/[0.05] text-white/40 hover:text-white/60'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* Nieuwe regel form */}
      {showNew && (
        <div className="bg-white/[0.04] border border-indigo-500/20 rounded-xl p-4 space-y-3">
          <p className="text-[12px] font-medium text-indigo-300">Nieuwe Routing Rule</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-white/40 block mb-1">Naam</label>
              <input value={newRule.name} onChange={e => setNewRule(n => ({ ...n, name: e.target.value }))}
                className="w-full bg-white/[0.05] border border-white/[0.08] rounded-lg px-3 py-2 text-[12px] text-white outline-none focus:border-indigo-500/50"
                placeholder="bijv. Mijn advocaat" />
            </div>
            <div>
              <label className="text-[10px] text-white/40 block mb-1">Prioriteit</label>
              <input type="number" value={newRule.priority} onChange={e => setNewRule(n => ({ ...n, priority: Number(e.target.value) }))}
                className="w-full bg-white/[0.05] border border-white/[0.08] rounded-lg px-3 py-2 text-[12px] text-white outline-none focus:border-indigo-500/50" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-white/40 block mb-1">Match domein</label>
              <input value={newRule.match_from_domain ?? ''} onChange={e => setNewRule(n => ({ ...n, match_from_domain: e.target.value }))}
                className="w-full bg-white/[0.05] border border-white/[0.08] rounded-lg px-3 py-2 text-[12px] text-white outline-none focus:border-indigo-500/50 font-mono"
                placeholder="bijv. advocaten.nl" />
            </div>
            <div>
              <label className="text-[10px] text-white/40 block mb-1">Match subject bevat</label>
              <input value={newRule.match_subject_contains ?? ''} onChange={e => setNewRule(n => ({ ...n, match_subject_contains: e.target.value }))}
                className="w-full bg-white/[0.05] border border-white/[0.08] rounded-lg px-3 py-2 text-[12px] text-white outline-none focus:border-indigo-500/50"
                placeholder="bijv. dagvaarding" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-[10px] text-white/40 block mb-1">Agent Type</label>
              <select value={newRule.agent_type ?? ''} onChange={e => setNewRule(n => ({ ...n, agent_type: e.target.value || null }))}
                className="w-full bg-white/[0.05] border border-white/[0.08] rounded-lg px-3 py-2 text-[12px] text-white outline-none focus:border-indigo-500/50">
                <option value="">Geen</option>
                {AGENT_TYPES.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-white/40 block mb-1">Categorie</label>
              <select value={newRule.set_category ?? ''} onChange={e => setNewRule(n => ({ ...n, set_category: e.target.value || null }))}
                className="w-full bg-white/[0.05] border border-white/[0.08] rounded-lg px-3 py-2 text-[12px] text-white outline-none focus:border-indigo-500/50">
                <option value="">Geen</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-white/40 block mb-1">Prioriteit instellen</label>
              <select value={newRule.set_priority ?? ''} onChange={e => setNewRule(n => ({ ...n, set_priority: e.target.value || null }))}
                className="w-full bg-white/[0.05] border border-white/[0.08] rounded-lg px-3 py-2 text-[12px] text-white outline-none focus:border-indigo-500/50">
                {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowNew(false)} className="px-3 py-1.5 text-[11px] text-white/40 hover:text-white/60">Annuleer</button>
            <button onClick={createRule} disabled={!newRule.name}
              className="px-4 py-1.5 bg-indigo-600 rounded-lg text-[11px] text-white font-medium hover:bg-indigo-700 disabled:opacity-40">
              Aanmaken
            </button>
          </div>
        </div>
      )}

      {/* Rules tabel */}
      <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl overflow-hidden">
        <div className="grid grid-cols-[1fr_1fr_1fr_80px_80px_80px] gap-0 border-b border-white/[0.05] px-4 py-2">
          {['Naam / Match', 'Domein / Subject', 'Agent · Categorie', 'Prio', 'Status', ''].map((h, i) => (
            <p key={i} className="text-[10px] text-white/30 font-medium uppercase tracking-wide">{h}</p>
          ))}
        </div>
        <div>
          {filtered.map(rule => (
            <div key={rule.id} className={`grid grid-cols-[1fr_1fr_1fr_80px_80px_80px] gap-0 px-4 py-3 border-b border-white/[0.03] last:border-0 transition-opacity ${rule.enabled ? '' : 'opacity-40'}`}>
              <div className="min-w-0 pr-3">
                <p className="text-[12px] text-white/80 truncate">{rule.name}</p>
                {rule.match_from_email && <p className="text-[10px] text-white/30 font-mono truncate">{rule.match_from_email}</p>}
              </div>
              <div className="min-w-0 pr-3">
                {rule.match_from_domain && <p className="text-[11px] text-indigo-300/70 font-mono truncate">{rule.match_from_domain}</p>}
                {rule.match_subject_contains && <p className="text-[11px] text-amber-300/70 truncate">"{rule.match_subject_contains}"</p>}
                {!rule.match_from_domain && !rule.match_subject_contains && <p className="text-[10px] text-white/20">—</p>}
              </div>
              <div className="min-w-0 pr-3">
                <div className="flex flex-wrap gap-1">
                  {rule.agent_type && (
                    <span className={`text-[9px] px-1.5 py-0.5 rounded border font-mono ${rule.agent_type === 'legal' ? 'text-amber-400 bg-amber-500/10 border-amber-500/20' : 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20'}`}>
                      {rule.agent_type}
                    </span>
                  )}
                  {rule.set_category && <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/[0.05] border border-white/[0.06] text-white/40">{rule.set_category}</span>}
                  {rule.set_is_legal_notice && <Shield size={10} className="text-amber-400 mt-0.5" />}
                </div>
              </div>
              <div>
                <span className="text-[11px] text-white/40">{rule.priority}</span>
                {rule.set_priority && <p className="text-[9px] text-white/25">{rule.set_priority}</p>}
              </div>
              <div>
                <button onClick={() => toggleRule(rule.id, !rule.enabled)} disabled={saving === rule.id}
                  className="text-white/25 hover:text-white/60 transition-colors">
                  {rule.enabled ? <ToggleRight size={18} className="text-emerald-400" /> : <ToggleLeft size={18} />}
                </button>
              </div>
              <div>
                <button onClick={() => deleteRule(rule.id)}
                  className="text-white/15 hover:text-red-400 transition-colors p-1">
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
