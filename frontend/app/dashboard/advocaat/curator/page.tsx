'use client'

import { useEffect, useState } from 'react'
import {
  Shield, AlertTriangle, Building2, User, Mail, Phone,
  Calendar, Euro, ChevronRight, Plus, RefreshCw,
  CheckCircle, XCircle, Clock, FileText, Brain,
} from 'lucide-react'
import type { CuratorDossier } from '@/lib/advocaat/types'

const RISK_COLOR: Record<string, string> = {
  kritiek: 'text-red-400 bg-red-500/10 border-red-500/30',
  hoog:    'text-orange-400 bg-orange-500/10 border-orange-500/25',
  medium:  'text-yellow-400 bg-yellow-500/8 border-white/[0.06]',
  laag:    'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
}

function fmt(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })
}

function fmtEur(n: number | null) {
  if (n === null || n === undefined) return '—'
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)
}

function daysUntil(d: string | null) {
  if (!d) return null
  return Math.ceil((new Date(d).getTime() - Date.now()) / 86400000)
}

export default function CuratorPage() {
  const [curatoren, setCuratoren] = useState<CuratorDossier[]>([])
  const [selected,  setSelected]  = useState<CuratorDossier | null>(null)
  const [loading,   setLoading]   = useState(true)
  const [analyzing, setAnalyzing] = useState(false)
  const [showForm,  setShowForm]  = useState(false)
  const [form,      setForm]      = useState({
    bedrijf_naam: '', kvk_nummer: '', insolventienummer: '',
    rechtbank: '', faillissementsdatum: '', curator_naam: '',
    curator_kantoor: '', curator_email: '', boedel_vordering: '',
    betwiste_vordering: '', notes: '', aansprakelijkheid_risk: false, pauliana_risk: false,
    dossier_id: '',
  })

  async function load() {
    setLoading(true)
    const res = await fetch('/api/advocaat/curator').then(r => r.json()).catch(() => ({}))
    setCuratoren(res.curatoren ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function analyze(c: CuratorDossier) {
    if (!c.dossier_id) return
    setAnalyzing(true)
    await fetch('/api/advocaat/analyze', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ dossier_id: c.dossier_id, analyse_type: 'curator' }),
    })
    setAnalyzing(false)
    load()
  }

  async function submit() {
    const res = await fetch('/api/advocaat/curator', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        ...form,
        boedel_vordering: form.boedel_vordering ? parseFloat(form.boedel_vordering) : null,
        betwiste_vordering: form.betwiste_vordering ? parseFloat(form.betwiste_vordering) : null,
      }),
    })
    if (res.ok) { setShowForm(false); load() }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white p-6 space-y-6">

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/20">
            <Shield className="w-5 h-5 text-red-400" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-white">Curator Protectie Layer</h1>
            <p className="text-xs text-white/40 mt-0.5">Bestuurdersaansprakelijkheid · Pauliana · Faillissementsrecht</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="p-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] transition-all">
            <RefreshCw className={`w-4 h-4 text-white/40 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-medium hover:bg-red-500 transition-all">
            <Plus className="w-3.5 h-3.5" /> Curator dossier
          </button>
        </div>
      </div>

      {/* Waarschuwing banner */}
      <div className="flex items-start gap-3 p-4 rounded-xl bg-red-500/5 border border-red-500/20">
        <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
        <div className="text-xs text-red-300/80 leading-relaxed">
          <strong className="text-red-300">Curator Defense Protocol actief.</strong> Alle curatorcontacten, vorderingen en deadlines worden gelogd en geanalyseerd.
          Bestuurdersaansprakelijkheid (art. 2:248 BW) en pauliana risico&apos;s (art. 42 Fw) worden continu gescreend.
          Reageer nooit op curator zonder dit systeem te raadplegen.
        </div>
      </div>

      {/* Add form */}
      {showForm && (
        <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-5 space-y-4">
          <div className="text-sm font-medium text-white mb-4">Nieuw Curator Dossier</div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { key: 'bedrijf_naam',       label: 'Bedrijfsnaam *',        placeholder: 'Bouwproffs NL BV' },
              { key: 'kvk_nummer',         label: 'KVK nummer',             placeholder: '12345678' },
              { key: 'insolventienummer',  label: 'Insolventienummer',      placeholder: 'F.12/25/123' },
              { key: 'rechtbank',          label: 'Rechtbank',              placeholder: 'Rb. Rotterdam' },
              { key: 'faillissementsdatum', label: 'Faillissementsdatum',  placeholder: 'YYYY-MM-DD', type: 'date' },
              { key: 'curator_naam',       label: 'Curator naam',           placeholder: 'Mr. J. Jansen' },
              { key: 'curator_kantoor',    label: 'Curator kantoor',        placeholder: 'Jansen & Partners' },
              { key: 'curator_email',      label: 'Curator e-mail',         placeholder: 'j.jansen@kantoor.nl' },
              { key: 'boedel_vordering',   label: 'Boedelvordering (€)',    placeholder: '0', type: 'number' },
              { key: 'betwiste_vordering', label: 'Betwiste vordering (€)', placeholder: '0', type: 'number' },
            ].map(f => (
              <div key={f.key}>
                <label className="text-[10px] text-white/40 uppercase tracking-wider">{f.label}</label>
                <input
                  type={f.type ?? 'text'}
                  value={form[f.key as keyof typeof form] as string}
                  onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                  placeholder={f.placeholder}
                  className="w-full mt-1 px-3 py-2 rounded-lg bg-white/[0.05] border border-white/[0.08] text-sm text-white placeholder-white/20 focus:outline-none focus:border-red-500/40"
                />
              </div>
            ))}
          </div>
          <div className="flex gap-4">
            {['aansprakelijkheid_risk', 'pauliana_risk'].map(k => (
              <label key={k} className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form[k as keyof typeof form] as boolean}
                  onChange={e => setForm(p => ({ ...p, [k]: e.target.checked }))}
                  className="rounded"
                />
                <span className="text-xs text-white/60">
                  {k === 'aansprakelijkheid_risk' ? 'Bestuurdersaansprakelijkheid risico' : 'Pauliana risico'}
                </span>
              </label>
            ))}
          </div>
          <div>
            <label className="text-[10px] text-white/40 uppercase tracking-wider">Dossier ID (optioneel)</label>
            <input value={form.dossier_id} onChange={e => setForm(p => ({ ...p, dossier_id: e.target.value }))}
              placeholder="uuid van bestaand dossier"
              className="w-full mt-1 px-3 py-2 rounded-lg bg-white/[0.05] border border-white/[0.08] text-sm text-white placeholder-white/20 focus:outline-none focus:border-red-500/40"
            />
          </div>
          <div>
            <label className="text-[10px] text-white/40 uppercase tracking-wider">Notities</label>
            <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
              rows={3} placeholder="Aanvullende informatie..."
              className="w-full mt-1 px-3 py-2 rounded-lg bg-white/[0.05] border border-white/[0.08] text-sm text-white placeholder-white/20 focus:outline-none focus:border-red-500/40 resize-none"
            />
          </div>
          <div className="flex gap-2">
            <button onClick={submit} className="px-4 py-2 rounded-lg bg-red-600 text-white text-xs font-medium hover:bg-red-500 transition-all">Opslaan</button>
            <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white/60 text-xs hover:text-white transition-all">Annuleren</button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Curator list */}
        <div className="bg-white/[0.03] border border-white/[0.07] rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-white/[0.06]">
            <span className="text-sm font-medium text-white">Curator Dossiers ({curatoren.length})</span>
          </div>
          {loading ? (
            <div className="p-6 text-center text-white/30 text-sm">Laden...</div>
          ) : curatoren.length === 0 ? (
            <div className="p-6 text-center text-white/30 text-sm">
              <Shield className="w-8 h-8 mx-auto mb-2 opacity-20" />
              Geen curator dossiers.<br />Importeer bestanden of maak handmatig aan.
            </div>
          ) : (
            <div className="divide-y divide-white/[0.04]">
              {curatoren.map(c => {
                const days = daysUntil(c.next_deadline)
                return (
                  <button key={c.id} onClick={() => setSelected(c)}
                    className={`w-full text-left px-4 py-3 hover:bg-white/[0.03] transition-all ${selected?.id === c.id ? 'bg-red-500/5 border-l-2 border-red-500' : ''}`}
                  >
                    <div className="flex items-center gap-2">
                      <Building2 className="w-3.5 h-3.5 text-white/30 shrink-0" />
                      <span className="text-sm font-medium text-white truncate">{c.bedrijf_naam}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded border shrink-0 ${RISK_COLOR[c.risk_level]}`}>
                        {c.risk_level.toUpperCase()}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs text-white/40">{c.status}</span>
                      {c.faillissementsdatum && <span className="text-xs text-white/30">{fmt(c.faillissementsdatum)}</span>}
                    </div>
                    {(c.aansprakelijkheid_risk || c.pauliana_risk) && (
                      <div className="flex gap-1 mt-1.5">
                        {c.aansprakelijkheid_risk && <span className="text-[9px] px-1 py-0.5 rounded bg-red-500/15 text-red-400 border border-red-500/20">ART. 2:248</span>}
                        {c.pauliana_risk && <span className="text-[9px] px-1 py-0.5 rounded bg-orange-500/15 text-orange-400 border border-orange-500/20">PAULIANA</span>}
                      </div>
                    )}
                    {days !== null && days <= 30 && (
                      <div className={`text-[10px] mt-1 ${days <= 7 ? 'text-red-400' : 'text-orange-400'}`}>
                        ⚠ Deadline over {days} dag{days !== 1 ? 'en' : ''}
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Detail panel */}
        <div className="lg:col-span-2">
          {!selected ? (
            <div className="h-full flex items-center justify-center bg-white/[0.02] border border-white/[0.06] rounded-xl text-white/20 text-sm">
              Selecteer een curator dossier
            </div>
          ) : (
            <div className="space-y-4">

              {/* Header */}
              <div className="bg-white/[0.03] border border-white/[0.07] rounded-xl p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-base font-semibold text-white">{selected.bedrijf_naam}</h2>
                    <div className="flex items-center gap-2 mt-1">
                      {selected.kvk_nummer && <span className="text-xs text-white/40">KVK: {selected.kvk_nummer}</span>}
                      {selected.insolventienummer && <span className="text-xs text-white/40">· {selected.insolventienummer}</span>}
                      {selected.rechtbank && <span className="text-xs text-white/40">· {selected.rechtbank}</span>}
                    </div>
                  </div>
                  <span className={`text-xs font-bold px-2 py-1 rounded border ${RISK_COLOR[selected.risk_level]}`}>
                    {selected.risk_level.toUpperCase()} RISICO
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-3 mt-4">
                  <div className="p-2 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                    <div className="text-[10px] text-white/30 uppercase">Faillissementsdatum</div>
                    <div className="text-sm text-white mt-0.5">{fmt(selected.faillissementsdatum)}</div>
                  </div>
                  <div className="p-2 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                    <div className="text-[10px] text-white/30 uppercase">Boedelvordering</div>
                    <div className="text-sm text-white mt-0.5">{fmtEur(selected.boedel_vordering)}</div>
                  </div>
                  <div className="p-2 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                    <div className="text-[10px] text-white/30 uppercase">Betwist</div>
                    <div className="text-sm text-white mt-0.5">{fmtEur(selected.betwiste_vordering)}</div>
                  </div>
                </div>
              </div>

              {/* Risico flags */}
              <div className="grid grid-cols-2 gap-3">
                <div className={`p-3 rounded-xl border ${selected.aansprakelijkheid_risk ? 'bg-red-500/8 border-red-500/25' : 'bg-white/[0.02] border-white/[0.06]'}`}>
                  <div className="flex items-center gap-2">
                    {selected.aansprakelijkheid_risk ? <XCircle className="w-4 h-4 text-red-400" /> : <CheckCircle className="w-4 h-4 text-emerald-400" />}
                    <span className="text-xs font-medium text-white">Bestuurdersaansprakelijkheid</span>
                  </div>
                  <div className="text-[10px] text-white/40 mt-1">Art. 2:248 BW — kennelijk onbehoorlijk bestuur</div>
                  <div className={`text-xs mt-1.5 font-medium ${selected.aansprakelijkheid_risk ? 'text-red-400' : 'text-emerald-400'}`}>
                    {selected.aansprakelijkheid_risk ? '⚠ RISICO GEDETECTEERD' : '✓ Geen indicatie'}
                  </div>
                </div>
                <div className={`p-3 rounded-xl border ${selected.pauliana_risk ? 'bg-orange-500/8 border-orange-500/25' : 'bg-white/[0.02] border-white/[0.06]'}`}>
                  <div className="flex items-center gap-2">
                    {selected.pauliana_risk ? <XCircle className="w-4 h-4 text-orange-400" /> : <CheckCircle className="w-4 h-4 text-emerald-400" />}
                    <span className="text-xs font-medium text-white">Pauliana</span>
                  </div>
                  <div className="text-[10px] text-white/40 mt-1">Art. 42 Fw — onverplichte rechtshandeling benadeelt</div>
                  <div className={`text-xs mt-1.5 font-medium ${selected.pauliana_risk ? 'text-orange-400' : 'text-emerald-400'}`}>
                    {selected.pauliana_risk ? '⚠ RISICO GEDETECTEERD' : '✓ Geen indicatie'}
                  </div>
                </div>
              </div>

              {/* Curator contact */}
              {(selected.curator_naam || selected.curator_email) && (
                <div className="bg-white/[0.03] border border-white/[0.07] rounded-xl p-4">
                  <div className="text-xs font-medium text-white/60 mb-3 uppercase tracking-wider">Curator Contact</div>
                  <div className="space-y-2">
                    {selected.curator_naam && (
                      <div className="flex items-center gap-2 text-sm text-white">
                        <User className="w-3.5 h-3.5 text-white/30" /> {selected.curator_naam}
                        {selected.curator_kantoor && <span className="text-white/40">· {selected.curator_kantoor}</span>}
                      </div>
                    )}
                    {selected.curator_email && (
                      <div className="flex items-center gap-2 text-sm text-blue-400">
                        <Mail className="w-3.5 h-3.5" /> {selected.curator_email}
                      </div>
                    )}
                    {selected.last_contact_at && (
                      <div className="flex items-center gap-2 text-xs text-white/40">
                        <Clock className="w-3 h-3" /> Laatste contact: {fmt(selected.last_contact_at)}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Open vragen */}
              {selected.open_vragen.length > 0 && (
                <div className="bg-amber-500/5 border border-amber-500/15 rounded-xl p-4">
                  <div className="text-xs font-medium text-amber-400 mb-2 uppercase tracking-wider">Open Vragen</div>
                  <ul className="space-y-1">
                    {selected.open_vragen.map((v, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-white/70">
                        <span className="text-amber-400 shrink-0">?</span> {v}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Analyse knop */}
              <button onClick={() => analyze(selected)} disabled={analyzing || !selected.dossier_id}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-violet-600 text-white text-sm font-medium hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
                <Brain className={`w-4 h-4 ${analyzing ? 'animate-pulse' : ''}`} />
                {analyzing ? 'Analyseren...' : 'AI Curator Analyse Uitvoeren'}
              </button>

              {selected.notes && (
                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] text-xs text-white/50">
                  {selected.notes}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
