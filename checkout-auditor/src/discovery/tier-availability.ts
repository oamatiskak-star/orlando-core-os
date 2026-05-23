import type { TierSpec } from '../types'

/**
 * Parses an HTML body (Next.js SSR + RSC stream) for visible tiers + prices.
 *
 * Two-pass approach:
 *   1. Prefer the JSON-escaped RSC payload (`\"id\":\"<code>\"..."monthly_price_eur":199`).
 *      This is the API-derived source-of-truth — reliable, robust.
 *   2. Fallback to display-DOM regex (`<span>€<!-- -->199</span>` style)
 *      for sites without RSC or when RSC is missing fields.
 */
export function detectTiersInHtml(html: string, tiers: TierSpec[]): {
  tier_codes_visible: string[]
  pricing_observed: Record<string, { monthly: number | null; quarterly: number | null; yearly: number | null }>
} {
  const visible: string[] = []
  const pricing: Record<string, { monthly: number | null; quarterly: number | null; yearly: number | null }> = {}
  const lowerHtml = html.toLowerCase()

  for (const tier of tiers) {
    const rscPrices = parseRscJsonPrices(html, tier.code)

    // Detect tier presence by either RSC code key or display-name string match
    const codeKeyEscaped = `\\"id\\":\\"${tier.code.toLowerCase()}\\"`
    const codeKeyPlain = `"id":"${tier.code.toLowerCase()}"`
    const codeFound = lowerHtml.includes(codeKeyEscaped) || lowerHtml.includes(codeKeyPlain)
    const nameFound = lowerHtml.includes(tier.display_name.toLowerCase())
      || lowerHtml.includes(tier.display_name.toLowerCase().replace('aquier ', ''))

    if (rscPrices || codeFound || nameFound) {
      visible.push(tier.code)

      if (rscPrices) {
        pricing[tier.code] = rscPrices
      } else {
        // Fallback to display extraction
        const idx = nameFound ? lowerHtml.indexOf(tier.display_name.toLowerCase()) : 0
        const window = html.slice(Math.max(0, idx - 200), idx + 2500)
        pricing[tier.code] = {
          monthly: extractEurDisplay(window, ['/mo', '/maand', 'monthly', 'maandelijks', 'per month', 'per maand']),
          quarterly: extractEurDisplay(window, ['/quarter', '/kwartaal', 'quarterly', 'per kwartaal']),
          yearly: extractEurDisplay(window, ['/yr', '/jaar', 'yearly', 'annually', 'jaarlijks', 'per year', 'per jaar']),
        }
      }
    }
  }

  return { tier_codes_visible: visible, pricing_observed: pricing }
}

/**
 * Parse Next.js RSC stream JSON-escaped tier payload.
 * Looks for: `\"id\":\"<code>\"`, then within the following ~1.2KB the price fields.
 * Returns null if the payload isn't present for this tier.
 */
function parseRscJsonPrices(
  html: string,
  tierCode: string,
): { monthly: number | null; quarterly: number | null; yearly: number | null } | null {
  // RSC payload is JSON.stringify'd into a JS string in HTML — quotes are escaped as \"
  const idPatternEscaped = new RegExp(`\\\\"id\\\\":\\\\"${tierCode}\\\\"`, 'i')
  const idPatternPlain = new RegExp(`"id":"${tierCode}"`, 'i')

  let startIdx = -1
  const escMatch = html.match(idPatternEscaped)
  if (escMatch && escMatch.index !== undefined) {
    startIdx = escMatch.index
  } else {
    const plainMatch = html.match(idPatternPlain)
    if (plainMatch && plainMatch.index !== undefined) startIdx = plainMatch.index
  }
  if (startIdx < 0) return null

  const window = html.slice(startIdx, startIdx + 1200)

  const fieldNumber = (key: string): number | null => {
    const re = new RegExp(`\\\\?"${key}\\\\?":\\s*(\\d+(?:\\.\\d+)?|null)`, 'i')
    const m = window.match(re)
    if (!m || m[1] === 'null') return null
    return Number(m[1])
  }

  const monthly = fieldNumber('monthly_price_eur')
  const annual = fieldNumber('annual_price_eur')
  const quarterly = fieldNumber('quarterly_price_eur')

  if (monthly === null && annual === null && quarterly === null) return null

  return { monthly, quarterly, yearly: annual }
}

/**
 * Fallback: extract EUR price from rendered display HTML.
 * Handles Next.js `€<!-- -->199` text-segment quirk by stripping HTML comments first.
 */
function extractEurDisplay(text: string, hints: string[]): number | null {
  // Strip HTML comments so €<!-- -->199 becomes €199
  const cleaned = text.replace(/<!--[\s\S]*?-->/g, '')
  for (const hint of hints) {
    const hintIdx = cleaned.toLowerCase().indexOf(hint.toLowerCase())
    if (hintIdx < 0) continue
    const window = cleaned.slice(Math.max(0, hintIdx - 150), hintIdx + 40)
    const match = window.match(/€\s?(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?)/)
    if (match) {
      const numStr = match[1].replace(/\./g, '').replace(',', '.')
      const value = Number(numStr)
      if (!Number.isNaN(value)) return value
    }
  }
  return null
}
