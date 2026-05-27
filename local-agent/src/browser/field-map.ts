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

export type FieldMap = {
  id: string
  program_id: string
  signup_url: string
  fields: FieldDescriptor[]
  success_patterns: string[]
  submit_selectors: string[]
}

export async function loadFieldMap(db: SupabaseClient, programId: string): Promise<FieldMap | null> {
  const { data } = await db
    .from('account_setup_field_maps')
    .select('id, program_id, signup_url, fields, success_patterns, submit_selectors')
    .eq('program_id', programId)
    .maybeSingle()
  return (data as FieldMap) ?? null
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
