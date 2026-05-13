'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  MOCK_INVOICES,
  MOCK_PAYMENTS,
  MOCK_REMINDERS,
  MOCK_TIMELINE,
} from '@/lib/finance/mock'
import type { FinInvoice, FinPayment, FinReminder, FinTimeline } from '@/lib/finance/types'
import {
  Mail,
  Phone,
  CheckCircle,
  AlertTriangle,
  Gavel,
  Clock,
  FileText,
  ArrowLeft,
  Eye,
} from 'lucide-react'

function fmt(amount: number) {
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(amount)
}

function eventIcon(type: string) {
  const map: Record<string, React.ReactNode> = {
    email_sent: <Mail size={13} className="text-blue-400" />,
    email_opened: <Eye size={13} className="text-purple-400" />,
    phone_call: <Phone size={13} className="text-green-400" />,
    paid: <CheckCircle size={13} className="text-green-400" />,
    overdue: <AlertTriangle size={13} className="text-amber-400" />,
    legal: <Gavel size={13} className="text-red-400" />,
    invoice_created: <FileText size={13} className="text-indigo-400" />,
  }
  return map[type] ?? <Clock size={13} className="text-white/50" />
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    open: 'bg-blue-500/10 text-blue-400',
    vervallen: 'bg-red-500/10 text-red-400',
    incasso: 'bg-amber-500/10 text-amber-400',
    betaald: 'bg-green-500/10 text-green-400',
  }
  return (
    <span className={`${map[status] ?? 'bg-white/5 text-white/65'} px-2.5 py-1 rounded-full text-xs font-medium capitalize`}>
      {status}
    </span>
  )
}

const WORKFLOW_STAGES = ['nieuw', 'herinnering_1', 'aanmaning_1', 'aanmaning_2', 'sommatie', 'incasso', 'afgerond']

export default function InvoiceDetailPage() {
  const params = useParams()
  const id = params.id as string

  const [invoice, setInvoice] = useState<FinInvoice | null>(null)
  const [payments, setPayments] = useState<FinPayment[]>([])
  const [reminders, setReminders] = useState<FinReminder[]>([])
  const [timeline, setTimeline] = useState<FinTimeline[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)

      if (id === 'demo' || id === 'inv-1') {
        const inv = MOCK_INVOICES[0]
        setInvoice(inv)
        setPayments(MOCK_PAYMENTS.filter((p) => p.invoice_id === inv.id))
        setReminders(MOCK_REMINDERS.filter((r) => r.invoice_id === inv.id))
        setTimeline(MOCK_TIMELINE.filter((t) => t.invoice_id === inv.id))
        setLoading(false)
        return
      }

      // Try mock first for mock IDs
      const mockInv = MOCK_INVOICES.find((i) => i.id === id)
      if (mockInv) {
        setInvoice(mockInv)
        setPayments(MOCK_PAYMENTS.filter((p) => p.invoice_id === id))
        setReminders(MOCK_REMINDERS.filter((r) => r.invoice_id === id))
        setTimeline(MOCK_TIMELINE.filter((t) => t.invoice_id === id))
        setLoading(false)
        return
      }

      try {
        const supabase = createClient()
        const [invRes, payRes, remRes, tlRes] = await Promise.all([
          supabase.from('fin_invoices').select('*, customer:fin_customers(*)').eq('id', id).single(),
          supabase.from('fin_payments').select('*').eq('invoice_id', id),
          supabase.from('fin_reminders').select('*').eq('invoice_id', id).order('sent_at', { ascending: false }),
          supabase.from('fin_timeline').select('*').eq('invoice_id', id).order('created_at', { ascending: true }),
        ])
        setInvoice(invRes.data as FinInvoice)
        setPayments((payRes.data ?? []) as FinPayment[])
        setReminders((remRes.data ?? []) as FinReminder[])
        setTimeline((tlRes.data ?? []) as FinTimeline[])
      } catch {
        // fallback
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <p className="text-xs text-white/50">Laden...</p>
      </div>
    )
  }

  if (!invoice) {
    return (
      <div className="flex flex-col items-center justify-center h-40 gap-3">
        <p className="text-xs text-white/50">Factuur niet gevonden</p>
        <Link href="/dashboard/finance/facturen" className="text-xs text-indigo-400 hover:text-indigo-300">
          Terug naar facturen
        </Link>
      </div>
    )
  }

  const stageIndex = WORKFLOW_STAGES.indexOf(invoice.workflow_stage)

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard/finance/facturen"
          className="border border-white/10 text-white/50 hover:text-white text-xs px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5"
        >
          <ArrowLeft size={12} />
          Terug
        </Link>
        <div className="flex items-center gap-3 flex-1">
          <h1 className="text-lg font-semibold text-white">{invoice.invoice_nr}</h1>
          <StatusBadge status={invoice.status} />
        </div>
        <div className="flex gap-2">
          <button className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium px-4 py-2 rounded-lg transition-colors">
            Stuur Herinnering
          </button>
          <button className="border border-white/10 text-white/50 hover:text-white text-xs px-4 py-2 rounded-lg transition-colors">
            Markeer Betaald
          </button>
          <button className="border border-amber-500/30 text-amber-400 hover:text-amber-300 text-xs px-4 py-2 rounded-lg transition-colors">
            Start Incasso
          </button>
          <button className="border border-red-500/30 text-red-400 hover:text-red-300 text-xs px-4 py-2 rounded-lg transition-colors">
            Juridisch
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {/* Left: detail + timeline */}
        <div className="col-span-2 space-y-4">
          {/* Invoice details */}
          <div className="bg-white/[0.06] border border-white/5 rounded-xl p-4 space-y-3">
            <h3 className="text-xs font-semibold text-white">Factuurgegevens</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[10px] text-white/50 uppercase tracking-wider mb-1">Klant</p>
                <p className="text-sm text-white font-medium">{invoice.customer?.name ?? 'Onbekend'}</p>
              </div>
              <div>
                <p className="text-[10px] text-white/50 uppercase tracking-wider mb-1">Bedrag incl. BTW</p>
                <p className="text-sm text-white font-medium">{fmt(invoice.amount_incl)}</p>
              </div>
              <div>
                <p className="text-[10px] text-white/50 uppercase tracking-wider mb-1">Uitgifte datum</p>
                <p className="text-sm text-white/70">{invoice.issued_at}</p>
              </div>
              <div>
                <p className="text-[10px] text-white/50 uppercase tracking-wider mb-1">Vervaldatum</p>
                <p className={`text-sm font-medium ${invoice.days_overdue > 0 ? 'text-red-400' : 'text-white/70'}`}>
                  {invoice.due_date}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-white/50 uppercase tracking-wider mb-1">Bedrag excl. BTW</p>
                <p className="text-sm text-white/70">{fmt(invoice.amount_excl)}</p>
              </div>
              <div>
                <p className="text-[10px] text-white/50 uppercase tracking-wider mb-1">BTW</p>
                <p className="text-sm text-white/70">{fmt(invoice.amount_vat)}</p>
              </div>
              {invoice.description && (
                <div className="col-span-2">
                  <p className="text-[10px] text-white/50 uppercase tracking-wider mb-1">Omschrijving</p>
                  <p className="text-sm text-white/60">{invoice.description}</p>
                </div>
              )}
            </div>
          </div>

          {/* Timeline */}
          <div className="bg-white/[0.06] border border-white/5 rounded-xl p-4">
            <h3 className="text-xs font-semibold text-white mb-4">Tijdlijn</h3>
            {timeline.length === 0 ? (
              <p className="text-xs text-white/50 py-4 text-center">Geen activiteiten</p>
            ) : (
              <div className="space-y-4">
                {timeline.map((ev) => (
                  <div key={ev.id} className="flex gap-3">
                    <div className="w-7 h-7 rounded-lg bg-white/[0.04] border border-white/5 flex items-center justify-center flex-shrink-0 mt-0.5">
                      {eventIcon(ev.event_type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-xs font-medium text-white">{ev.title}</p>
                          {ev.description && (
                            <p className="text-xs text-white/65 mt-0.5">{ev.description}</p>
                          )}
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-[10px] text-white/50">{new Date(ev.created_at).toLocaleDateString('nl-NL')}</p>
                          <p className="text-[10px] text-white/38">{new Date(ev.created_at).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}</p>
                        </div>
                      </div>
                      <span className="inline-block mt-1 bg-white/[0.04] text-white/50 text-[10px] px-2 py-0.5 rounded-full">
                        {ev.performed_by}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* Payments */}
          <div className="bg-white/[0.06] border border-white/5 rounded-xl p-4">
            <h3 className="text-xs font-semibold text-white mb-3">Betalingen</h3>
            {payments.length === 0 ? (
              <p className="text-xs text-white/50 py-2 text-center">Geen betalingen ontvangen</p>
            ) : (
              <div className="space-y-2">
                {payments.map((pay) => (
                  <div key={pay.id} className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-white/70">{pay.paid_at}</p>
                      <p className="text-[10px] text-white/50">{pay.method}</p>
                    </div>
                    <p className="text-xs font-medium text-green-400">{fmt(pay.amount)}</p>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-3 pt-3 border-t border-white/5 flex justify-between">
              <span className="text-xs text-white/65">Openstaand</span>
              <span className="text-xs font-semibold text-amber-400">
                {fmt(invoice.amount_incl - invoice.amount_paid)}
              </span>
            </div>
          </div>

          {/* Customer info */}
          <div className="bg-white/[0.06] border border-white/5 rounded-xl p-4">
            <h3 className="text-xs font-semibold text-white mb-3">Klantgegevens</h3>
            {invoice.customer ? (
              <div className="space-y-2.5">
                <p className="text-sm font-medium text-white">{invoice.customer.name}</p>
                {invoice.customer.email && (
                  <div className="flex items-center gap-2 text-xs text-white/50">
                    <Mail size={11} />
                    {invoice.customer.email}
                  </div>
                )}
                {invoice.customer.phone && (
                  <div className="flex items-center gap-2 text-xs text-white/50">
                    <Phone size={11} />
                    {invoice.customer.phone}
                  </div>
                )}
                <div className="flex items-center justify-between pt-1">
                  <span className="text-[10px] text-white/50">Score</span>
                  <span
                    className={`text-xs font-semibold ${
                      invoice.customer.score >= 80
                        ? 'text-green-400'
                        : invoice.customer.score >= 50
                          ? 'text-amber-400'
                          : 'text-red-400'
                    }`}
                  >
                    {invoice.customer.score}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-white/50">Geen klantgegevens</p>
            )}
          </div>

          {/* Workflow stage */}
          <div className="bg-white/[0.06] border border-white/5 rounded-xl p-4">
            <h3 className="text-xs font-semibold text-white mb-3">Workflow Stadium</h3>
            <div className="space-y-1.5">
              {WORKFLOW_STAGES.map((stage, i) => (
                <div key={stage} className="flex items-center gap-2">
                  <div
                    className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      i < stageIndex
                        ? 'bg-indigo-400'
                        : i === stageIndex
                          ? 'bg-indigo-500 ring-2 ring-indigo-500/30'
                          : 'bg-white/10'
                    }`}
                  />
                  <span
                    className={`text-[11px] ${
                      i === stageIndex ? 'text-white font-medium' : i < stageIndex ? 'text-indigo-400/60' : 'text-white/45'
                    }`}
                  >
                    {stage.replace(/_/g, ' ')}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Reminders */}
          {reminders.length > 0 && (
            <div className="bg-white/[0.06] border border-white/5 rounded-xl p-4">
              <h3 className="text-xs font-semibold text-white mb-3">Herinneringen</h3>
              <div className="space-y-2">
                {reminders.map((r) => (
                  <div key={r.id} className="space-y-0.5">
                    <p className="text-xs text-white/60">{r.subject}</p>
                    <div className="flex items-center gap-3 text-[10px] text-white/50">
                      <span>{r.sent_at}</span>
                      {r.opened_at && (
                        <span className="bg-green-500/10 text-green-400 px-1.5 py-0.5 rounded-full">Geopend</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
