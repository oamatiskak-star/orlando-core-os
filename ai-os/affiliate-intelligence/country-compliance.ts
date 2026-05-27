/**
 * Country-specific compliance rules and validation
 * Handles regulatory requirements, restrictions, and localization per jurisdiction
 */

import { getCountryStrategy, hasComplianceRequirement } from './country-strategies'

export interface ComplianceCheckResult {
  compliant: boolean
  issues: string[]
  warnings: string[]
  recommendations: string[]
}

export interface AffiliateEligibility {
  country_code: string
  affiliate_id: string
  is_eligible: boolean
  restrictions: string[]
  requirements: string[]
  payout_currency: string
  tax_notes: string
}

/**
 * Check if affiliate marketing content complies with country regulations
 */
export function validateMarketingCompliance(
  countryCode: string,
  content: {
    title?: string
    description?: string
    hasDisclosure?: boolean
    targetAudience?: string
    productType?: string
  }
): ComplianceCheckResult {
  const strategy = getCountryStrategy(countryCode)
  if (!strategy) {
    return {
      compliant: false,
      issues: [`Unknown country: ${countryCode}`],
      warnings: [],
      recommendations: [],
    }
  }

  const issues: string[] = []
  const warnings: string[] = []
  const recommendations: string[] = []

  // EU-specific checks
  if (strategy.region === 'EU') {
    if (!content.hasDisclosure) {
      issues.push('GDPR: Affiliate disclosure (FTC-style) required in EU')
    }
    if (countryCode === 'DE' && !content.description?.toLowerCase().includes('impressum')) {
      warnings.push('German law: Impressum (imprint) highly recommended')
    }
    if (countryCode === 'FR') {
      if (hasComplianceRequirement(countryCode, 'Cookie wall prohibited')) {
        warnings.push('CNIL: Implied consent only, cookie wall not allowed')
      }
    }
  }

  // CCPA/CPRA (USA)
  if (countryCode === 'US') {
    if (!content.hasDisclosure) {
      issues.push('FTC: Affiliate disclosure required (clear, conspicuous, before CTA)')
    }
    recommendations.push('CAN-SPAM: Maintain unsubscribe list for email marketing')
  }

  // MENA region checks
  if (strategy.region === 'MENA') {
    if (content.productType?.toLowerCase().includes('alcohol')) {
      issues.push(`${strategy.country_name}: Alcohol products prohibited`)
    }
    if (content.productType?.toLowerCase().includes('gambling')) {
      issues.push(`${strategy.country_name}: Gambling products prohibited`)
    }
    if (content.productType?.toLowerCase().includes('pork')) {
      issues.push(`${strategy.country_name}: Pork products prohibited`)
    }
  }

  // APAC region checks
  if (countryCode === 'SG') {
    if (hasComplianceRequirement(countryCode, 'No high-risk financial products')) {
      warnings.push('MAS: High-risk financial products may face restrictions')
    }
  }

  if (countryCode === 'AU') {
    if (content.productType?.toLowerCase().includes('financial')) {
      warnings.push('ASIC: Financial advice disclaimers required')
      recommendations.push('Include: "This is not financial advice"')
    }
  }

  return {
    compliant: issues.length === 0,
    issues,
    warnings,
    recommendations,
  }
}

/**
 * Check if an affiliate product is eligible for a specific country
 */
export function checkAffiliateEligibility(
  countryCode: string,
  affiliateId: string,
  affiliateCategory?: string
): AffiliateEligibility {
  const strategy = getCountryStrategy(countryCode)

  if (!strategy) {
    return {
      country_code: countryCode,
      affiliate_id: affiliateId,
      is_eligible: false,
      restrictions: [`Unknown country: ${countryCode}`],
      requirements: [],
      payout_currency: 'USD',
      tax_notes: 'Unknown jurisdiction',
    }
  }

  const restrictions: string[] = []
  const requirements: string[] = []

  // Check if affiliate is in country's preference list
  const isPreferred = strategy.affiliate_preferences.includes(affiliateId.toLowerCase())

  // Category-specific restrictions
  if (affiliateCategory?.toLowerCase().includes('crypto')) {
    if (strategy.region === 'MENA') {
      restrictions.push('Crypto products require Sharia compliance review')
    }
    if (countryCode === 'SG') {
      restrictions.push('High-risk crypto products may be restricted by MAS')
    }
  }

  if (affiliateCategory?.toLowerCase().includes('finance')) {
    if (countryCode === 'AU') {
      requirements.push('ASIC financial advice disclaimer required')
    }
    if (countryCode === 'US') {
      requirements.push('State-specific financial regulations may apply')
    }
  }

  if (affiliateCategory?.toLowerCase().includes('real-estate')) {
    if (strategy.region === 'EU') {
      requirements.push('Local real estate licensing may be required')
    }
  }

  // Language requirements
  if (strategy.primary_language !== 'en') {
    requirements.push(`Content/support must be available in ${strategy.primary_language}`)
  }

  return {
    country_code: countryCode,
    affiliate_id: affiliateId,
    is_eligible: !restrictions.length,
    restrictions,
    requirements,
    payout_currency: strategy.preferred_currency,
    tax_notes: getTaxNotes(countryCode),
  }
}

/**
 * Get compliance requirements checklist for a country
 */
export function getComplianceChecklist(countryCode: string): {
  country: string
  requirements: string[]
  priority: string
  notes: string
} {
  const strategy = getCountryStrategy(countryCode)

  if (!strategy) {
    return {
      country: countryCode,
      requirements: [],
      priority: 'unknown',
      notes: 'Country not found',
    }
  }

  let priority = 'standard'
  if (strategy.priority <= 2) priority = 'critical'
  else if (strategy.priority <= 4) priority = 'high'

  return {
    country: strategy.country_name,
    requirements: strategy.compliance_requirements,
    priority,
    notes: strategy.notes,
  }
}

/**
 * Get tax and payout information for a country
 */
export function getTaxNotes(countryCode: string): string {
  const strategy = getCountryStrategy(countryCode)
  if (!strategy) return 'Unknown country'

  const notes: string[] = []

  if (strategy.vat_rate > 0) {
    notes.push(`VAT: ${(strategy.vat_rate * 100).toFixed(0)}%`)
  } else {
    notes.push('VAT: Not applicable (US state-based)')
  }

  notes.push(`Currency: ${strategy.preferred_currency}`)

  if (strategy.region === 'EU') {
    notes.push('EU: VAT invoice required for B2B')
    notes.push('GDPR: Data processing agreement may be required')
  }

  if (countryCode === 'US') {
    notes.push('IRS: 1099-NEC for non-resident aliens')
  }

  if (countryCode === 'CA') {
    notes.push('CRA: GST/HST registration may be required')
  }

  if (strategy.region === 'MENA') {
    notes.push('Islamic law: Sharia-compliant payment methods required')
  }

  if (strategy.region === 'APAC') {
    notes.push('Local: Tax treatment varies by residency status')
  }

  return notes.join('\n')
}

/**
 * Determine if content type is recommended for country
 */
export function isContentTypeRecommended(countryCode: string, contentType: string): boolean {
  const strategy = getCountryStrategy(countryCode)
  if (!strategy) return false

  return strategy.recommended_content_types.includes(contentType.toLowerCase())
}

/**
 * Get content types that perform well in a country
 */
export function getRecommendedContentTypes(countryCode: string): string[] {
  const strategy = getCountryStrategy(countryCode)
  if (!strategy) return []

  return strategy.recommended_content_types
}

/**
 * Calculate pricing adjustment for country
 * Returns multiplier: 1.0 = no change, 1.2 = 20% increase
 */
export function getPricingMultiplier(countryCode: string): number {
  const strategy = getCountryStrategy(countryCode)
  if (!strategy) return 1.0

  return strategy.membership_pricing_adjustment
}

/**
 * Check if country requires specific language support
 */
export function getRequiredLanguages(countryCode: string): string[] {
  const strategy = getCountryStrategy(countryCode)
  if (!strategy) return []

  const languages = [strategy.primary_language]

  // Countries with bilingual requirements
  if (countryCode === 'BE') languages.push('fr')
  if (countryCode === 'CA') languages.push('en', 'fr')
  if (countryCode === 'SA') languages.push('ar')
  if (countryCode === 'AE') languages.push('ar')

  return [...new Set(languages)]
}

/**
 * Get region from country code
 */
export function getRegion(countryCode: string): string {
  const strategy = getCountryStrategy(countryCode)
  return strategy?.region || 'UNKNOWN'
}

/**
 * Check if affiliate is available in country based on preferences
 */
export function isAffiliateAvailableInCountry(countryCode: string, affiliateId: string): boolean {
  const strategy = getCountryStrategy(countryCode)
  if (!strategy) return false

  return strategy.affiliate_preferences.includes(affiliateId.toLowerCase())
}

/**
 * Get all restrictions for an affiliate-country pair
 */
export function getAllRestrictions(countryCode: string, affiliateId: string): string[] {
  const restrictions: string[] = []

  const strategy = getCountryStrategy(countryCode)
  if (!strategy) {
    restrictions.push(`Country not found: ${countryCode}`)
    return restrictions
  }

  // Affiliate not in preference list
  if (!isAffiliateAvailableInCountry(countryCode, affiliateId)) {
    restrictions.push(`${affiliateId} not in recommended affiliates for ${strategy.country_name}`)
  }

  // Region-specific restrictions
  if (strategy.region === 'MENA') {
    if (!['tradingview', 'interactive-brokers', 'semrush', 'shopify'].includes(affiliateId.toLowerCase())) {
      restrictions.push('MENA region: Limited affiliate support for non-traditional programs')
    }
  }

  // Country-specific restrictions
  if (countryCode === 'SG') {
    if (['binance', 'bybit'].includes(affiliateId.toLowerCase())) {
      restrictions.push('Singapore: High-risk crypto platforms may require additional compliance')
    }
  }

  return restrictions
}
