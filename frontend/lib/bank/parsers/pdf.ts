// ING PDF rekeningafschrift parser — pdftotext layout-based
// ING formaat: DD-MM-YYYY  Naam  Type  Bedrag (EUR)

import { execSync } from 'child_process'
import { writeFileSync, unlinkSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import type { ParsedTransaction } from './mt940'

const TX_TYPES = [
  'Betaalautomaat','Online bankieren','iDEAL','Incasso','Diversen','Overboeking',
  'Internetsparen','Spaarrente','Salaris','Storting','Opname',
  'Periodieke overboeking','Creditcard','Apple Pay','Wero',
]

const CAT_KEYWORDS: Record<string, string[]> = {
  boodschappen:  ['albert heijn','jumbo','aldi','lidl','plus ','dirk','ah ','c&m','safari supermarkt','spar ','dekamarkt'],
  horeca:        ['restaurant','cafe ','bar ','mc donalds','mcdonalds','burger king','subway','dominos','pizza','kfc','starbucks','lunch','koffie'],
  auto:          ['shell','bp ','esso','texaco','total ','q8','parkeer','carwash','rdw','volkswagen'],
  transport:     ['ns.nl','ovchip','gvb','ret ','htm ','arriva','connexxion','flixbus','ryanair','transavia','klm '],
  wonen:         ['huur','hypotheek','nuon','vattenfall','eneco','essent','allianz','centraal beheer'],
  abonnementen:  ['spotify','netflix','disney','amazon','apple.com','google','kpn','t-mobile','vodafone','kosten betaal','kosten oranje','go daddy','godaddy'],
  gezondheid:    ['apotheek','huisarts','tandarts','ziekenhuis','drogist','etos','kruidvat'],
  kleding:       ['zara','h&m','primark','c&a','only','we fashion','hema'],
  entertainment: ['bioscoop','bol.com','steam','playstation','xbox','pathe'],
  sparen:        ['oranje spaar','van oranje','internetsparen','spaarrente'],
  investeren:    ['degiro','binck','trading','coinbase','kraken'],
}

function categorizePdf(name: string, desc: string): string {
  const t = (name + ' ' + desc).toLowerCase()
  for (const [cat, kws] of Object.entries(CAT_KEYWORDS)) {
    if (kws.some(k => t.includes(k))) return cat
  }
  return 'overig'
}

function parseNlAmount(s: string): number {
  return parseFloat(s.replace(/\./g, '').replace(',', '.').replace('+', ''))
}

function nlDateToIso(s: string): string {
  const [d, m, y] = s.split('-')
  return `${y}-${m}-${d}`
}

function splitNameType(raw: string): [string, string] {
  for (const t of TX_TYPES) {
    const i = raw.lastIndexOf(t)
    if (i > 0) return [raw.slice(0, i).trim(), t]
  }
  return [raw.trim(), '']
}

export async function parsePdf(buffer: Buffer): Promise<{ transactions: ParsedTransaction[]; iban: string | null }> {
  // Schrijf buffer naar tmp bestand, gebruik pdftotext -layout
  const tmpFile = join(tmpdir(), `ing-stmt-${Date.now()}.pdf`)
  const txtFile = tmpFile.replace('.pdf', '.txt')

  try {
    writeFileSync(tmpFile, buffer)
    execSync(`pdftotext -layout "${tmpFile}" "${txtFile}"`, { timeout: 30000 })

    const { readFileSync } = await import('fs')
    const text  = readFileSync(txtFile, 'utf-8')
    const lines = text.split('\n')

    // IBAN detectie
    const ibanMatch = text.match(/([A-Z]{2}\d{2}\s*[A-Z]{4}\s*\d[\d\s]+)/)
    const iban = ibanMatch ? ibanMatch[1].replace(/\s/g, '') : null

    const transactions: ParsedTransaction[] = []
    let idx = 0

    for (let i = 0; i < lines.length; i++) {
      const l = lines[i]
      const m = l.match(/^\s{0,25}(\d{2}-\d{2}-\d{4})\s+(.+)\s{3,}([+-]?\d[\d.]*,\d{2})\s*$/)
      if (!m) continue

      const [, dateRaw, nameRaw, amtRaw] = m
      const date    = nlDateToIso(dateRaw)
      const rawAmt  = parseNlAmount(amtRaw)
      const amount  = Math.abs(rawAmt)
      const dir: 'credit' | 'debet' = rawAmt >= 0 ? 'credit' : 'debet'
      const [name, txType] = splitNameType(nameRaw)

      let contraIban: string | null = null
      let omschrijving = ''
      for (let j = i + 1; j < Math.min(i + 8, lines.length); j++) {
        const dl = lines[j]
        if (/^\s{0,25}\d{2}-\d{2}-\d{4}\s/.test(dl)) break
        const im = dl.match(/IBAN:\s*([A-Z]{2}\d{2}[A-Z0-9 ]+)/)
        if (im) contraIban = im[1].replace(/\s/g, '')
        const om = dl.match(/Omschrijving:\s*(.+)/)
        if (om) omschrijving = om[1].trim()
      }

      const cat = categorizePdf(name, omschrijving)

      transactions.push({
        external_id:   `ing-pdf-${iban ?? 'x'}-${date}-${idx++}-${rawAmt}`,
        booking_date:  date,
        value_date:    date,
        amount,
        direction:     dir,
        description:   (omschrijving || name).slice(0, 499),
        creditor_name: dir === 'debet'  ? name.slice(0, 499) : null,
        debtor_name:   dir === 'credit' ? name.slice(0, 499) : null,
        creditor_iban: dir === 'debet'  ? contraIban : null,
        debtor_iban:   dir === 'credit' ? contraIban : null,
        currency:      'EUR',
        raw:           `${txType}|${name}`.slice(0, 499),
      })
    }

    return { transactions, iban }
  } finally {
    try { unlinkSync(tmpFile) } catch { /* ignore */ }
    try { unlinkSync(txtFile) } catch { /* ignore */ }
  }
}
