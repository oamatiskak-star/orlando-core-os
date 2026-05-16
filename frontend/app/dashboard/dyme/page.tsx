'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Coins, RefreshCw, Link, AlertCircle, CheckCircle,
  Settings, ExternalLink, Eye, EyeOff, ChevronRight, Calendar,
  Upload, FileText, X,
} from 'lucide-react'

type Connection = {
  id: string
  bank_name: string
  iban: string | null
  status: string
  last_sync_at: string | null
}

type Transaction = {
  id: string
  booking_date: string
  amount: number
  direction: 'credit' | 'debet'
  description: string
  creditor_name: string | null
  debtor_name:   string | null
  category: string
}

type Summary = { income: number; expenses: number; balance: number; transactions: Transaction[] }

const CAT_ICONS: Record<string, string> = {
  wonen:'🏠', boodschappen:'🛒', auto:'🚗', kleding:'👕', horeca:'🍽️',
  abonnementen:'📱', gezondheid:'💊', sport:'🏋️', entertainment:'🎬',
  sparen:'🏦', investeren:'📈', transport:'🚆', belasting:'📋', salaris:'💼', overig:'💰',
}

function fmt(n: number) {
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)
}
function fmtFull(n: number) {
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(n)
}
function fmtDate(d: string) {
  return new Intl.DateTimeFormat('nl-NL', { day: '2-digit', month: 'short' }).format(new Date(d))
}

export default function DymePage() {
  const [connections,    setConnections]    = useState<Connection[]>([])
  const [hasCreds,       setHasCreds]       = useState(false)
  const [summary,        setSummary]        = useState<Summary | null>(null)
  const [activeTab,      setActiveTab]      = useState<'overzicht' | 'transacties' | 'budgetten'>('overzicht')
  const [syncing,        setSyncing]        = useState(false)
  const [loading,        setLoading]        = useState(true)
  const [showSetup,      setShowSetup]      = useState(false)
  const [clientId,       setClientId]       = useState('')
  const [clientSecret,   setClientSecret]   = useState('')
  const [setupLoading,   setSetupLoading]   = useState(false)
  const [setupError,     setSetupError]     = useState<string | null>(null)
  const [connectingLink, setConnectingLink] = useState<string | null>(null)
  const [hideBalance,    setHideBalance]    = useState(false)
  const [showImport,     setShowImport]     = useState(false)
  const [importFile,     setImportFile]     = useState<File | null>(null)
  const [importing,      setImporting]      = useState(false)
  const [importResult,   setImportResult]   = useState<{ ok: boolean; inserted?: number; skipped?: number; format?: string; error?: string } | null>(null)
  const [dragOver,       setDragOver]       = useState(false)
  const [currentMonth,   setCurrentMonth]   = useState(() => {
    const n = new Date()
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`
  })

  const loadStatus = useCallback(async () => {
    const res  = await fetch('/api/bank/connect')
    const json = await res.json()
    setHasCreds(json.has_credentials ?? false)
    setConnections(json.connections ?? [])
  }, [])

  const loadData = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/bank/transactions?month=${currentMonth}&limit=200`)
    if (res.ok) {
      const d = await res.json()
      setSummary({ income: d.income, expenses: d.expenses, balance: d.balance, transactions: d.transactions ?? [] })
    }
    setLoading(false)
  }, [currentMonth])

  useEffect(() => { loadStatus(); loadData() }, [loadStatus, loadData])

  async function handleSaveCredentials() {
    if (!clientId || !clientSecret) return
    setSetupLoading(true); setSetupError(null)
    const res  = await fetch('/api/bank/connect', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'save_credentials', client_id: clientId, client_secret: clientSecret }),
    })
    const json = await res.json()
    setSetupLoading(false)
    if (!json.ok) { setSetupError(json.error ?? 'Fout'); return }
    setShowSetup(false); setHasCreds(true)
  }

  async function handleConnectIng() {
    setSyncing(true)
    const res  = await fetch('/api/bank/connect', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'connect_ing' }),
    })
    const json = await res.json()
    setSyncing(false)
    if (json.link) setConnectingLink(json.link)
    await loadStatus()
  }

  async function handleImport() {
    if (!importFile) return
    setImporting(true); setImportResult(null)
    const form = new FormData()
    form.append('file', importFile)
    const res  = await fetch('/api/bank/import', { method: 'POST', body: form })
    const json = await res.json()
    setImporting(false)
    setImportResult(json)
    if (json.ok) { setImportFile(null); await loadData() }
  }

  async function handleSync() {
    setSyncing(true)
    await fetch('/api/bank/sync', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
    setSyncing(false)
    await loadData(); await loadStatus()
  }

  const catSpend: Record<string, number> = {}
  for (const tx of (summary?.transactions ?? [])) {
    if (tx.direction === 'debet') catSpend[tx.category] = (catSpend[tx.category] ?? 0) + tx.amount
  }

  const activeConn  = connections.find(c => c.status === 'active')
  const pendingConn = connections.find(c => c.status === 'pending')

  return (
    <div className="space-y-5 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-white">Dyme OS</h1>
          <p className="text-xs text-white/50 mt-0.5">Persoonlijk financieel overzicht · ING privérekening</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setHideBalance(!hideBalance)} className="text-white/40 hover:text-white/60 p-1.5">
            {hideBalance ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
          <button onClick={() => { setShowImport(!showImport); setImportResult(null) }}
            className="flex items-center gap-1.5 bg-white/5 hover:bg-white/10 text-white/70 text-xs px-3 py-2 rounded-lg">
            <Upload size={12} /> Importeren
          </button>
          {activeConn && (
            <button onClick={handleSync} disabled={syncing} className="flex items-center gap-1.5 bg-white/5 hover:bg-white/10 text-white/70 text-xs px-3 py-2 rounded-lg">
              <RefreshCw size={12} className={syncing ? 'animate-spin' : ''} /> Sync
            </button>
          )}
        </div>
      </div>

      {/* Verbindingsstatus */}
      {(!hasCreds || connections.length === 0) ? (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-5 space-y-4">
          <div className="flex items-start gap-3">
            <AlertCircle size={16} className="text-amber-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-white">ING koppeling configureren</p>
              <p className="text-xs text-white/55 mt-1">Tink (by Visa) PSD2 Open Banking verbinden met je ING privérekening.</p>
            </div>
          </div>
          {!showSetup ? (
            <div className="flex gap-2 flex-wrap">
              <button onClick={() => setShowSetup(true)} className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-black text-xs font-medium px-4 py-2 rounded-lg">
                <Settings size={11} /> Tink koppelen
              </button>
              <a href="https://console.tink.com/register" target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-amber-400 px-3 py-2">
                Tink account aanmaken <ExternalLink size={10} />
              </a>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-[10px] text-white/40">Vul je Tink Console credentials in (console.tink.com → App settings → Credentials)</p>
              <input type="text" placeholder="Client ID" value={clientId} onChange={e => setClientId(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:border-indigo-500/50 font-mono" />
              <input type="password" placeholder="Client Secret" value={clientSecret} onChange={e => setClientSecret(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:border-indigo-500/50 font-mono" />
              {setupError && <p className="text-xs text-red-400">{setupError}</p>}
              <div className="flex gap-2">
                <button onClick={() => setShowSetup(false)} className="text-xs text-white/50 px-3 py-2">Annuleren</button>
                <button onClick={handleSaveCredentials} disabled={setupLoading || !clientId || !clientSecret}
                  className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-medium px-4 py-2 rounded-lg">
                  {setupLoading && <RefreshCw size={11} className="animate-spin" />} Opslaan & testen
                </button>
              </div>
            </div>
          )}
        </div>
      ) : pendingConn && !activeConn ? (
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-5 space-y-3">
          <div className="flex items-center gap-2">
            <AlertCircle size={15} className="text-blue-400" />
            <p className="text-sm font-medium text-white">ING autorisatie vereist</p>
          </div>
          <p className="text-xs text-white/55">Klik hieronder om je ING-rekening te autoriseren. Eenmalig.</p>
          {connectingLink ? (
            <a href={connectingLink} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium px-4 py-2 rounded-lg">
              <ExternalLink size={11} /> ING autoriseren
            </a>
          ) : (
            <button onClick={handleConnectIng} disabled={syncing}
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium px-4 py-2 rounded-lg">
              {syncing ? <RefreshCw size={11} className="animate-spin" /> : <Link size={11} />} ING verbinden
            </button>
          )}
        </div>
      ) : activeConn ? (
        <div className="flex items-center gap-3 bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-3">
          <CheckCircle size={13} className="text-green-400" />
          <div className="flex-1">
            <p className="text-xs font-medium text-green-400">ING verbonden</p>
            {activeConn.iban && <p className="text-[10px] text-white/50 font-mono">{activeConn.iban}</p>}
          </div>
          {activeConn.last_sync_at && <p className="text-[10px] text-white/40">{new Date(activeConn.last_sync_at).toLocaleDateString('nl-NL')}</p>}
        </div>
      ) : null}

      {/* Import panel */}
      {showImport && (
        <div className="bg-white/[0.04] border border-white/10 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-white">Importeer bankafschrift</p>
            <button onClick={() => { setShowImport(false); setImportFile(null); setImportResult(null) }}>
              <X size={14} className="text-white/40 hover:text-white/70" />
            </button>
          </div>
          <p className="text-xs text-white/50">Ondersteunt MT940, CSV (ING / ABN AMRO / Dyme) en PDF rekeningafschriften.</p>

          {/* Drag & drop zone */}
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => {
              e.preventDefault(); setDragOver(false)
              const f = e.dataTransfer.files[0]
              if (f) { setImportFile(f); setImportResult(null) }
            }}
            className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer ${
              dragOver ? 'border-indigo-500 bg-indigo-500/10' : 'border-white/10 hover:border-white/20'
            }`}
            onClick={() => document.getElementById('import-file-input')?.click()}
          >
            <input
              id="import-file-input"
              type="file"
              accept=".mt940,.mta,.sta,.mt9,.csv,.txt,.pdf,.xlsx,.xls"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) { setImportFile(f); setImportResult(null) } }}
            />
            {importFile ? (
              <div className="flex items-center justify-center gap-2">
                <FileText size={16} className="text-indigo-400" />
                <span className="text-sm text-white">{importFile.name}</span>
                <span className="text-xs text-white/40">({(importFile.size / 1024).toFixed(1)} KB)</span>
              </div>
            ) : (
              <>
                <Upload size={20} className="mx-auto text-white/30 mb-2" />
                <p className="text-xs text-white/50">Sleep bestand hierheen of klik om te selecteren</p>
                <p className="text-[10px] text-white/30 mt-1">.mt940 · .csv · .xlsx · .pdf · .txt</p>
              </>
            )}
          </div>

          {/* Resultaat */}
          {importResult && (
            <div className={`rounded-lg px-4 py-3 text-xs ${importResult.ok ? 'bg-green-500/10 border border-green-500/20' : 'bg-red-500/10 border border-red-500/20'}`}>
              {importResult.ok ? (
                <div className="flex items-center gap-2">
                  <CheckCircle size={13} className="text-green-400" />
                  <span className="text-green-300">
                    {importResult.inserted} transacties geïmporteerd · {importResult.skipped} al aanwezig · Formaat: {importResult.format}
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <AlertCircle size={13} className="text-red-400" />
                  <span className="text-red-300">{importResult.error}</span>
                </div>
              )}
            </div>
          )}

          <div className="flex gap-2">
            <button onClick={() => { setShowImport(false); setImportFile(null); setImportResult(null) }}
              className="text-xs text-white/50 px-3 py-2">Sluiten</button>
            <button onClick={handleImport} disabled={importing || !importFile}
              className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-medium px-5 py-2 rounded-lg">
              {importing ? <RefreshCw size={11} className="animate-spin" /> : <Upload size={11} />}
              {importing ? 'Importeren…' : 'Importeren'}
            </button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-white/5">
        {(['overzicht', 'transacties', 'budgetten'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-xs font-medium capitalize transition-colors ${
              activeTab === tab ? 'text-white border-b-2 border-indigo-500' : 'text-white/50 hover:text-white/70'
            }`}>{tab}</button>
        ))}
      </div>

      {/* Maand selector */}
      <div className="flex items-center gap-2">
        <Calendar size={12} className="text-white/40" />
        <input type="month" value={currentMonth} onChange={e => setCurrentMonth(e.target.value)}
          className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none" />
      </div>

      {/* Overzicht tab */}
      {activeTab === 'overzicht' && (
        <div className="space-y-4">
          {loading ? (
            <div className="grid grid-cols-3 gap-3">{[...Array(3)].map((_,i) => <div key={i} className="bg-white/[0.06] border border-white/5 rounded-xl p-4 h-20 animate-pulse" />)}</div>
          ) : summary ? (
            <>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-white/[0.06] border border-green-500/20 rounded-xl p-4">
                  <p className="text-[10px] text-white/50 uppercase tracking-wider mb-2">Inkomsten</p>
                  <p className="text-lg font-semibold text-green-400">{hideBalance ? '••••' : fmt(summary.income)}</p>
                </div>
                <div className="bg-white/[0.06] border border-red-500/20 rounded-xl p-4">
                  <p className="text-[10px] text-white/50 uppercase tracking-wider mb-2">Uitgaven</p>
                  <p className="text-lg font-semibold text-red-400">{hideBalance ? '••••' : fmt(summary.expenses)}</p>
                </div>
                <div className={`bg-white/[0.06] border rounded-xl p-4 ${summary.balance >= 0 ? 'border-indigo-500/20' : 'border-red-500/20'}`}>
                  <p className="text-[10px] text-white/50 uppercase tracking-wider mb-2">Saldo maand</p>
                  <p className={`text-lg font-semibold ${summary.balance >= 0 ? 'text-indigo-400' : 'text-red-400'}`}>{hideBalance ? '••••' : fmt(summary.balance)}</p>
                </div>
              </div>

              <div className="bg-white/[0.04] border border-white/5 rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-white/5"><p className="text-xs font-medium text-white">Uitgaven per categorie</p></div>
                <div className="divide-y divide-white/5">
                  {Object.entries(catSpend).sort(([,a],[,b]) => b - a).slice(0, 8).map(([cat, amount]) => {
                    const pct = summary.expenses > 0 ? (amount / summary.expenses) * 100 : 0
                    return (
                      <div key={cat} className="flex items-center gap-3 px-4 py-2.5">
                        <span>{CAT_ICONS[cat] ?? '💰'}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between mb-1">
                            <span className="text-xs text-white capitalize">{cat}</span>
                            <span className="text-xs font-medium text-white">{hideBalance ? '••' : fmt(amount)}</span>
                          </div>
                          <div className="h-1 bg-white/5 rounded-full"><div className="h-1 bg-indigo-500 rounded-full" style={{ width: `${Math.min(pct,100)}%` }} /></div>
                        </div>
                        <span className="text-[10px] text-white/40 w-8 text-right">{pct.toFixed(0)}%</span>
                      </div>
                    )
                  })}
                  {Object.keys(catSpend).length === 0 && <p className="text-center text-xs text-white/30 py-8">Geen transacties</p>}
                </div>
              </div>

              <div className="bg-white/[0.04] border border-white/5 rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-white/5 flex justify-between">
                  <p className="text-xs font-medium text-white">Recente transacties</p>
                  <button onClick={() => setActiveTab('transacties')} className="text-[10px] text-indigo-400 flex items-center gap-0.5">Alles <ChevronRight size={10} /></button>
                </div>
                <div className="divide-y divide-white/5">
                  {summary.transactions.slice(0,15).map(tx => (
                    <div key={tx.id} className="flex items-center gap-3 px-4 py-2.5">
                      <span>{CAT_ICONS[tx.category] ?? '💰'}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-white truncate">{tx.creditor_name ?? tx.debtor_name ?? tx.description}</p>
                        <p className="text-[10px] text-white/40">{fmtDate(tx.booking_date)} · {tx.category}</p>
                      </div>
                      <p className={`text-xs font-medium ${tx.direction === 'credit' ? 'text-green-400' : 'text-white'}`}>
                        {tx.direction === 'credit' ? '+' : '-'}{hideBalance ? '••' : fmt(tx.amount)}
                      </p>
                    </div>
                  ))}
                  {summary.transactions.length === 0 && <p className="text-center text-xs text-white/30 py-8">Geen transacties</p>}
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center py-12 text-white/30 gap-2">
              <Coins size={28} className="opacity-50" />
              <p className="text-xs">Sync je ING-rekening voor data</p>
              {activeConn && <button onClick={handleSync} className="text-xs text-indigo-400 mt-1">Sync nu</button>}
            </div>
          )}
        </div>
      )}

      {/* Transacties tab */}
      {activeTab === 'transacties' && (
        <div className="bg-white/[0.04] border border-white/5 rounded-xl overflow-hidden">
          <div className="divide-y divide-white/5">
            {(summary?.transactions ?? []).map(tx => (
              <div key={tx.id} className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.02]">
                <span>{CAT_ICONS[tx.category] ?? '💰'}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-white truncate">{tx.creditor_name ?? tx.debtor_name ?? tx.description}</p>
                  <p className="text-[10px] text-white/40 truncate">{tx.description}</p>
                  <p className="text-[9px] text-white/30">{fmtDate(tx.booking_date)} · {tx.category}</p>
                </div>
                <p className={`text-sm font-medium ${tx.direction === 'credit' ? 'text-green-400' : 'text-white'}`}>
                  {tx.direction === 'credit' ? '+' : '-'}{hideBalance ? '••' : fmtFull(tx.amount)}
                </p>
              </div>
            ))}
            {(summary?.transactions ?? []).length === 0 && <p className="text-center text-xs text-white/30 py-12">Geen transacties</p>}
          </div>
        </div>
      )}

      {/* Budgetten tab */}
      {activeTab === 'budgetten' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {Object.entries(CAT_ICONS).map(([cat, icon]) => {
            const spent = catSpend[cat] ?? 0
            const budget = 500
            const pct = budget > 0 ? Math.min((spent / budget) * 100, 100) : 0
            const over = spent > budget
            return (
              <div key={cat} className="bg-white/[0.04] border border-white/5 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2"><span>{icon}</span><span className="text-xs font-medium text-white capitalize">{cat}</span></div>
                  <span className={`text-xs font-medium ${over ? 'text-red-400' : 'text-white/70'}`}>{hideBalance ? '••' : fmt(spent)}</span>
                </div>
                <div className="h-1.5 bg-white/5 rounded-full">
                  <div className={`h-1.5 rounded-full ${over ? 'bg-red-500' : 'bg-indigo-500'}`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
