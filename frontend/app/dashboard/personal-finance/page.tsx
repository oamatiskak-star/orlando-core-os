'use client'

import { useEffect, useState } from 'react'
import { BadgeDollarSign, TrendingUp, TrendingDown, Plus, Pencil, Trash2, Wallet } from 'lucide-react'
import clsx from 'clsx'

type Asset = {
  id: string
  categorie: string
  naam: string
  waarde: number
  valuta: string
  aanbieder: string | null
  rendement_pct: number | null
  aankoopdatum: string | null
  notes: string | null
}

type Liability = {
  id: string
  categorie: string
  naam: string
  saldo: number
  rente_pct: number | null
  maandbedrag: number | null
  einddatum: string | null
  aanbieder: string | null
  notes: string | null
}

const ASSET_COLORS: Record<string, string> = {
  spaarrekening:'text-sky-400    bg-sky-500/10    border-sky-500/20',
  belegging:    'text-indigo-400 bg-indigo-500/10 border-indigo-500/20',
  vastgoed:     'text-amber-400  bg-amber-500/10  border-amber-500/20',
  pensioen:     'text-violet-400 bg-violet-500/10 border-violet-500/20',
  crypto:       'text-orange-400 bg-orange-500/10 border-orange-500/20',
  bedrijf:      'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  overig:       'text-white/40   bg-white/5        border-white/10',
}

const LIAB_COLORS: Record<string, string> = {
  hypotheek:  'text-red-400    bg-red-500/10    border-red-500/20',
  lening:     'text-orange-400 bg-orange-500/10 border-orange-500/20',
  creditcard: 'text-amber-400  bg-amber-500/10  border-amber-500/20',
  belasting:  'text-rose-400   bg-rose-500/10   border-rose-500/20',
  overig:     'text-white/40   bg-white/5        border-white/10',
}

type ModalMode = 'asset' | 'liability'

function fmt(n: number) {
  if (n >= 1_000_000) return '€ ' + (n / 1_000_000).toFixed(2) + 'M'
  if (n >= 1_000)     return '€ ' + (n / 1_000).toFixed(1) + 'K'
  return '€ ' + n.toLocaleString('nl-NL', { maximumFractionDigits: 0 })
}

export default function PersonalFinancePage() {
  const [assets, setAssets]           = useState<Asset[]>([])
  const [liabilities, setLiabilities] = useState<Liability[]>([])
  const [activeTab, setActiveTab]     = useState<'assets' | 'liabilities'>('assets')
  const [modal, setModal]             = useState<{ mode: ModalMode; data: Partial<Asset & Liability> } | null>(null)
  const [saving, setSaving]           = useState(false)
  const [loading, setLoading]         = useState(true)

  const load = async () => {
    setLoading(true)
    const [ar, lr] = await Promise.all([
      fetch('/api/personal-finance/assets', { cache: 'no-store' }),
      fetch('/api/personal-finance/liabilities', { cache: 'no-store' }),
    ])
    if (ar.ok) { const d = await ar.json(); setAssets(d.assets ?? []) }
    if (lr.ok) { const d = await lr.json(); setLiabilities(d.liabilities ?? []) }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const totalAssets      = assets.reduce((s, a) => s + (a.waarde ?? 0), 0)
  const totalLiabilities = liabilities.reduce((s, l) => s + (l.saldo ?? 0), 0)
  const netWorth         = totalAssets - totalLiabilities

  const save = async () => {
    if (!modal) return
    setSaving(true)
    const isNew = !modal.data.id
    if (modal.mode === 'asset') {
      const url    = isNew ? '/api/personal-finance/assets' : `/api/personal-finance/assets/${modal.data.id}`
      const method = isNew ? 'POST' : 'PATCH'
      const r = await fetch(url, {
        method, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          naam:          modal.data.naam,
          categorie:     modal.data.categorie ?? 'overig',
          waarde:        Number(modal.data.waarde ?? 0),
          valuta:        modal.data.valuta ?? 'EUR',
          aanbieder:     (modal.data as Asset).aanbieder || null,
          rendement_pct: (modal.data as Asset).rendement_pct ?? null,
          notes:         modal.data.notes || null,
        }),
      })
      if (r.ok) { setModal(null); load() }
    } else {
      const url    = isNew ? '/api/personal-finance/liabilities' : `/api/personal-finance/liabilities/${modal.data.id}`
      const method = isNew ? 'POST' : 'PATCH'
      const r = await fetch(url, {
        method, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          naam:       modal.data.naam,
          categorie:  modal.data.categorie ?? 'overig',
          saldo:      Number((modal.data as Liability).saldo ?? 0),
          rente_pct:  (modal.data as Liability).rente_pct ?? null,
          maandbedrag:(modal.data as Liability).maandbedrag ?? null,
          einddatum:  (modal.data as Liability).einddatum || null,
          aanbieder:  (modal.data as Liability).aanbieder || null,
          notes:      modal.data.notes || null,
        }),
      })
      if (r.ok) { setModal(null); load() }
    }
    setSaving(false)
  }

  const del = async (mode: ModalMode, id: string) => {
    if (!confirm('Verwijderen?')) return
    const base = mode === 'asset' ? '/api/personal-finance/assets' : '/api/personal-finance/liabilities'
    await fetch(`${base}/${id}`, { method: 'DELETE' })
    load()
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold text-white">Personal Finance OS</h1>
        <p className="text-sm text-white/65 mt-0.5">Netto vermogen, bezittingen en schulden</p>
      </div>

      {/* Net Worth banner */}
      {!loading && (
        <div className="bg-white/[0.06] border border-white/10 rounded-2xl p-6">
          <div className="grid grid-cols-3 gap-6 text-center">
            <div>
              <p className="text-xs text-white/45 mb-1">Totale bezittingen</p>
              <p className="text-2xl font-bold text-emerald-400">{fmt(totalAssets)}</p>
            </div>
            <div>
              <p className="text-xs text-white/45 mb-1">Netto vermogen</p>
              <p className={clsx('text-3xl font-black', netWorth >= 0 ? 'text-white' : 'text-red-400')}>{fmt(netWorth)}</p>
              <p className="text-xs text-white/30 mt-0.5">bezittingen - schulden</p>
            </div>
            <div>
              <p className="text-xs text-white/45 mb-1">Totale schulden</p>
              <p className="text-2xl font-bold text-red-400">{fmt(totalLiabilities)}</p>
            </div>
          </div>

          {/* Breakdown bars by category */}
          {assets.length > 0 && (
            <div className="mt-5 space-y-1.5">
              {Object.entries(
                assets.reduce((acc: Record<string, number>, a) => {
                  acc[a.categorie] = (acc[a.categorie] ?? 0) + a.waarde
                  return acc
                }, {})
              ).sort((a, b) => b[1] - a[1]).map(([cat, val]) => (
                <div key={cat} className="flex items-center gap-3">
                  <span className={clsx('px-2 py-0.5 rounded-full text-[11px] border w-28 text-center shrink-0', ASSET_COLORS[cat] ?? ASSET_COLORS.overig)}>
                    {cat}
                  </span>
                  <div className="flex-1 bg-white/5 rounded-full h-2 overflow-hidden">
                    <div className="h-2 rounded-full bg-emerald-500/60" style={{ width: `${Math.min(100, (val / totalAssets) * 100)}%` }} />
                  </div>
                  <span className="text-xs text-white/55 w-20 text-right shrink-0">{fmt(val)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 items-center justify-between">
        <div className="flex gap-1">
          {([
            { v: 'assets',      l: `Bezittingen (${assets.length})`,   icon: TrendingUp },
            { v: 'liabilities', l: `Schulden (${liabilities.length})`, icon: TrendingDown },
          ] as const).map(({ v, l, icon: Icon }) => (
            <button key={v} onClick={() => setActiveTab(v)}
              className={clsx('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors border',
                activeTab === v ? 'bg-white/10 border-white/20 text-white' : 'bg-white/5 border-white/10 text-white/50 hover:text-white/80')}>
              <Icon size={12} /> {l}
            </button>
          ))}
        </div>
        <button
          onClick={() => setModal({ mode: activeTab === 'assets' ? 'asset' : 'liability', data: { naam: '', categorie: activeTab === 'assets' ? 'belegging' : 'hypotheek' } })}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/25 transition-colors text-xs">
          <Plus size={12} /> Toevoegen
        </button>
      </div>

      {/* Assets list */}
      {activeTab === 'assets' && (
        loading ? <div className="text-center py-8 text-white/30 text-sm">Laden...</div> :
        assets.length === 0 ? (
          <div className="bg-white/[0.04] border border-white/8 rounded-xl p-8 flex flex-col items-center gap-2">
            <Wallet size={28} className="text-white/20" />
            <p className="text-sm text-white/40">Nog geen bezittingen geregistreerd</p>
          </div>
        ) : (
          <div className="space-y-2">
            {assets.map(a => (
              <div key={a.id} className="group bg-white/[0.06] border border-white/5 rounded-xl px-4 py-3 hover:border-white/15 transition-colors flex items-center gap-3">
                <div className={clsx('px-2 py-0.5 rounded-full text-[11px] border shrink-0', ASSET_COLORS[a.categorie] ?? ASSET_COLORS.overig)}>
                  {a.categorie}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{a.naam}</p>
                  {a.aanbieder && <p className="text-xs text-white/40">{a.aanbieder}</p>}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-emerald-400">{fmt(a.waarde)}</p>
                  {a.rendement_pct != null && (
                    <p className="text-xs text-white/40">{a.rendement_pct}% rendement</p>
                  )}
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  <button onClick={() => setModal({ mode: 'asset', data: a })} className="p-1.5 rounded hover:bg-white/10 text-white/40 hover:text-white">
                    <Pencil size={11} />
                  </button>
                  <button onClick={() => del('asset', a.id)} className="p-1.5 rounded hover:bg-red-500/15 text-white/40 hover:text-red-400">
                    <Trash2 size={11} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* Liabilities list */}
      {activeTab === 'liabilities' && (
        loading ? <div className="text-center py-8 text-white/30 text-sm">Laden...</div> :
        liabilities.length === 0 ? (
          <div className="bg-white/[0.04] border border-white/8 rounded-xl p-8 flex flex-col items-center gap-2">
            <BadgeDollarSign size={28} className="text-white/20" />
            <p className="text-sm text-white/40">Geen schulden geregistreerd</p>
          </div>
        ) : (
          <div className="space-y-2">
            {liabilities.map(l => (
              <div key={l.id} className="group bg-white/[0.06] border border-white/5 rounded-xl px-4 py-3 hover:border-white/15 transition-colors flex items-center gap-3">
                <div className={clsx('px-2 py-0.5 rounded-full text-[11px] border shrink-0', LIAB_COLORS[l.categorie] ?? LIAB_COLORS.overig)}>
                  {l.categorie}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{l.naam}</p>
                  {l.aanbieder && <p className="text-xs text-white/40">{l.aanbieder}</p>}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-red-400">{fmt(l.saldo)}</p>
                  {l.maandbedrag && <p className="text-xs text-white/40">{fmt(l.maandbedrag)}/mnd</p>}
                  {l.rente_pct != null && <p className="text-xs text-white/40">{l.rente_pct}% rente</p>}
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  <button onClick={() => setModal({ mode: 'liability', data: l })} className="p-1.5 rounded hover:bg-white/10 text-white/40 hover:text-white">
                    <Pencil size={11} />
                  </button>
                  <button onClick={() => del('liability', l.id)} className="p-1.5 rounded hover:bg-red-500/15 text-white/40 hover:text-red-400">
                    <Trash2 size={11} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#111] border border-white/10 rounded-2xl w-full max-w-md flex flex-col">
            <div className="border-b border-white/8 px-5 py-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-white">
                {modal.data.id ? 'Bewerken' : modal.mode === 'asset' ? 'Bezitting toevoegen' : 'Schuld toevoegen'}
              </h2>
              <button onClick={() => setModal(null)} className="text-white/40 hover:text-white text-xl leading-none">×</button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="text-xs text-white/50 mb-1 block">Naam *</label>
                <input type="text" value={modal.data.naam ?? ''} onChange={e => setModal(m => m ? { ...m, data: { ...m.data, naam: e.target.value } } : null)}
                  placeholder={modal.mode === 'asset' ? 'DEGIRO beleggingsrekening' : 'ABN AMRO hypotheek'}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/25 focus:outline-none focus:border-emerald-500/50" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-white/50 mb-1 block">Categorie</label>
                  <select value={modal.data.categorie ?? (modal.mode === 'asset' ? 'belegging' : 'hypotheek')}
                    onChange={e => setModal(m => m ? { ...m, data: { ...m.data, categorie: e.target.value } } : null)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50">
                    {modal.mode === 'asset' ? (
                      <>
                        <option value="spaarrekening">Spaarrekening</option>
                        <option value="belegging">Belegging</option>
                        <option value="vastgoed">Vastgoed</option>
                        <option value="pensioen">Pensioen</option>
                        <option value="crypto">Crypto</option>
                        <option value="bedrijf">Bedrijf</option>
                        <option value="overig">Overig</option>
                      </>
                    ) : (
                      <>
                        <option value="hypotheek">Hypotheek</option>
                        <option value="lening">Lening</option>
                        <option value="creditcard">Creditcard</option>
                        <option value="belasting">Belasting</option>
                        <option value="overig">Overig</option>
                      </>
                    )}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-white/50 mb-1 block">{modal.mode === 'asset' ? 'Waarde (€)' : 'Saldo (€)'}</label>
                  <input type="number"
                    value={modal.mode === 'asset' ? ((modal.data as Partial<Asset>).waarde ?? '') : ((modal.data as Partial<Liability>).saldo ?? '')}
                    onChange={e => {
                      const val = e.target.value ? Number(e.target.value) : 0
                      setModal(m => m ? { ...m, data: modal.mode === 'asset' ? { ...m.data, waarde: val } : { ...m.data, saldo: val } } : null)
                    }}
                    placeholder="50000"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/25 focus:outline-none focus:border-emerald-500/50" />
                </div>
              </div>

              <div>
                <label className="text-xs text-white/50 mb-1 block">Aanbieder</label>
                <input type="text"
                  value={(modal.data as Partial<Asset>).aanbieder ?? ''}
                  onChange={e => setModal(m => m ? { ...m, data: { ...m.data, aanbieder: e.target.value } } : null)}
                  placeholder={modal.mode === 'asset' ? 'DEGIRO, Rabo, NN...' : 'ABN, ING, Rabobank...'}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/25 focus:outline-none focus:border-emerald-500/50" />
              </div>

              {modal.mode === 'asset' && (
                <div>
                  <label className="text-xs text-white/50 mb-1 block">Verwacht rendement (%/jaar)</label>
                  <input type="number" step="0.1"
                    value={(modal.data as Partial<Asset>).rendement_pct ?? ''}
                    onChange={e => setModal(m => m ? { ...m, data: { ...m.data, rendement_pct: e.target.value ? Number(e.target.value) : undefined } } : null)}
                    placeholder="7.0"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/25 focus:outline-none focus:border-emerald-500/50" />
                </div>
              )}

              {modal.mode === 'liability' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-white/50 mb-1 block">Rente (%)</label>
                    <input type="number" step="0.01"
                      value={(modal.data as Partial<Liability>).rente_pct ?? ''}
                      onChange={e => setModal(m => m ? { ...m, data: { ...m.data, rente_pct: e.target.value ? Number(e.target.value) : undefined } } : null)}
                      placeholder="2.5"
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/25 focus:outline-none focus:border-emerald-500/50" />
                  </div>
                  <div>
                    <label className="text-xs text-white/50 mb-1 block">Maandbedrag (€)</label>
                    <input type="number"
                      value={(modal.data as Partial<Liability>).maandbedrag ?? ''}
                      onChange={e => setModal(m => m ? { ...m, data: { ...m.data, maandbedrag: e.target.value ? Number(e.target.value) : undefined } } : null)}
                      placeholder="1200"
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/25 focus:outline-none focus:border-emerald-500/50" />
                  </div>
                </div>
              )}
            </div>

            <div className="border-t border-white/8 px-5 py-4 flex justify-end gap-3">
              <button onClick={() => setModal(null)} className="px-4 py-2 rounded-lg text-sm text-white/50 hover:text-white hover:bg-white/5 transition-colors">Annuleren</button>
              <button onClick={save} disabled={saving || !modal.data.naam}
                className="px-4 py-2 rounded-lg text-sm bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/30 transition-colors disabled:opacity-50">
                {saving ? 'Opslaan...' : 'Opslaan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
