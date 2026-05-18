'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'
import {
  ChevronLeft, Upload, TrendingUp, TrendingDown, Wallet,
  RefreshCw, ChevronRight, Repeat, AlertCircle,
} from 'lucide-react'

type YTD = { inkomsten: number; uitgaven: number; cashflow: number; sparen: number }
type Cat = { cat: string; bedrag: number }
type Tx  = {
  id: string
  booking_date: string
  amount: number
  direction: string
  category: string
  description: string | null
  creditor_name: string | null
  debtor_name: string | null
}
type VasteLast = { naam: string; maanden: number }
type Vermogen  = { activa: number; passiva: number; netto: number }
type Asset     = { id: string; naam: string; categorie: string; waarde: number }
type Liability = { id: string; naam: string; categorie: string; saldo: number; maandbedrag: number | null }

type Tab = 'overzicht' | 'transacties' | 'vermogen' | 'vaste-lasten'

interface Props {
  jaar: number
  ytd: YTD
  categorieen: Cat[]
  transactions: Tx[]
  vasteLasten: VasteLast[]
  vermogen: Vermogen
  assets: Asset[]
  liabilities: Liability[]
}

const fmt = (n: number) =>
  new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)

const CAT_COLORS: Record<string, string> = {
  wonen:        'bg-blue-500/20 text-blue-300',
  boodschappen: 'bg-green-500/20 text-green-300',
  transport:    'bg-yellow-500/20 text-yellow-300',
  verzekering:  'bg-purple-500/20 text-purple-300',
  abonnement:   'bg-pink-500/20 text-pink-300',
  horeca:       'bg-orange-500/20 text-orange-300',
  overig:       'bg-white/10 text-white/50',
}
const catColor = (cat: string) => CAT_COLORS[cat] ?? 'bg-white/10 text-white/50'

export default function MobileFinanceClient({
  jaar, ytd, categorieen, transactions, vasteLasten, vermogen, assets, liabilities,
}: Props) {
  const [tab, setTab]         = useState<Tab>('overzicht')
  const [uploading, setUploading] = useState(false)
  const [importResult, setImportResult] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setImportResult(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res  = await fetch('/api/bank/import', { method: 'POST', body: fd })
      const json = await res.json()
      if (json.ok) {
        setImportResult(`${json.inserted} nieuw · ${json.skipped} dubbel (${json.format})`)
      } else {
        setImportResult(json.error ?? 'Fout bij importeren')
      }
    } catch {
      setImportResult('Verbindingsfout')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const TABS: Array<{ id: Tab; label: string }> = [
    { id: 'overzicht',    label: 'Overzicht' },
    { id: 'transacties',  label: 'Transacties' },
    { id: 'vermogen',     label: 'Vermogen' },
    { id: 'vaste-lasten', label: 'Vaste lasten' },
  ]

  return (
    <div className="max-w-lg mx-auto" style={{ paddingTop: 'calc(1rem + env(safe-area-inset-top))' }}>
      {/* Header */}
      <div className="px-4 mb-4">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <Link href="/mobile" className="p-1 -ml-1 text-white/40 hover:text-white/70 transition-colors">
              <ChevronLeft size={22} />
            </Link>
            <h1 className="text-lg font-bold text-white">Finance OS</h1>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/api/bank/ing/connect"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-700 text-white text-[12px] font-medium"
            >
              ING
            </Link>
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 text-white text-[12px] font-medium disabled:opacity-50"
            >
              {uploading
                ? <RefreshCw size={13} className="animate-spin" />
                : <Upload size={13} />
              }
              Import
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.pdf,.mt940,.mta,.sta,.csv,.txt"
              className="hidden"
              onChange={handleFile}
            />
          </div>
        </div>
        {importResult && (
          <p className={`text-[11px] mt-1 ${importResult.includes('Fout') || importResult.includes('fout') ? 'text-red-400' : 'text-emerald-400'}`}>
            {importResult}
          </p>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 px-4 mb-3 overflow-x-auto scrollbar-none">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-[11px] font-medium transition-colors ${
              tab === t.id
                ? 'bg-indigo-600 text-white'
                : 'bg-white/[0.06] text-white/50 hover:text-white/70'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="px-4 space-y-3 pb-6">

        {/* OVERZICHT TAB */}
        {tab === 'overzicht' && (
          <>
            {/* YTD kaarten */}
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-[#0d0d1a] rounded-2xl border border-white/[0.08] p-3.5">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <TrendingUp size={13} className="text-emerald-400" />
                  <span className="text-[10px] text-white/40">Inkomsten {jaar}</span>
                </div>
                <p className="text-[18px] font-bold text-emerald-400">{fmt(ytd.inkomsten)}</p>
              </div>
              <div className="bg-[#0d0d1a] rounded-2xl border border-white/[0.08] p-3.5">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <TrendingDown size={13} className="text-red-400" />
                  <span className="text-[10px] text-white/40">Uitgaven {jaar}</span>
                </div>
                <p className="text-[18px] font-bold text-red-400">{fmt(ytd.uitgaven)}</p>
              </div>
              <div className={`bg-[#0d0d1a] rounded-2xl border p-3.5 ${ytd.cashflow >= 0 ? 'border-emerald-500/20' : 'border-red-500/20'}`}>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Wallet size={13} className={ytd.cashflow >= 0 ? 'text-emerald-400' : 'text-red-400'} />
                  <span className="text-[10px] text-white/40">Cashflow</span>
                </div>
                <p className={`text-[18px] font-bold ${ytd.cashflow >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {fmt(ytd.cashflow)}
                </p>
              </div>
              <div className="bg-[#0d0d1a] rounded-2xl border border-white/[0.08] p-3.5">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <TrendingUp size={13} className="text-indigo-400" />
                  <span className="text-[10px] text-white/40">Gespaard</span>
                </div>
                <p className="text-[18px] font-bold text-indigo-400">{fmt(ytd.sparen)}</p>
              </div>
            </div>

            {/* Categorie breakdown */}
            {categorieen.length > 0 && (
              <div className="bg-[#0d0d1a] rounded-2xl border border-white/[0.08] p-4">
                <p className="text-[11px] font-semibold text-white/50 uppercase tracking-wider mb-3">Uitgaven per categorie</p>
                <div className="space-y-2">
                  {categorieen.map(({ cat, bedrag }) => {
                    const pct = ytd.uitgaven > 0 ? (bedrag / ytd.uitgaven) * 100 : 0
                    return (
                      <div key={cat}>
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-[12px] text-white capitalize">{cat}</span>
                          <span className="text-[12px] text-white/60">{fmt(bedrag)}</span>
                        </div>
                        <div className="h-1 bg-white/[0.06] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-indigo-500 rounded-full"
                            style={{ width: `${Math.min(pct, 100)}%` }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {categorieen.length === 0 && (
              <div className="bg-[#0d0d1a] rounded-2xl border border-white/[0.08] p-6 text-center">
                <p className="text-white/30 text-sm mb-3">Nog geen transacties</p>
                <button
                  onClick={() => fileRef.current?.click()}
                  className="flex items-center gap-2 mx-auto px-4 py-2 rounded-xl bg-indigo-600 text-white text-[13px] font-medium"
                >
                  <Upload size={14} /> Importeer Dyme of ING
                </button>
              </div>
            )}
          </>
        )}

        {/* TRANSACTIES TAB */}
        {tab === 'transacties' && (
          <div className="bg-[#0d0d1a] rounded-2xl border border-white/[0.08] overflow-hidden">
            {transactions.length === 0 ? (
              <div className="py-12 text-center text-white/25 text-sm">Geen transacties</div>
            ) : (
              <div className="divide-y divide-white/[0.05]">
                {transactions.map(tx => {
                  const naam = tx.direction === 'credit'
                    ? (tx.debtor_name ?? tx.description ?? '—')
                    : (tx.creditor_name ?? tx.description ?? '—')
                  const isIn = tx.direction === 'credit'
                  return (
                    <div key={tx.id} className="flex items-center gap-3 px-4 py-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${isIn ? 'bg-emerald-500/15' : 'bg-red-500/15'}`}>
                        {isIn
                          ? <TrendingUp size={14} className="text-emerald-400" />
                          : <TrendingDown size={14} className="text-red-400" />
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] text-white truncate">{naam}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${catColor(tx.category)}`}>
                            {tx.category}
                          </span>
                          <span className="text-[10px] text-white/30">
                            {tx.booking_date?.slice(5)}
                          </span>
                        </div>
                      </div>
                      <p className={`text-[14px] font-semibold flex-shrink-0 ${isIn ? 'text-emerald-400' : 'text-white/80'}`}>
                        {isIn ? '+' : '-'}{fmt(tx.amount)}
                      </p>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* VERMOGEN TAB */}
        {tab === 'vermogen' && (
          <>
            {/* Netto vermogen */}
            <div className={`bg-[#0d0d1a] rounded-2xl border p-4 ${vermogen.netto >= 0 ? 'border-emerald-500/20' : 'border-red-500/20'}`}>
              <p className="text-[11px] text-white/40 mb-1">Netto vermogen</p>
              <p className={`text-[26px] font-bold ${vermogen.netto >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {fmt(vermogen.netto)}
              </p>
              <div className="flex gap-4 mt-2">
                <div>
                  <p className="text-[10px] text-white/30">Activa</p>
                  <p className="text-[13px] text-emerald-400 font-medium">{fmt(vermogen.activa)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-white/30">Passiva</p>
                  <p className="text-[13px] text-red-400 font-medium">{fmt(vermogen.passiva)}</p>
                </div>
              </div>
            </div>

            {/* Activa lijst */}
            {assets.length > 0 && (
              <div className="bg-[#0d0d1a] rounded-2xl border border-white/[0.08] overflow-hidden">
                <div className="px-4 py-3 border-b border-white/[0.06]">
                  <p className="text-[11px] font-semibold text-white/50 uppercase tracking-wider">Activa</p>
                </div>
                <div className="divide-y divide-white/[0.05]">
                  {assets.map(a => (
                    <div key={a.id} className="flex items-center justify-between px-4 py-3">
                      <div>
                        <p className="text-[13px] text-white">{a.naam}</p>
                        <p className="text-[10px] text-white/30 capitalize">{a.categorie}</p>
                      </div>
                      <p className="text-[14px] font-semibold text-emerald-400">{fmt(a.waarde)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Passiva lijst */}
            {liabilities.length > 0 && (
              <div className="bg-[#0d0d1a] rounded-2xl border border-white/[0.08] overflow-hidden">
                <div className="px-4 py-3 border-b border-white/[0.06]">
                  <p className="text-[11px] font-semibold text-white/50 uppercase tracking-wider">Schulden</p>
                </div>
                <div className="divide-y divide-white/[0.05]">
                  {liabilities.map(l => (
                    <div key={l.id} className="flex items-center justify-between px-4 py-3">
                      <div>
                        <p className="text-[13px] text-white">{l.naam}</p>
                        <p className="text-[10px] text-white/30 capitalize">
                          {l.categorie}{l.maandbedrag ? ` · ${fmt(l.maandbedrag)}/mnd` : ''}
                        </p>
                      </div>
                      <p className="text-[14px] font-semibold text-red-400">{fmt(l.saldo)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {assets.length === 0 && liabilities.length === 0 && (
              <div className="bg-[#0d0d1a] rounded-2xl border border-white/[0.08] p-6 text-center">
                <p className="text-white/30 text-sm">Nog geen vermogen ingesteld</p>
                <Link href="/dashboard/personal-finance" className="inline-flex items-center gap-1.5 mt-3 text-indigo-400 text-[13px]">
                  Beheer in dashboard <ChevronRight size={13} />
                </Link>
              </div>
            )}
          </>
        )}

        {/* VASTE LASTEN TAB */}
        {tab === 'vaste-lasten' && (
          <>
            {vasteLasten.length === 0 ? (
              <div className="bg-[#0d0d1a] rounded-2xl border border-white/[0.08] p-6 text-center">
                <AlertCircle size={24} className="text-white/20 mx-auto mb-2" />
                <p className="text-white/30 text-sm mb-1">Vaste lasten worden herkend na import</p>
                <p className="text-[11px] text-white/20">Importeer minstens 2 maanden aan transacties</p>
                <button
                  onClick={() => fileRef.current?.click()}
                  className="flex items-center gap-2 mx-auto mt-3 px-4 py-2 rounded-xl bg-indigo-600 text-white text-[13px] font-medium"
                >
                  <Upload size={14} /> Importeer
                </button>
              </div>
            ) : (
              <div className="bg-[#0d0d1a] rounded-2xl border border-white/[0.08] overflow-hidden">
                <div className="px-4 py-3 border-b border-white/[0.06]">
                  <p className="text-[11px] font-semibold text-white/50 uppercase tracking-wider">Terugkerende betalingen</p>
                </div>
                <div className="divide-y divide-white/[0.05]">
                  {vasteLasten.map((vl, i) => (
                    <div key={i} className="flex items-center gap-3 px-4 py-3">
                      <div className="w-8 h-8 rounded-full bg-purple-500/15 flex items-center justify-center flex-shrink-0">
                        <Repeat size={13} className="text-purple-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] text-white truncate">{vl.naam}</p>
                        <p className="text-[10px] text-white/30">{vl.maanden}× dit jaar</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
