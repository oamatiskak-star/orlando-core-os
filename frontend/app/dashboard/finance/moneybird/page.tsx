'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  RefreshCw, CheckCircle, AlertCircle, Clock, Send,
  TrendingUp, TrendingDown, Euro, FileText, Wifi, WifiOff,
  ChevronDown, ChevronUp, Building2, Calendar,
} from 'lucide-react'

type Company = {
  company_id: string
  company_name: string
  administration_id: string
  digit_email: string | null
  connected: boolean
  last_sync_at: string | null
  error?: string
}

type Invoice = {
  id: string
  invoice_id: string
  invoice_date: string
  due_date: string | null
  state: string
  contact?: {
    company_name: string
    email?: string
  }
  total_price_incl_tax: string
  total_price_excl_tax: string
  paid_at: string | null
}

type Summary = {
  total_open: number
  total_overdue: number
  total_paid: number
  amount_open: number
  amount_overdue: number
  amount_paid_ytd: number
  oldest_overdue_days: number
}

type LiveData = {
  company: { company_id: string; company_name: string; digit_email: string | null }
  invoices: {
    open: Invoice[]
    overdue: Invoice[]
    paid: Invoice[]
    late: Invoice[]
  }
  summary: Summary
  error?: string
}

const COMPANIES = [
  { id: 'MODIWERIJO',       label: 'Modiwerijo FM BV',    short: 'MODI' },
  { id: 'BOUWPROFFS',       label: 'Bouwproffs BV',       short: 'BOUW' },
  { id: 'BOUWPROFFS_HOLDING', label: 'Bouwproffs Holding', short: 'HOLD' },
]

function fmt(n: number) {
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)
}

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Intl.DateTimeFormat('nl-NL', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(d))
}

function daysOverdue(dueDate: string | null): number {
  if (!dueDate) return 0
  const diff = Date.now() - new Date(dueDate).getTime()
  return Math.max(0, Math.floor(diff / 86400000))
}

function StatCard({ label, value, sub, color }: {
  label: string; value: string; sub?: string; color: 'green' | 'red' | 'amber' | 'blue' | 'white'
}) {
  const colorMap = {
    green: 'text-green-400 border-green-500/20',
    red:   'text-red-400 border-red-500/20',
    amber: 'text-amber-400 border-amber-500/20',
    blue:  'text-blue-400 border-blue-500/20',
    white: 'text-white border-white/5',
  }
  const [textClass, borderClass] = colorMap[color].split(' ')
  return (
    <div className={`bg-white/[0.06] border ${borderClass} rounded-xl p-4`}>
      <p className="text-[10px] font-medium text-white/50 uppercase tracking-wider mb-2">{label}</p>
      <p className={`text-xl font-semibold ${textClass}`}>{value}</p>
      {sub && <p className="text-[11px] text-white/50 mt-1">{sub}</p>}
    </div>
  )
}

function InvoiceRow({ inv, companyId, onFollowup }: {
  inv: Invoice
  companyId: string
  onFollowup: (inv: Invoice) => void
}) {
  const days = daysOverdue(inv.due_date)
  const amount = parseFloat(inv.total_price_incl_tax ?? '0')
  const isOverdue = days > 0 && inv.state !== 'paid'

  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5 hover:bg-white/[0.03] transition-colors">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-white truncate">
            {inv.contact?.company_name ?? 'Onbekende relatie'}
          </span>
          <span className="text-[10px] text-white/40 font-mono">{inv.invoice_id}</span>
        </div>
        <div className="flex items-center gap-3 mt-0.5">
          <span className="text-[10px] text-white/40">Factuur: {fmtDate(inv.invoice_date)}</span>
          {inv.due_date && (
            <span className={`text-[10px] ${isOverdue ? 'text-red-400' : 'text-white/40'}`}>
              Vervalt: {fmtDate(inv.due_date)}
            </span>
          )}
          {isOverdue && (
            <span className="text-[10px] font-medium text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded">
              {days}d te laat
            </span>
          )}
        </div>
      </div>
      <div className="text-right flex-shrink-0">
        <p className="text-sm font-semibold text-white">{fmt(amount)}</p>
        <p className="text-[10px] text-white/40 capitalize">{inv.state}</p>
      </div>
      {inv.state !== 'paid' && (
        <button
          onClick={() => onFollowup(inv)}
          className="flex-shrink-0 flex items-center gap-1 bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-400 text-[10px] font-medium px-2.5 py-1.5 rounded-lg transition-colors"
        >
          <Send size={10} />
          Follow-up
        </button>
      )}
    </div>
  )
}

function FollowupModal({ inv, companyId, onClose, onConfirm }: {
  inv: Invoice
  companyId: string
  onClose: () => void
  onConfirm: () => void
}) {
  const [type, setType] = useState<'herinnering' | 'aanmaning' | 'incasso'>('herinnering')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const days = daysOverdue(inv.due_date)

  async function send() {
    setLoading(true)
    await fetch('/api/finance/moneybird/followup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        company_id:   companyId,
        invoice_id:   inv.id,
        invoice_nr:   inv.invoice_id,
        contact_name: inv.contact?.company_name ?? '',
        amount_incl:  parseFloat(inv.total_price_incl_tax ?? '0'),
        due_date:     inv.due_date,
        days_overdue: days,
        followup_type: type,
        notes,
      }),
    })
    setLoading(false)
    onConfirm()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-[#1e1e32] border border-white/10 rounded-2xl p-6 w-full max-w-md space-y-4">
        <h2 className="text-sm font-semibold text-white">Follow-up registreren</h2>

        <div className="bg-white/5 rounded-xl p-3 space-y-1">
          <p className="text-xs font-medium text-white">{inv.contact?.company_name ?? '—'}</p>
          <p className="text-[10px] text-white/50">Factuur {inv.invoice_id} · {fmt(parseFloat(inv.total_price_incl_tax ?? '0'))}</p>
          {days > 0 && <p className="text-[10px] text-red-400">{days} dagen te laat</p>}
        </div>

        <div>
          <label className="text-[10px] text-white/50 uppercase tracking-wider">Type</label>
          <div className="flex gap-2 mt-1.5">
            {(['herinnering', 'aanmaning', 'incasso'] as const).map(t => (
              <button
                key={t}
                onClick={() => setType(t)}
                className={`flex-1 text-xs py-2 rounded-lg capitalize transition-colors ${
                  type === t
                    ? 'bg-indigo-500 text-white'
                    : 'bg-white/5 text-white/60 hover:bg-white/10'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-[10px] text-white/50 uppercase tracking-wider">Notitie (optioneel)</label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={2}
            placeholder="Telefonisch contact gehad..."
            className="mt-1.5 w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-white/30 resize-none focus:outline-none focus:border-indigo-500/50"
          />
        </div>

        <div className="flex gap-2 pt-1">
          <button
            onClick={onClose}
            className="flex-1 bg-white/5 hover:bg-white/10 text-white/70 text-xs py-2.5 rounded-lg transition-colors"
          >
            Annuleren
          </button>
          <button
            onClick={send}
            disabled={loading}
            className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs py-2.5 rounded-lg transition-colors flex items-center justify-center gap-1.5"
          >
            {loading ? <RefreshCw size={12} className="animate-spin" /> : <Send size={12} />}
            Registreren
          </button>
        </div>
      </div>
    </div>
  )
}

export default function MoneybirdPage() {
  const [activeCompany, setActiveCompany]   = useState('MODIWERIJO')
  const [companies, setCompanies]           = useState<Company[]>([])
  const [liveData, setLiveData]             = useState<LiveData | null>(null)
  const [loadingCompanies, setLoadingCompanies] = useState(true)
  const [loadingLive, setLoadingLive]       = useState(false)
  const [activeTab, setActiveTab]           = useState<'open' | 'overdue' | 'paid'>('open')
  const [followupInvoice, setFollowupInvoice] = useState<Invoice | null>(null)
  const [successMsg, setSuccessMsg]         = useState<string | null>(null)
  const [showDigit, setShowDigit]           = useState(false)

  const loadCompanies = useCallback(async () => {
    setLoadingCompanies(true)
    try {
      const res = await fetch('/api/finance/moneybird/companies')
      const json = await res.json()
      setCompanies(json.companies ?? [])
    } catch {
      setCompanies([])
    } finally {
      setLoadingCompanies(false)
    }
  }, [])

  const loadLive = useCallback(async (companyId: string) => {
    setLoadingLive(true)
    setLiveData(null)
    try {
      const res = await fetch(`/api/finance/moneybird/live?company=${companyId}`)
      const json = await res.json()
      setLiveData(json)
    } catch {
      setLiveData(null)
    } finally {
      setLoadingLive(false)
    }
  }, [])

  useEffect(() => { loadCompanies() }, [loadCompanies])
  useEffect(() => { loadLive(activeCompany) }, [activeCompany, loadLive])

  function handleCompanySwitch(id: string) {
    setActiveCompany(id)
    setActiveTab('open')
  }

  function handleFollowupConfirm() {
    setFollowupInvoice(null)
    setSuccessMsg('Follow-up geregistreerd')
    setTimeout(() => setSuccessMsg(null), 3000)
  }

  const activeConf = companies.find(c => c.company_id === activeCompany)
  const invoiceList = liveData?.invoices[activeTab] ?? []
  const s = liveData?.summary

  return (
    <div className="space-y-5 pb-8">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-white">Moneybird Live</h1>
          <p className="text-xs text-white/50 mt-0.5">Directe koppeling · live factuurdata per BV</p>
        </div>
        <button
          onClick={() => loadLive(activeCompany)}
          disabled={loadingLive}
          className="flex items-center gap-1.5 bg-white/5 hover:bg-white/10 text-white/70 text-xs px-3 py-2 rounded-lg transition-colors"
        >
          <RefreshCw size={12} className={loadingLive ? 'animate-spin' : ''} />
          Verversen
        </button>
      </div>

      {/* Success toast */}
      {successMsg && (
        <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-3">
          <CheckCircle size={14} className="text-green-400" />
          <span className="text-xs text-green-400">{successMsg}</span>
        </div>
      )}

      {/* Company tabs + verbindingsstatus */}
      <div className="bg-white/[0.04] border border-white/5 rounded-xl overflow-hidden">
        <div className="flex border-b border-white/5">
          {COMPANIES.map(c => {
            const conf = companies.find(x => x.company_id === c.id)
            const isActive = activeCompany === c.id
            return (
              <button
                key={c.id}
                onClick={() => handleCompanySwitch(c.id)}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-xs font-medium transition-colors ${
                  isActive
                    ? 'bg-indigo-500/10 text-indigo-400 border-b-2 border-indigo-500'
                    : 'text-white/50 hover:text-white/70 hover:bg-white/5'
                }`}
              >
                <Building2 size={12} />
                {c.label}
                {loadingCompanies ? null : conf?.connected ? (
                  <Wifi size={10} className="text-green-400" />
                ) : (
                  <WifiOff size={10} className="text-red-400" />
                )}
              </button>
            )
          })}
        </div>

        {/* Company info */}
        {activeConf && (
          <div className="flex items-center gap-4 px-4 py-2.5 bg-white/[0.02] border-b border-white/5">
            <div className="flex items-center gap-1.5">
              {activeConf.connected ? (
                <CheckCircle size={11} className="text-green-400" />
              ) : (
                <AlertCircle size={11} className="text-red-400" />
              )}
              <span className={`text-[10px] font-medium ${activeConf.connected ? 'text-green-400' : 'text-red-400'}`}>
                {activeConf.connected ? 'Verbonden' : 'Niet verbonden'}
              </span>
            </div>
            <span className="text-[10px] text-white/40">ID: {activeConf.administration_id}</span>
            {activeConf.last_sync_at && (
              <span className="text-[10px] text-white/40 flex items-center gap-1">
                <Clock size={9} />
                Laatste sync: {fmtDate(activeConf.last_sync_at)}
              </span>
            )}
            {activeConf.digit_email && (
              <button
                onClick={() => setShowDigit(!showDigit)}
                className="text-[10px] text-indigo-400 ml-auto flex items-center gap-0.5"
              >
                Digit brievenbus {showDigit ? <ChevronUp size={9} /> : <ChevronDown size={9} />}
              </button>
            )}
          </div>
        )}
        {showDigit && activeConf?.digit_email && (
          <div className="px-4 py-2 bg-indigo-500/5 border-b border-white/5">
            <p className="text-[10px] text-white/60">Stuur facturen naar: <span className="text-indigo-400 font-mono">{activeConf.digit_email}</span></p>
          </div>
        )}
      </div>

      {/* KPI summary */}
      {loadingLive ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white/[0.06] border border-white/5 rounded-xl p-4 animate-pulse h-[76px]" />
          ))}
        </div>
      ) : s ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard
            label="Openstaand"
            value={fmt(s.amount_open)}
            sub={`${s.total_open} facturen`}
            color="amber"
          />
          <StatCard
            label="Te laat"
            value={fmt(s.amount_overdue)}
            sub={s.oldest_overdue_days > 0 ? `max. ${s.oldest_overdue_days}d te laat` : 'geen'}
            color={s.total_overdue > 0 ? 'red' : 'green'}
          />
          <StatCard
            label="Betaald dit jaar"
            value={fmt(s.amount_paid_ytd)}
            sub={`${s.total_paid} facturen`}
            color="green"
          />
          <StatCard
            label="Open facturen"
            value={s.total_open.toString()}
            sub={s.total_overdue > 0 ? `${s.total_overdue} vervallen` : 'alles op tijd'}
            color={s.total_overdue > 0 ? 'red' : 'blue'}
          />
        </div>
      ) : liveData?.error ? (
        <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
          <AlertCircle size={14} className="text-red-400 flex-shrink-0" />
          <span className="text-xs text-red-400">{liveData.error}</span>
        </div>
      ) : null}

      {/* Invoice tabs */}
      {!loadingLive && liveData && (
        <div className="bg-white/[0.04] border border-white/5 rounded-xl overflow-hidden">
          <div className="flex border-b border-white/5">
            {([
              { key: 'open',    label: 'Open',    count: liveData.invoices.open.length },
              { key: 'overdue', label: 'Te laat',  count: liveData.invoices.overdue.length },
              { key: 'paid',    label: 'Betaald',  count: liveData.invoices.paid.length },
            ] as const).map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-1.5 px-4 py-3 text-xs font-medium transition-colors ${
                  activeTab === tab.key
                    ? 'text-white bg-white/[0.04]'
                    : 'text-white/50 hover:text-white/70'
                }`}
              >
                {tab.label}
                {tab.count > 0 && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                    tab.key === 'overdue' && tab.count > 0
                      ? 'bg-red-500/20 text-red-400'
                      : 'bg-white/10 text-white/60'
                  }`}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {invoiceList.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-white/30">
              <FileText size={28} className="mb-2 opacity-50" />
              <p className="text-xs">Geen facturen in deze categorie</p>
            </div>
          ) : (
            <div>
              {invoiceList.map(inv => (
                <InvoiceRow
                  key={inv.id}
                  inv={inv}
                  companyId={activeCompany}
                  onFollowup={setFollowupInvoice}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Follow-up modal */}
      {followupInvoice && (
        <FollowupModal
          inv={followupInvoice}
          companyId={activeCompany}
          onClose={() => setFollowupInvoice(null)}
          onConfirm={handleFollowupConfirm}
        />
      )}
    </div>
  )
}
