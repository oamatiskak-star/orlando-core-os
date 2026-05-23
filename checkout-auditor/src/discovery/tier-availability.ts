import type { TierSpec } from '../types'

/**
 * Crude DOM parsing from an HTML body excerpt to detect which tier-codes/names are present.
 * For first-run robustness — Playwright will give more accurate detection in scenario runs.
 */
export function detectTiersInHtml(html: string, tiers: TierSpec[]): {
  tier_codes_visible: string[]
  pricing_observed: Record<string, { monthly: number | null; quarterly: number | null; yearly: number | null }>
} {
  const lower = html.toLowerCase()
  const visible: string[] = []
  const pricing: Record<string, { monthly: number | null; quarterly: number | null; yearly: number | null }> = {}

  for (const tier of tiers) {
    const codeMatch = lower.includes(tier.code.toLowerCase())
    const nameMatch = lower.includes(tier.display_name.toLowerCase()) ||
                      lower.includes(tier.display_name.toLowerCase().replace('aquier ', ''))
    if (codeMatch || nameMatch) {
      visible.push(tier.code)

      // Try to extract prices near this tier mention (very rough — improved by Playwright)
      const tierIdx = nameMatch
        ? lower.indexOf(tier.display_name.toLowerCase())
        : lower.indexOf(tier.code.toLowerCase())
      const window = html.slice(Math.max(0, tierIdx - 200), tierIdx + 1500)
      pricing[tier.code] = {
        monthly: extractEur(window, ['/mo', '/maand', 'monthly', 'maandelijks']),
        quarterly: extractEur(window, ['/quarter', '/kwartaal', 'quarterly']),
        yearly: extractEur(window, ['/yr', '/jaar', 'yearly', 'annually', 'jaarlijks']),
      }
    }
  }

  return { tier_codes_visible: visible, pricing_observed: pricing }
}

function extractEur(text: string, hints: string[]): number | null {
  // Try formats like "€199" "€ 199" "€2,989" "€2.989,00" "199 EUR"
  // Limit to numbers that appear near one of the hints
  for (const hint of hints) {
    const hintIdx = text.toLowerCase().indexOf(hint.toLowerCase())
    if (hintIdx < 0) continue
    const window = text.slice(Math.max(0, hintIdx - 80), hintIdx + 40)
    const match = window.match(/€\s?(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?)/)
    if (match) {
      const numStr = match[1].replace(/\./g, '').replace(',', '.')
      const value = Number(numStr)
      if (!Number.isNaN(value)) return value
    }
  }
  return null
}
