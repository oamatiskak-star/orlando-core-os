/**
 * ScrapeGraph client — roept de lokale Python microservice aan (port 3013).
 * Gebruik in workers: import { sgScrape, sgSearch, sgMarkdownify } from '../lib/scrapegraph.mjs'
 */

const BASE_URL = process.env.SCRAPEGRAPH_URL || 'http://localhost:3013'
const TIMEOUT_MS = parseInt(process.env.SCRAPEGRAPH_TIMEOUT_MS || '120000', 10)

async function post(path, body) {
  const ctrl = new AbortController()
  const tid = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`scrapegraph ${path} HTTP ${res.status}: ${text.slice(0, 200)}`)
    }
    return await res.json()
  } finally {
    clearTimeout(tid)
  }
}

/** SmartScraper: geeft gestructureerde JSON op basis van URL + prompt */
export async function sgScrape(url, prompt, { model } = {}) {
  return post('/scrape', { url, prompt, model })
}

/** SearchGraph: zoekopdracht → gestructureerde resultaten */
export async function sgSearch(query, prompt, { numResults = 5, model } = {}) {
  return post('/search', { query, prompt, num_results: numResults, model })
}

/** MarkdownifyGraph: URL → schone Markdown voor LLM-ingestie */
export async function sgMarkdownify(url, { model } = {}) {
  return post('/markdownify', { url, model })
}

/** Batch: meerdere URLs met dezelfde prompt */
export async function sgBatch(urls, prompt, { model } = {}) {
  return post('/batch', { urls, prompt, model })
}

/** Health check — true als de service beschikbaar is */
export async function sgHealthy() {
  try {
    const res = await fetch(`${BASE_URL}/health`, { signal: AbortSignal.timeout(3000) })
    return res.ok
  } catch {
    return false
  }
}
