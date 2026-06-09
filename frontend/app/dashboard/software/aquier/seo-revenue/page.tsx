import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { TrendingUp, FileText, CreditCard, Users, Info, ExternalLink } from 'lucide-react'
import SeoRevenueTable, { type SeoRevenueRow } from './SeoRevenueTable'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const SB  = () => process.env.NEXT_PUBLIC_SUPABASE_URL!
const SVC = () => process.env.SUPABASE_SERVICE_ROLE_KEY!
const HDR = () => ({
  apikey: SVC(),
  Authorization: `Bearer ${SVC()}`,
  'Accept-Profile': 'vastgoed_core',
  Accept: 'application/json',
})

async function fetchRevenue(): Promise<SeoRevenueRow[]> {
  try {
    const res = await fetch(
      `${SB()}/rest/v1/v_seo_revenue?select=*&order=revenue_score.desc,sessions.desc`,
      { headers: HDR(), cache: 'no-store' }
    )
    if (!res.ok) return []
    return await res.json()
  } catch {
    return []
  }
}

async function fetchGate(): Promise<{ ok: number; total: number }> {
  try {
    const res = await fetch(
      `${SB()}/rest/v1/v_seo_cta_gate?select=conversion_path_ok`,
      { headers: HDR(), cache: 'no-store' }
    )
    if (!res.ok) return { ok: 0, total: 0 }
    const rows: { conversion_path_ok: boolean }[] = await res.json()
    return { ok: rows.filter((r) => r.conversion_path_ok).length, total: rows.length }
  } catch {
    return { ok: 0, total: 0 }
  }
}

function fmtEur(n: number): string {
  if (!n || n === 0) return '€ 0'
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)
}

export default async function AquierSeoRevenuePage() {
  // Auth-gate: dashboard is intern/admin — niet-ingelogd → login.
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [rows, gate] = await Promise.all([fetchRevenue(), fetchGate()])

  const sum = (k: keyof SeoRevenueRow) => rows.reduce((s, r) => s + (Number(r[k]) || 0), 0)
  const totals = {
    pages: rows.length,
    total_revenue_eur: sum('total_revenue_eur'),
    report_revenue_eur: sum('report_revenue_eur'),
    membership_mrr_eur: sum('membership_mrr_eur'),
    sessions: sum('sessions'),
    lead_signals: sum('lead_signals'),
  }
  const topBy = (k: keyof SeoRevenueRow) =>
    [...rows].sort((a, b) => (Number(b[k]) || 0) - (Number(a[k]) || 0)).filter((r) => Number(r[k]) > 0).slice(0, 10)

  const TOPS: { title: string; key: keyof SeoRevenueRow; eur?: boolean }[] = [
    { title: 'Top 10 — Omzet', key: 'total_revenue_eur', eur: true },
    { title: 'Top 10 — Leads', key: 'lead_signals' },
    { title: 'Top 10 — Financiering-intentie', key: 'financing_signals' },
    { title: 'Top 10 — Rapportverkopen', key: 'report_sales' },
    { title: 'Top 10 — Memberships', key: 'membership_sales' },
  ]

  const KPIS = [
    { label: 'Totale SEO-omzet', value: fmtEur(totals.total_revenue_eur), Icon: TrendingUp },
    { label: 'SEO-rapportomzet', value: fmtEur(totals.report_revenue_eur), Icon: FileText },
    { label: 'SEO-MRR', value: fmtEur(totals.membership_mrr_eur), Icon: CreditCard },
    { label: 'Sessies / Leads', value: `${totals.sessions} / ${totals.lead_signals}`, Icon: Users },
  ]

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <div className="max-w-7xl mx-auto px-6 py-10">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-white/40 mb-2">
              Software · Aquier · SEO Revenue
            </div>
            <h1 className="text-3xl font-bold">SEO Revenue Dashboard</h1>
            <p className="text-white/50 mt-1 text-sm">
              KPI = omzet, niet verkeer. Attributie = first-touch op <code className="text-white/60">/kennisbank/</code>-landing → user → omzet.
            </p>
          </div>
          <a
            href="https://aquier.com/admin/seo-revenue"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium bg-violet-500/15 text-violet-300 border border-violet-500/30 hover:bg-violet-500/25"
          >
            Aquier admin-bron <ExternalLink size={12} />
          </a>
        </div>

        {/* GSC pending-banner */}
        <div className="flex items-start gap-2 text-xs text-white/50 bg-white/[0.03] border border-white/10 rounded-md px-3 py-2 mb-6">
          <Info size={14} className="mt-0.5 shrink-0 text-white/40" />
          <span>
            Impressies/klikken/CTR (Google Search Console) nog niet beschikbaar — connector pending. CTA-gate:{' '}
            <span className="text-white/70">{gate.ok}/{gate.total}</span> conversiepad-ok.
          </span>
        </div>

        {/* KPI strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {KPIS.map((k) => (
            <div key={k.label} className="p-5 rounded-lg border border-white/10 bg-white/[0.03]">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs uppercase tracking-widest text-white/40">{k.label}</span>
                <k.Icon size={14} className="text-white/40" />
              </div>
              <p className="text-2xl font-bold">{k.value}</p>
            </div>
          ))}
        </div>

        {/* Top-10 lijsten */}
        <div className="grid md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
          {TOPS.map((t) => {
            const items = topBy(t.key)
            return (
              <div key={t.title} className="rounded-lg border border-white/10 bg-white/[0.02] p-4">
                <div className="text-xs font-semibold text-white/70 mb-2">{t.title}</div>
                <ol className="space-y-1 text-xs">
                  {items.length === 0 && <li className="text-white/30">— nog geen data —</li>}
                  {items.map((r, i) => (
                    <li key={r.slug} className="flex justify-between gap-2">
                      <span className="truncate text-white/55">{i + 1}. {r.slug}</span>
                      <span className="font-medium text-white/90">
                        {t.eur ? fmtEur(Number(r[t.key])) : Number(r[t.key])}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            )
          })}
        </div>

        {/* Interactieve tabel (sort / CLI-R-filter / CSV) */}
        <SeoRevenueTable rows={rows} />

        {rows.length === 0 && (
          <p className="mt-6 text-center text-white/30 text-sm">
            Geen rijen uit <code className="text-xs bg-white/5 border border-white/10 rounded px-1 py-0.5">vastgoed_core.v_seo_revenue</code> —
            verifieer de view + SERVICE_ROLE-env. Echte 0/NULL-waarden worden getoond, geen mockdata.
          </p>
        )}
      </div>
    </div>
  )
}
