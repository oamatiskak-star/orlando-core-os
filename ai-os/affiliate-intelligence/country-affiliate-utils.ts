/**
 * Country-Affiliate Utilities
 * Helper functions for filtering, matching, and managing affiliates by country/region
 */

import { getCountryStrategy, getActiveCountries, getCountriesByRegion } from './country-strategies'
import {
  isAffiliateAvailableInCountry,
  checkAffiliateEligibility,
  getRecommendedContentTypes,
  getPricingMultiplier,
  getRequiredLanguages,
  getRegion,
} from './country-compliance'

export interface CountryAffiliateMatch {
  country_code: string
  country_name: string
  affiliate_id: string
  is_available: boolean
  priority: number
  pricing_multiplier: number
  required_languages: string[]
  recommended_content_types: string[]
}

export interface RegionalAffiliateStrategy {
  region: string
  countries: string[]
  primary_affiliates: string[]
  secondary_affiliates: string[]
  common_restrictions: string[]
  language_requirements: string[]
}

/**
 * Get all affiliates recommended for a specific country
 */
export function getAffiliatesForCountry(countryCode: string): string[] {
  const strategy = getCountryStrategy(countryCode)
  return strategy?.affiliate_preferences || []
}

/**
 * Get all countries where an affiliate is available
 */
export function getCountriesForAffiliate(affiliateId: string): string[] {
  return getActiveCountries()
    .filter((country) => isAffiliateAvailableInCountry(country.country_code, affiliateId))
    .map((country) => country.country_code)
}

/**
 * Get detailed matching info for affiliate-country pair
 */
export function getCountryAffiliateMatch(
  countryCode: string,
  affiliateId: string
): CountryAffiliateMatch | null {
  const strategy = getCountryStrategy(countryCode)
  if (!strategy) return null

  const affiliateIndex = strategy.affiliate_preferences.indexOf(affiliateId.toLowerCase())
  const isAvailable = affiliateIndex !== -1

  return {
    country_code: countryCode,
    country_name: strategy.country_name,
    affiliate_id: affiliateId,
    is_available: isAvailable,
    priority: isAvailable ? affiliateIndex + 1 : 999,
    pricing_multiplier: getPricingMultiplier(countryCode),
    required_languages: getRequiredLanguages(countryCode),
    recommended_content_types: getRecommendedContentTypes(countryCode),
  }
}

/**
 * Filter a list of affiliates by country availability
 */
export function filterAffiliatesByCountry(
  affiliateIds: string[],
  countryCode: string
): string[] {
  return affiliateIds.filter((id) => isAffiliateAvailableInCountry(countryCode, id))
}

/**
 * Rank affiliates by priority for a country
 */
export function rankAffiliatesByCountry(
  affiliateIds: string[],
  countryCode: string
): string[] {
  const strategy = getCountryStrategy(countryCode)
  if (!strategy) return affiliateIds

  return affiliateIds.sort((a, b) => {
    const aIndex = strategy.affiliate_preferences.indexOf(a.toLowerCase())
    const bIndex = strategy.affiliate_preferences.indexOf(b.toLowerCase())

    // If both are in preferences, sort by position
    if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex

    // If only one is in preferences, prefer it
    if (aIndex !== -1) return -1
    if (bIndex !== -1) return 1

    // If neither, maintain original order
    return 0
  })
}

/**
 * Get regional strategy for a set of countries
 */
export function getRegionalStrategy(region: string): RegionalAffiliateStrategy {
  const countries = getCountriesByRegion(region)
  const countryCode = countries[0]?.country_code

  if (!countryCode) {
    return {
      region,
      countries: [],
      primary_affiliates: [],
      secondary_affiliates: [],
      common_restrictions: [],
      language_requirements: [],
    }
  }

  // Collect all unique affiliates and languages across region
  const allAffiliates = new Set<string>()
  const allLanguages = new Set<string>()

  countries.forEach((country) => {
    country.affiliate_preferences.forEach((aff) => allAffiliates.add(aff))
    getRequiredLanguages(country.country_code).forEach((lang) => allLanguages.add(lang))
  })

  // Determine primary (mentioned in all/most countries) vs secondary
  const affiliateCounts = new Map<string, number>()
  allAffiliates.forEach((aff) => {
    const count = countries.filter((c) => c.affiliate_preferences.includes(aff)).length
    affiliateCounts.set(aff, count)
  })

  const threshold = Math.ceil(countries.length * 0.6)
  const primary = Array.from(allAffiliates).filter(
    (aff) => (affiliateCounts.get(aff) || 0) >= threshold
  )
  const secondary = Array.from(allAffiliates).filter(
    (aff) => (affiliateCounts.get(aff) || 0) < threshold
  )

  return {
    region,
    countries: countries.map((c) => c.country_code),
    primary_affiliates: primary,
    secondary_affiliates: secondary,
    common_restrictions: getCommonRestrictions(region),
    language_requirements: Array.from(allLanguages),
  }
}

/**
 * Get common restrictions for a region
 */
function getCommonRestrictions(region: string): string[] {
  const restrictions: string[] = []

  switch (region) {
    case 'EU':
      restrictions.push('GDPR compliance required', 'Cookie consent mandatory')
      break
    case 'MENA':
      restrictions.push('Sharia-compliant products only', 'No alcohol/gambling/pork content')
      break
    case 'Americas':
      restrictions.push('CAN-SPAM for email marketing', 'FTC affiliate disclosure required')
      break
    case 'APAC':
      restrictions.push('Local data residency may apply', 'Variable privacy laws per country')
      break
  }

  return restrictions
}

/**
 * Get pricing strategy for a country
 */
export function getCountryPricingStrategy(countryCode: string): {
  country: string
  base_multiplier: number
  vat_rate: number
  currency: string
  strategy: string
} | null {
  const strategy = getCountryStrategy(countryCode)
  if (!strategy) return null

  return {
    country: strategy.country_name,
    base_multiplier: getPricingMultiplier(countryCode),
    vat_rate: strategy.vat_rate,
    currency: strategy.preferred_currency,
    strategy: strategy.pricing_strategy,
  }
}

/**
 * Get all countries a user might target (sorted by priority)
 */
export function getTargetCountries(region?: string): string[] {
  const countries = region ? getCountriesByRegion(region) : getActiveCountries()

  return countries
    .sort((a, b) => a.priority - b.priority)
    .map((c) => c.country_code)
}

/**
 * Check if a country is in a specific region
 */
export function isCountryInRegion(countryCode: string, region: string): boolean {
  const strategy = getCountryStrategy(countryCode)
  return strategy?.region === region
}

/**
 * Get priority for a country (1 = highest)
 */
export function getCountryPriority(countryCode: string): number {
  const strategy = getCountryStrategy(countryCode)
  return strategy?.priority || 999
}

/**
 * Suggest best affiliate for a country-audience pair
 */
export function suggestBestAffiliate(
  countryCode: string,
  audienceInterests: string[]
): string | null {
  const strategy = getCountryStrategy(countryCode)
  if (!strategy || strategy.affiliate_preferences.length === 0) return null

  // Return first available affiliate (highest priority)
  return strategy.affiliate_preferences[0]
}

/**
 * Get affiliate preferences for multiple countries (intersection)
 */
export function getCommonAffiliates(...countryCodes: string[]): string[] {
  if (countryCodes.length === 0) return []

  const affiliateSets = countryCodes.map((code) => {
    const prefs = getAffiliatesForCountry(code)
    return new Set(prefs.map((a) => a.toLowerCase()))
  })

  const intersection = affiliateSets[0]
  for (let i = 1; i < affiliateSets.length; i++) {
    const current = Array.from(intersection)
    intersection.clear()
    current.forEach((aff) => {
      if (affiliateSets[i].has(aff)) {
        intersection.add(aff)
      }
    })
  }

  return Array.from(intersection)
}

/**
 * Get unique affiliates across multiple countries (union)
 */
export function getAllUniqeAffiliates(...countryCodes: string[]): string[] {
  const union = new Set<string>()

  countryCodes.forEach((code) => {
    const prefs = getAffiliatesForCountry(code)
    prefs.forEach((a) => union.add(a.toLowerCase()))
  })

  return Array.from(union)
}
