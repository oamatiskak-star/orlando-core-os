// ─────────────────────────────────────────────────────────────────────────────
// DISCOVERY-KEYWORDS — waarop de scraper zelf nieuwe virale video's + kanalen zoekt.
// Elke keyword kost 100 quota-units (search.list), dus houd de lijst behapbaar.
// De discovery-runner respecteert DISCOVERY_MAX_SEARCHES (default 8) per run.
//
// CUREER per niche. regionCode/relevanceLanguage staan in de runner op NL/nl.
// ─────────────────────────────────────────────────────────────────────────────

export interface DiscoveryNiche {
  niche: string
  language: string
  keywords: string[]
}

export const DISCOVERY_NICHES: DiscoveryNiche[] = [
  { niche: 'beleggen', language: 'nl', keywords: ['beleggen voor beginners', 'dividend beleggen', 'ETF beleggen'] },
  { niche: 'sparen',   language: 'nl', keywords: ['geld besparen tips', 'financiële onafhankelijkheid'] },
  { niche: 'vastgoed', language: 'nl', keywords: ['vastgoed beleggen', 'huis verhuren rendement'] },
  { niche: 'crypto',   language: 'nl', keywords: ['crypto uitleg nederlands', 'bitcoin nederland'] },
]
