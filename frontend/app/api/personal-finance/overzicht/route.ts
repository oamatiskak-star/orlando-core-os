import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const supabase = createAdminClient()
  const url      = new URL(req.url)
  const jaar     = parseInt(url.searchParams.get('jaar') ?? new Date().getFullYear().toString())

  // Maandaggregatie voor huidig jaar
  const { data: maanden } = await supabase.rpc('personal_finance_maanden', { p_jaar: jaar })

  // Categorie-uitsplitsing voor huidig jaar
  const { data: categorieen } = await supabase
    .from('personal_transactions')
    .select('category, direction, amount')
    .gte('booking_date', `${jaar}-01-01`)
    .lte('booking_date', `${jaar}-12-31`)

  // YTD totalen
  const { data: ytd } = await supabase
    .from('personal_transactions')
    .select('direction, amount, is_salary, is_savings')
    .gte('booking_date', `${jaar}-01-01`)
    .lte('booking_date', `${jaar}-12-31`)

  // Laatste 3 jaar cashflow voor trend
  const { data: trend } = await supabase.rpc('personal_finance_trend')

  // Bereken categorie breakdown
  const catMap: Record<string, { inkomsten: number; uitgaven: number }> = {}
  for (const tx of (categorieen ?? [])) {
    if (!catMap[tx.category]) catMap[tx.category] = { inkomsten: 0, uitgaven: 0 }
    if (tx.direction === 'credit') catMap[tx.category].inkomsten += Number(tx.amount)
    else catMap[tx.category].uitgaven += Number(tx.amount)
  }

  // YTD berekeningen
  let ytdInkomsten = 0, ytdUitgaven = 0, ytdSalaris = 0, ytdSparen = 0
  for (const tx of (ytd ?? [])) {
    if (tx.direction === 'credit') {
      ytdInkomsten += Number(tx.amount)
      if (tx.is_salary) ytdSalaris += Number(tx.amount)
    } else {
      ytdUitgaven += Number(tx.amount)
      if (tx.is_savings) ytdSparen += Number(tx.amount)
    }
  }

  const ytdCashflow   = ytdInkomsten - ytdUitgaven
  const spaarquote    = ytdInkomsten > 0 ? (ytdSparen / ytdInkomsten) * 100 : 0

  return NextResponse.json({
    jaar,
    ytd: {
      inkomsten:  Math.round(ytdInkomsten),
      uitgaven:   Math.round(ytdUitgaven),
      cashflow:   Math.round(ytdCashflow),
      salaris:    Math.round(ytdSalaris),
      sparen:     Math.round(ytdSparen),
      spaarquote: Math.round(spaarquote * 10) / 10,
    },
    maanden: maanden ?? [],
    categorieen: Object.entries(catMap)
      .map(([cat, v]) => ({ cat, ...v, netto: v.inkomsten - v.uitgaven }))
      .sort((a, b) => b.uitgaven - a.uitgaven),
    trend: trend ?? [],
  })
}
