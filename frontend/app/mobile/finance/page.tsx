import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import MobileFinanceClient from '@/components/mobile/MobileFinanceClient'

export const metadata: Metadata = { title: 'Finance OS' }
export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function MobileFinancePage() {
  const supabase      = await createClient()
  const adminSupabase = createAdminClient()

  const jaar = new Date().getFullYear()

  const [
    assetsRes,
    liabilitiesRes,
    txRes,
    catRes,
    ytdRes,
  ] = await Promise.allSettled([
    supabase.from('personal_assets').select('id,naam,categorie,waarde').order('waarde', { ascending: false }),
    supabase.from('personal_liabilities').select('id,naam,categorie,saldo,maandbedrag').order('saldo', { ascending: false }),
    adminSupabase
      .from('personal_transactions')
      .select('id,booking_date,amount,direction,category,description,creditor_name,debtor_name')
      .order('booking_date', { ascending: false })
      .limit(40),
    adminSupabase
      .from('personal_transactions')
      .select('category,direction,amount')
      .gte('booking_date', `${jaar}-01-01`)
      .lte('booking_date', `${jaar}-12-31`),
    adminSupabase
      .from('personal_transactions')
      .select('direction,amount,is_salary,is_savings')
      .gte('booking_date', `${jaar}-01-01`)
      .lte('booking_date', `${jaar}-12-31`),
  ])

  const assets      = assetsRes.status      === 'fulfilled' ? (assetsRes.value.data      ?? []) : []
  const liabilities = liabilitiesRes.status === 'fulfilled' ? (liabilitiesRes.value.data ?? []) : []
  const transactions = txRes.status         === 'fulfilled' ? (txRes.value.data          ?? []) : []
  const catData      = catRes.status        === 'fulfilled' ? (catRes.value.data          ?? []) : []
  const ytdData      = ytdRes.status        === 'fulfilled' ? (ytdRes.value.data          ?? []) : []

  // Bereken YTD
  let ytdInkomsten = 0, ytdUitgaven = 0, ytdSparen = 0
  for (const tx of ytdData) {
    if (tx.direction === 'credit') {
      ytdInkomsten += Number(tx.amount)
    } else {
      ytdUitgaven += Number(tx.amount)
      if (tx.is_savings) ytdSparen += Number(tx.amount)
    }
  }

  // Categorie breakdown (uitgaven)
  const catMap: Record<string, number> = {}
  for (const tx of catData) {
    if (tx.direction === 'debet') {
      catMap[tx.category] = (catMap[tx.category] ?? 0) + Number(tx.amount)
    }
  }
  const categorieen = Object.entries(catMap)
    .map(([cat, bedrag]) => ({ cat, bedrag: Math.round(bedrag) }))
    .sort((a, b) => b.bedrag - a.bedrag)
    .slice(0, 8)

  // Vaste lasten: transacties waarbij dezelfde creditor de afgelopen 2+ maanden voorkomt
  const creditorMonths: Record<string, Set<string>> = {}
  for (const tx of catData) {
    if (tx.direction === 'debet') {
      const key = (tx as { creditor_name?: string }).creditor_name ?? (tx as { description?: string }).description ?? ''
      if (!key) continue
      const month = ((tx as { booking_date?: string }).booking_date ?? '').slice(0, 7)
      if (!creditorMonths[key]) creditorMonths[key] = new Set()
      creditorMonths[key].add(month)
    }
  }
  const vasteLasten = Object.entries(creditorMonths)
    .filter(([, months]) => months.size >= 2)
    .map(([naam, months]) => ({ naam, maanden: months.size }))
    .sort((a, b) => b.maanden - a.maanden)
    .slice(0, 10)

  // Vermogen
  const totaalActiva  = assets.reduce((s, a) => s + Number(a.waarde), 0)
  const totaalPassiva = liabilities.reduce((s, l) => s + Number(l.saldo), 0)
  const nettoVermogen = totaalActiva - totaalPassiva

  return (
    <MobileFinanceClient
      jaar={jaar}
      ytd={{
        inkomsten:  Math.round(ytdInkomsten),
        uitgaven:   Math.round(ytdUitgaven),
        cashflow:   Math.round(ytdInkomsten - ytdUitgaven),
        sparen:     Math.round(ytdSparen),
      }}
      categorieen={categorieen}
      transactions={transactions}
      vasteLasten={vasteLasten}
      vermogen={{ activa: Math.round(totaalActiva), passiva: Math.round(totaalPassiva), netto: Math.round(nettoVermogen) }}
      assets={assets}
      liabilities={liabilities}
    />
  )
}
