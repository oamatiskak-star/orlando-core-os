'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Scale, Plus, Search, Filter, ChevronRight, Clock,
  AlertTriangle, Euro, RefreshCw, Building2, X,
} from 'lucide-react'
import type { Dossier, DossierType } from '@/lib/advocaat/types'

const PRIORITY_COLOR: Record<string, string> = {
  kritiek: 'text-red-400 bg-red-500/10 border-red-500/30',
  hoog:    'text-orange-400 bg-orange-500/10 border-orange-500/25',
  medium:  'text-yellow-400 bg-yellow-500/8 border-white/[0.06]',
  laag:    'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
}

const STATUS_COLOR: Record<string, string> = {
  actief:   'text-blue-400 bg-blue-500/10 border-blue-500/20',
  on_hold:  'text-yellow-400 bg-yellow-500/8 border-white/[0.06]',
  gesloten: 'text-white/40 bg-white/[0.04] border-white/[0.08]',
  gewonnen: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  verloren: 'text-red-400 bg-red-500/10 border-red-500/20',
  geschikt: 'text-violet-400 bg-violet-500/10 border-violet-500/20',
}

const DOSSIER_TYPE_LABELS: Record<string, string> = {
  curator: 'Curator', faillissement: 'Faillissement',
  bestuurdersaansprakelijkheid: 'Bestuurdersaansprak.',
  pauliana: 'Pauliana', incasso: 'Incasso',
  contractgeschil: 'Contractgeschil', vastgoedgeschil: 'Vastgoedgeschil',
  arbeidsrecht: 'Arbeidsrecht', aansprakelijkheid: 'Aansprakelijkheid',
  dagvaarding: 'Dagvaarding', overig: 'Overig',
}

function fmt(d: string | null) {
  if (!d) return null
  return new Date(d).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })
}

function daysUntil(d: string | null) {
  if (!d) return null
  return Math.ceil((new Date(d).getTime() - Date.now()) / 86400000)
}

function fmtEur(n: number | null) {
  if (!n) return null
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)
}

const EMPTY_FORM = {
  title: '', description: '', dossier_type: 'overig' as DossierType,
  priority: 'medium', wederpartij: '', wederpartij_email: '',
  advocaat_naam: '', rechtbank: '', zaaknummer: '',
  inzet_bedrag: '', next_deadline: '', next_action: '', tags: '',
}

export default function DossiersPage() {
  const [dossiers, setDossiers] = useState<Dossier[]>([])
  const [loading,  setLoading]  = useState(true)
  const [search,   setSearch]   = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterType,   setFilterType]   = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form,     setForm]     = useState(EMPTY_FORM)
  const [saving,   setSaving]   = useState(false)

  async function load() {
    setLoading(true)
    const params = new URLSearchParams({ limit: '100' })
    if (filterStatus) params.set('status', filterStatus)
    if (filterType)   params.set('type',   filterType)
    const res = await fetch(`/api/advocaat/dossiers?${params}`).then(r => r.json()).catch(() => ({}))
    setDossiers(res.dossiers ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [filterStatus, filterType])

  async function create() {
    setSaving(true)
    const res = await fetch('/api/advocaat/dossiers', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        ...form,
        inzet_bedrag: form.inzet_bedrag ? parseFloat(form.inzet_bedrag) : null,
        tags: form.tags ? form.tags.split(',').map(s => s.trim()) : [],
      }),
    })
    setSaving(false)
    if (res.ok) { setShowForm(false); setForm(EMPTY_FORM); load() }
  }

  const filtered = dossiers.filter(d =>
    !search || d.title.toLowerCase().includes(search.toLowerCase()) ||
    d.wederpartij?.toLowerCase().includes(search.toLowerCase()) ||
    d.zaaknummer?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white p-6 space-y-5">

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-violet-500/10 border border-violet-500/20">
            <Scale className="w-5 h-5 text-violet-400" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-white">Juridische Dossiers</h1>
            <p className="text-xs text-white/40 mt-0.5">{filtered.length} dossiers</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="p-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] transition-all">
            <RefreshCw className={`w-4 h-4 text-white/40 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600 text-white text-xs font-medium hover:bg-violet-500 transition-all">
            <Plus className="w-3.5 h-3.5" /> Nieuw dossier
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Zoeken in dossiers..."
            className="w-full pl-8 pr-3 py-2 rounded-lg bg-white/[0.05] border border-white/[0.08] text-sm text-white placeholder-white/25 focus:outline-none focus:border-violet-500/40"
          />
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="px-3 py-2 rounded-lg bg-white/[0.05] border border-white/[0.08] text-sm text-white focus:outline-none focus:border-violet-500/40">
          <option value="">Alle statussen</option>
          {['actief','on_hold','gesloten','gewonnen','verloren','geschikt'].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={filterType} onChange={e => setFilterType(e.target.value)}
          className="px-3 py-2 rounded-lg bg-white/[0.05] border border-white/[0.08] text-sm text-white focus:outline-none focus:border-violet-500/40">
          <option value="">Alle types</option>
          {Object.entries(DOSSIER_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        {(filterStatus || filterType || search) && (
          <button onClick={() => { setFilterStatus(''); setFilterType(''); setSearch('') }} className="flex items-center gap-1 text-xs text-white/40 hover:text-white transition-all">
            <X className="w-3.5 h-3.5" /> Wis
          </button>
        )}
      </div>

      {/* New dossier form */}
      {showForm && (
        <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-white">Nieuw Juridisch Dossier</span>
            <button onClick={() => setShowForm(false)} className="text-white/30 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-[10px] text-white/40 uppercase tracking-wider">Dossier titel *</label>
              <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                placeholder="Bijv: Curator Bouwproffs NL BV — Verweer bestuurdersaansprakelijkheid"
                className="w-full mt-1 px-3 py-2 rounded-lg bg-white/[0.05] border border-white/[0.08] text-sm text-white placeholder-white/20 focus:outline-none focus:border-violet-500/40"
              />
            </div>
            {[
              { key: 'dossier_type', label: 'Type *', type: 'select', options: Object.entries(DOSSIER_TYPE_LABELS) },
              { key: 'priority',     label: 'Prioriteit *', type: 'select', options: [['kritiek','Kritiek'],['hoog','Hoog'],['medium','Medium'],['laag','Laag']] },
              { key: 'wederpartij',  label: 'Wederpartij',  type: 'text',   placeholder: 'Naam curator / tegenpartij' },
              { key: 'wederpartij_email', label: 'Wederpartij email', type: 'email', placeholder: 'email@wederpartij.nl' },
              { key: 'advocaat_naam', label: 'Eigen advocaat', type: 'text', placeholder: 'Mr. / Mevr. ...' },
              { key: 'rechtbank',    label: 'Rechtbank',    type: 'text',   placeholder: 'Rb. Rotterdam' },
              { key: 'zaaknummer',   label: 'Zaaknummer',   type: 'text',   placeholder: 'C/10/25/123' },
              { key: 'inzet_bedrag', label: 'Inzet (€)',    type: 'number', placeholder: '0' },
              { key: 'next_deadline', label: 'Volgende deadline', type: 'date', placeholder: '' },
            ].map(f => (
              <div key={f.key}>
                <label className="text-[10px] text-white/40 uppercase tracking-wider">{f.label}</label>
                {f.type === 'select' ? (
                  <select value={form[f.key as keyof typeof form] as string} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                    className="w-full mt-1 px-3 py-2 rounded-lg bg-white/[0.05] border border-white/[0.08] text-sm text-white focus:outline-none focus:border-violet-500/40">
                    {f.options?.map(([val, lbl]) => <option key={val} value={val}>{lbl}</option>)}
                  </select>
                ) : (
                  <input type={f.type} value={form[f.key as keyof typeof form] as string}
                    onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                    placeholder={f.placeholder}
                    className="w-full mt-1 px-3 py-2 rounded-lg bg-white/[0.05] border border-white/[0.08] text-sm text-white placeholder-white/20 focus:outline-none focus:border-violet-500/40"
                  />
                )}
              </div>
            ))}
          </div>
          <div>
            <label className="text-[10px] text-white/40 uppercase tracking-wider">Beschrijving</label>
            <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
              rows={3} placeholder="Korte omschrijving van de zaak..."
              className="w-full mt-1 px-3 py-2 rounded-lg bg-white/[0.05] border border-white/[0.08] text-sm text-white placeholder-white/20 focus:outline-none focus:border-violet-500/40 resize-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-white/40 uppercase tracking-wider">Directe actie</label>
              <input value={form.next_action} onChange={e => setForm(p => ({ ...p, next_action: e.target.value }))}
                placeholder="Wat moet er als eerste gebeuren?"
                className="w-full mt-1 px-3 py-2 rounded-lg bg-white/[0.05] border border-white/[0.08] text-sm text-white placeholder-white/20 focus:outline-none focus:border-violet-500/40"
              />
            </div>
            <div>
              <label className="text-[10px] text-white/40 uppercase tracking-wider">Tags (komma-gescheiden)</label>
              <input value={form.tags} onChange={e => setForm(p => ({ ...p, tags: e.target.value }))}
                placeholder="curator, bouwproffs, 2025"
                className="w-full mt-1 px-3 py-2 rounded-lg bg-white/[0.05] border border-white/[0.08] text-sm text-white placeholder-white/20 focus:outline-none focus:border-violet-500/40"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={create} disabled={saving || !form.title} className="px-4 py-2 rounded-lg bg-violet-600 text-white text-xs font-medium hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
              {saving ? 'Opslaan...' : 'Dossier aanmaken'}
            </button>
            <button onClick={() => { setShowForm(false); setForm(EMPTY_FORM) }} className="px-4 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white/60 text-xs hover:text-white transition-all">
              Annuleren
            </button>
          </div>
        </div>
      )}

      {/* Dossier list */}
      {loading ? (
        <div className="flex items-center justify-center h-32 text-white/30 text-sm">Laden...</div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 text-white/20 text-sm gap-2">
          <Scale className="w-10 h-10 opacity-20" />
          {search || filterStatus || filterType ? 'Geen dossiers gevonden met deze filters.' : 'Nog geen dossiers. Maak een nieuw dossier aan of importeer bestanden.'}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(d => {
            const dl = daysUntil(d.next_deadline)
            return (
              <Link key={d.id} href={`/dashboard/advocaat/dossiers/${d.id}`}
                className="flex items-center gap-4 p-4 rounded-xl bg-white/[0.03] border border-white/[0.07] hover:bg-white/[0.05] hover:border-white/[0.12] transition-all group">

                {/* Risk bar left */}
                <div className="flex flex-col items-center gap-1 shrink-0 w-8">
                  <div className={`w-1.5 rounded-full ${d.risk_score >= 75 ? 'bg-red-500' : d.risk_score >= 50 ? 'bg-orange-500' : d.risk_score >= 25 ? 'bg-yellow-500' : 'bg-emerald-500'}`}
                    style={{ height: `${Math.max(12, d.risk_score * 0.48)}px` }}
                  />
                  <span className="text-[9px] text-white/30 font-mono">{d.risk_score}</span>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-white group-hover:text-violet-300 transition-colors">{d.title}</span>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border shrink-0 ${PRIORITY_COLOR[d.priority]}`}>
                      {d.priority.toUpperCase()}
                    </span>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded border shrink-0 ${STATUS_COLOR[d.status]}`}>
                      {d.status}
                    </span>
                    <span className="text-[9px] text-white/30 shrink-0">{DOSSIER_TYPE_LABELS[d.dossier_type]}</span>
                  </div>
                  <div className="flex items-center gap-4 mt-1 flex-wrap">
                    {d.wederpartij && (
                      <span className="flex items-center gap-1 text-xs text-white/40">
                        <Building2 className="w-3 h-3" /> {d.wederpartij}
                      </span>
                    )}
                    {d.inzet_bedrag && (
                      <span className="flex items-center gap-1 text-xs text-white/40">
                        <Euro className="w-3 h-3" /> {fmtEur(d.inzet_bedrag)}
                      </span>
                    )}
                    {d.next_deadline && dl !== null && (
                      <span className={`flex items-center gap-1 text-xs ${dl <= 7 ? 'text-red-400' : dl <= 30 ? 'text-orange-400' : 'text-white/30'}`}>
                        <Clock className="w-3 h-3" /> {fmt(d.next_deadline)} ({dl}d)
                      </span>
                    )}
                    {d.next_action && (
                      <span className="text-xs text-violet-400/70 truncate max-w-xs">→ {d.next_action}</span>
                    )}
                  </div>
                </div>

                <ChevronRight className="w-4 h-4 text-white/20 group-hover:text-white/50 shrink-0 transition-colors" />
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
