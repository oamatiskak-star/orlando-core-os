import axios from 'axios'

// FMP (Financial Modeling Prep) data-client voor de finance data-explainer format-engine.
// Levert ECHTE marktcijfers om in scripts/grafieken te injecteren (anti-slop: YouTube 2025
// demonetiseert generieke AI-content; echte data + bronnen is de naleving).
//
// GRACEFUL DEGRADE: zonder FMP_API_KEY geeft elke functie null/lege data terug zodat de
// pijplijn niet breekt — de data-injectie wordt dan simpelweg overgeslagen. De key toevoegen
// (FMP_API_KEY in local-agent env) is een config-gate voor Orlando.

const FMP_BASE = 'https://financialmodelingprep.com/api/v3'
const KEY = () => process.env.FMP_API_KEY ?? ''
export function fmpAvailable(): boolean { return KEY().length > 0 }

export interface Quote {
  symbol: string
  name: string | null
  price: number | null
  changesPercentage: number | null
  marketCap: number | null
  pe: number | null
  yearHigh: number | null
  yearLow: number | null
}

async function fmpGet<T>(path: string): Promise<T | null> {
  if (!fmpAvailable()) return null
  try {
    const sep = path.includes('?') ? '&' : '?'
    const res = await axios.get(`${FMP_BASE}${path}${sep}apikey=${KEY()}`, { timeout: 8000 })
    return res.data as T
  } catch {
    return null
  }
}

/** Live quotes voor een set tickers (bv. ['AAPL','MSFT','^GSPC']). */
export async function getQuotes(symbols: string[]): Promise<Quote[]> {
  if (symbols.length === 0) return []
  const raw = await fmpGet<any[]>(`/quote/${symbols.map(encodeURIComponent).join(',')}`)
  if (!raw) return []
  return raw.map((q) => ({
    symbol: q.symbol,
    name: q.name ?? null,
    price: q.price ?? null,
    changesPercentage: q.changesPercentage ?? null,
    marketCap: q.marketCap ?? null,
    pe: q.pe ?? null,
    yearHigh: q.yearHigh ?? null,
    yearLow: q.yearLow ?? null,
  }))
}

/** Historische dagkoersen (laatste N) — voedt charts. */
export async function getDailyCloses(symbol: string, limit = 60): Promise<{ date: string; close: number }[]> {
  const raw = await fmpGet<{ historical?: { date: string; close: number }[] }>(
    `/historical-price-full/${encodeURIComponent(symbol)}?serietype=line&timeseries=${limit}`,
  )
  if (!raw?.historical) return []
  return raw.historical
    .map((h) => ({ date: h.date, close: h.close }))
    .reverse() // oudste -> nieuwste voor een leesbare grafiek
}

/** Compacte, mensleesbare data-bundel voor één topic → in de script-prompt te injecteren. */
export async function buildDataBundle(symbols: string[]): Promise<string | null> {
  if (!fmpAvailable() || symbols.length === 0) return null
  const quotes = await getQuotes(symbols)
  if (quotes.length === 0) return null
  const lines = quotes.map((q) => {
    const chg = q.changesPercentage != null ? `${q.changesPercentage > 0 ? '+' : ''}${q.changesPercentage.toFixed(2)}%` : 'n/a'
    const cap = q.marketCap != null ? `$${(q.marketCap / 1e9).toFixed(1)}B` : 'n/a'
    const pe = q.pe != null ? q.pe.toFixed(1) : 'n/a'
    return `- ${q.symbol} (${q.name ?? '?'}): $${q.price ?? '?'} (${chg}), mktcap ${cap}, P/E ${pe}, 52w ${q.yearLow ?? '?'}–${q.yearHigh ?? '?'}`
  })
  return `REAL MARKET DATA (FMP, use these exact numbers, cite as "as of latest close"):\n${lines.join('\n')}`
}
