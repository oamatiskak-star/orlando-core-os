import { readFileSync } from 'fs'
import { supabase } from '../supabase'
import { logger } from '../logger'
import { computeDedupeKey } from '../fund-fit'
import type { FundInvestorType } from '../types'

// ── OpenVC / Dealroom / RVO CSV-seed import ──────────────────────────────────
// Legaal seed-pad: handmatige CSV-export uit OpenVC (of Dealroom/RVO/EU-portal),
// GEEN ToS-schendende scraping. Parseert een CSV en insert nieuwe fund_prospects
// (status='nieuw') + optionele primaire fund_contact. Idempotent via dedupe_key.
//
// Verwachte CSV-kolommen (case-insensitive, ontbrekende kolommen zijn ok):
//   name, investor_type, thesis, focus_sectors, stage_focus,
//   ticket_min_eur, ticket_max_eur, geo_focus, website, source, source_url,
//   notable_portfolio, contact_name, contact_role, contact_email,
//   contact_linkedin, warm_intro_path
// Lijst-kolommen (focus_sectors/stage_focus/geo_focus/notable_portfolio) mogen
// puntkomma- of pipe-gescheiden zijn: "proptech;ai;saas".

const VALID_TYPES: FundInvestorType[] = [
  'vc', 'angel', 'family_office', 'accelerator',
  'grant', 'corporate_vc', 'rom', 'crowdfunding',
]

export interface CsvImportResult {
  rowsRead: number
  prospectsInserted: number
  prospectsSkipped: number
  contactsInserted: number
}

/** Minimale RFC-4180 CSV-parser (quoted fields, embedded comma/quote/newline). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let field = ''
  let row: string[] = []
  let inQuotes = false

  // Normaliseer line endings en strip een eventuele UTF-8 BOM.
  const src = text.replace(/^﻿/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n')

  for (let i = 0; i < src.length; i++) {
    const ch = src[i]
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') { field += '"'; i++ }
        else inQuotes = false
      } else {
        field += ch
      }
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === ',') {
      row.push(field); field = ''
    } else if (ch === '\n') {
      row.push(field); field = ''
      rows.push(row); row = []
    } else {
      field += ch
    }
  }
  // Laatste veld/rij.
  if (field.length > 0 || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  // Verwijder volledig lege rijen.
  return rows.filter(r => r.some(c => c.trim().length > 0))
}

function splitList(value: string | undefined): string[] {
  if (!value) return []
  return value
    .split(/[;|]/)
    .map(v => v.trim())
    .filter(Boolean)
}

function parseNum(value: string | undefined): number | null {
  if (!value) return null
  const cleaned = value.replace(/[€$\s]/g, '').replace(/\.(?=\d{3}\b)/g, '').replace(',', '.')
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : null
}

function normaliseType(raw: string | undefined): FundInvestorType {
  const t = (raw ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_')
  return (VALID_TYPES as string[]).includes(t) ? (t as FundInvestorType) : 'vc'
}

/**
 * Importeert een CSV-bestand naar fund_prospects (+ fund_contacts).
 * @param filePath absoluut pad naar de CSV-export.
 * @param defaultSource bron-label wanneer de CSV geen `source`-kolom heeft.
 */
export async function importOpenVcCsv(
  filePath: string,
  defaultSource = 'openvc',
): Promise<CsvImportResult> {
  const text = readFileSync(filePath, 'utf8')
  const rows = parseCsv(text)
  const result: CsvImportResult = {
    rowsRead: 0, prospectsInserted: 0, prospectsSkipped: 0, contactsInserted: 0,
  }

  if (rows.length < 2) {
    logger.warn(`importOpenVcCsv: geen datarijen in ${filePath}`)
    return result
  }

  const header = rows[0].map(h => h.trim().toLowerCase())
  const col = (name: string) => header.indexOf(name)
  const get = (r: string[], name: string): string | undefined => {
    const idx = col(name)
    return idx >= 0 ? r[idx]?.trim() : undefined
  }

  for (const r of rows.slice(1)) {
    result.rowsRead++
    const name = get(r, 'name')
    if (!name) { result.prospectsSkipped++; continue }

    const website = get(r, 'website') ?? null
    const dedupeKey = computeDedupeKey(name, website)

    // Skip wanneer dedupe_key al bestaat (idempotent).
    const { data: existing } = await supabase
      .from('fund_prospects')
      .select('id')
      .eq('dedupe_key', dedupeKey)
      .maybeSingle()

    if (existing) { result.prospectsSkipped++; continue }

    const { data: inserted, error } = await supabase
      .from('fund_prospects')
      .insert({
        name,
        investor_type:     normaliseType(get(r, 'investor_type')),
        thesis:            get(r, 'thesis') ?? null,
        focus_sectors:     splitList(get(r, 'focus_sectors')),
        stage_focus:       splitList(get(r, 'stage_focus')),
        ticket_min_eur:    parseNum(get(r, 'ticket_min_eur')),
        ticket_max_eur:    parseNum(get(r, 'ticket_max_eur')),
        geo_focus:         splitList(get(r, 'geo_focus')),
        website,
        source:            get(r, 'source') ?? defaultSource,
        source_url:        get(r, 'source_url') ?? null,
        notable_portfolio: splitList(get(r, 'notable_portfolio')),
        status:            'nieuw',
        dedupe_key:        dedupeKey,
      })
      .select('id')
      .single()

    if (error || !inserted) {
      logger.error(`importOpenVcCsv: insert mislukt voor "${name}"`, { err: error?.message })
      result.prospectsSkipped++
      continue
    }
    result.prospectsInserted++

    await supabase.from('fund_activity_log').insert({
      prospect_id: inserted.id,
      agent:       'InvestorScoutAI',
      action:      'discovered',
      detail:      { source: get(r, 'source') ?? defaultSource, via: 'csv_import' },
    })

    // Optionele primaire contactpersoon.
    const contactName = get(r, 'contact_name')
    if (contactName) {
      const { error: cErr } = await supabase.from('fund_contacts').insert({
        prospect_id:     inserted.id,
        name:            contactName,
        role:            get(r, 'contact_role') ?? null,
        email:           get(r, 'contact_email') ?? null,
        linkedin_url:    get(r, 'contact_linkedin') ?? null,
        warm_intro_path: get(r, 'warm_intro_path') ?? null,
        is_primary:      true,
      })
      if (!cErr) result.contactsInserted++
    }
  }

  logger.info('importOpenVcCsv done', { filePath, ...result })
  return result
}
