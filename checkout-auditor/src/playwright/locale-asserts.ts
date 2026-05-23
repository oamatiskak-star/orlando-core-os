import type { CountrySpec } from '../types'

export type LocaleAssertResult = {
  pricing_text_observed: string[]
  currency_label_detected: string | null
  vat_label_detected: string | null
  locale_attribute_detected: string | null
  expected_currency_matches: boolean
  numbers_formatted_correctly: boolean
  issues: string[]
}

/**
 * Given a page's textContent + the country spec, derives locale-related observations.
 * No mutations — pure analysis.
 */
export function assertLocale(text: string, htmlLangAttr: string | null, country: CountrySpec): LocaleAssertResult {
  const issues: string[] = []

  // Currency detection
  const currencySymbols: Record<string, string[]> = {
    EUR: ['€', 'EUR'],
    GBP: ['£', 'GBP'],
    USD: ['$', 'USD'],
    AED: ['د.إ', 'AED', 'Dh', 'Dhs'],
    CHF: ['CHF', 'Fr.'],
    CAD: ['CA$', 'C$', 'CAD'],
    AUD: ['A$', 'AUD'],
    THB: ['฿', 'THB', 'Baht'],
  }
  const expectedSymbols = currencySymbols[country.currency_expected] ?? []
  const detectedSymbol = expectedSymbols.find(s => text.includes(s)) ?? null
  const wrongSymbolEntry = !detectedSymbol
    ? Object.entries(currencySymbols).find(
        ([code, syms]) => code !== country.currency_expected && syms.some(s => text.includes(s)),
      )
    : undefined
  const wrongSymbolDetected: string | null = wrongSymbolEntry ? wrongSymbolEntry[0] : null

  // VAT label
  const vatHints = ['vat', 'btw', 'mwst', 'iva', 'tva', 'tax', 'belasting']
  const lowerText = text.toLowerCase()
  const vatHit = vatHints.find(h => lowerText.includes(h)) ?? null

  // Locale html attr
  const localeAttr = htmlLangAttr

  // Pricing patterns
  const priceRegex = /(€|£|\$|د\.إ|CHF|CA\$|A\$|฿)\s?\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?/g
  const pricingTextObserved: string[] = []
  let m: RegExpExecArray | null
  while ((m = priceRegex.exec(text)) !== null) {
    pricingTextObserved.push(m[0])
    if (pricingTextObserved.length > 30) break
  }

  // Format check: EU uses comma as decimal, dot as thousands; en-US is opposite
  const usesEuFormat = /€\s?\d+\.\d{3},/.test(text)
  const usesEnFormat = /\$\d+,\d{3}\.\d{2}/.test(text)
  const expectsEuFormat = ['EUR', 'CHF'].includes(country.currency_expected) && country.code !== 'GB'
  const numbersFormattedCorrectly = expectsEuFormat ? !usesEnFormat : !usesEuFormat

  if (!detectedSymbol) {
    issues.push(`Expected currency ${country.currency_expected} symbol/code not detected on page`)
  }
  if (wrongSymbolDetected) {
    issues.push(`Wrong currency present: ${wrongSymbolDetected} symbol detected instead of ${country.currency_expected}`)
  }
  if (country.vat_rate_b2c_standard !== null && !vatHit) {
    issues.push(`VAT-region (${country.code}) page does not display any VAT-related label`)
  }
  if (localeAttr && !localeAttr.toLowerCase().startsWith(country.locale_default.toLowerCase().slice(0, 2))) {
    issues.push(`html lang="${localeAttr}" mismatches expected ${country.locale_default}`)
  }

  return {
    pricing_text_observed: pricingTextObserved,
    currency_label_detected: detectedSymbol,
    vat_label_detected: vatHit,
    locale_attribute_detected: localeAttr,
    expected_currency_matches: detectedSymbol !== null,
    numbers_formatted_correctly: numbersFormattedCorrectly,
    issues,
  }
}
