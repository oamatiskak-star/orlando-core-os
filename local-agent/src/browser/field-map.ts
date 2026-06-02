/**
 * Field-map laden + selector-resolutie voor de browser-registration runner.
 * De map is data-driven (tabel account_setup_field_maps, migratie 103): nieuwe
 * programma's vergen geen code, alleen een seed-rij.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Page } from 'playwright'

export type FieldStrategy = 'fill' | 'select' | 'check' | 'click'

export type FieldDescriptor = {
  field: string             // logische naam (bv. "business_email")
  source: string            // bv. "business_profiles.contact_email" | "credential.generated_password"
  selectors: string[]       // kandidaat-CSS-selectors, in volgorde geprobeerd
  strategy: FieldStrategy
  gated?: boolean           // true → vraagt goedkeuring vóór invullen
  sensitive?: boolean       // true → waarde nooit loggen / maskeren
}

export type ExtractTarget = 'page_text' | 'page_html' | 'url'

/** Oogst een waarde van de pagina (bv. GA4 Measurement-ID, Meta Pixel-ID) na afloop. */
export type ExtractDescriptor = {
  field: string             // logische naam (bv. "ga4_measurement_id")
  target_column: string     // kolom op affiliate_programs om de waarde naar terug te schrijven
  pattern: string           // JS-regex; capture-group 1 wint indien aanwezig, anders de hele match
  from?: ExtractTarget      // waar zoeken (default 'page_text')
  selectors?: string[]      // optioneel: beperk tot innerText van de eerste bestaande selector
}

export type FieldMap = {
  id: string
  program_id: string
  signup_url: string
  fields: FieldDescriptor[]
  success_patterns: string[]
  submit_selectors: string[]
  extract: ExtractDescriptor[]
}

export async function loadFieldMap(db: SupabaseClient, programId: string): Promise<FieldMap | null> {
  const { data } = await db
    .from('account_setup_field_maps')
    .select('id, program_id, signup_url, fields, success_patterns, submit_selectors, extract')
    .eq('program_id', programId)
    .maybeSingle()
  if (!data) return null
  const row = data as Partial<FieldMap>
  return { ...(row as FieldMap), extract: row.extract ?? [] }
}

/** Eerste selector uit de lijst die op de pagina bestaat (patroon uit auth-flow.ts). */
export async function firstAvailable(page: Page, candidates: string[]): Promise<string | null> {
  for (const sel of candidates) {
    try {
      if ((await page.locator(sel).count()) > 0) return sel
    } catch { /* probeer volgende */ }
  }
  return null
}
