// XLSX parser — Dyme export formaat
// Kolommen: IBAN | Tegenpartij Naam | Tegenpartij IBAN | Bedrag | Omschrijving | Categorie | Super-categorie | Datum | Tijd

import type { ParsedTransaction } from './mt940'

// eslint-disable-next-line @typescript-eslint/no-require-imports
const XLSX = require('xlsx')

// Dyme categorie → onze categorie mapping
const DYME_CAT_MAP: Record<string, string> = {
  'sparen':                       'sparen',
  'uitgesloten overboekingen':     'overig',
  'bank':                         'abonnementen',
  'streaming diensten':           'abonnementen',
  'elektronica':                  'overig',
  'aansprakelijkheidsverzekering':'verzekering',
  'software':                     'abonnementen',
  'mobiel':                       'abonnementen',
  'zakelijke uitgaven':           'overig',
  'internet & tv':                'abonnementen',
  'sport':                        'sport',
  'kinderen':                     'overig',
  'renovatie en reparaties':      'wonen',
  'verzekering':                  'verzekering',
  'huur':                         'wonen',
  'energie':                      'wonen',
  'zorgverzekering':              'gezondheid',
  'winkelen - overig':            'kleding',
  'restaurants':                  'horeca',
  'services':                     'overig',
  'geld opnemen':                 'overig',
  'auto':                         'auto',
  'overig':                       'overig',
  'boodschappen':                 'boodschappen',
  'vaste lasten - overig':        'abonnementen',
  'alcohol & tabak':              'horeca',
  'autoverzekering':              'auto',
  'openbaar vervoer':             'transport',
  'uiterlijk':                    'kleding',
  'hypotheek & leningen':         'wonen',
  'vakantie & accomodatie':       'entertainment',
  'bars & clubs':                 'horeca',
  'kleding & accessoires':        'kleding',
  'medicijnen':                   'gezondheid',
  'eten & drinken - overig':      'horeca',
  'vervoer - overig':             'transport',
  'betaalverzoek':                'overig',
  'ongecategoriseerd':            'overig',
  'lunch & koffie':               'horeca',
  'evenementen & uitjes':         'entertainment',
  "cadeau's":                     'overig',
  'toeslagen':                    'belasting',
  'boeken, kranten & tijdschriften': 'entertainment',
  'huisdieren':                   'overig',
  'entertainment - overig':       'entertainment',
  'overige overboekingen':        'overig',
  'inrichting & meubilair':       'wonen',
  'onderwijs':                    'overig',
  'tuin':                         'wonen',
  'gezondheidszorg':              'gezondheid',
  'inkomen':                      'salaris',
  'salaris':                      'salaris',
  'investeren':                   'investeren',
}

function mapDymeCat(cat: string): string {
  return DYME_CAT_MAP[cat?.toLowerCase()?.trim()] ?? 'overig'
}

export function parseXlsx(buffer: Buffer): { transactions: ParsedTransaction[]; iban: string | null } {
  const wb    = XLSX.read(buffer, { type: 'buffer' })
  const sheet = wb.Sheets['Transacties'] ?? wb.Sheets[wb.SheetNames[0]]
  const rows: string[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '' })

  if (rows.length < 2) return { transactions: [], iban: null }

  const headers = rows[0].map((h: string) => h.toLowerCase().trim())
  const iIban   = headers.indexOf('iban')
  const iName   = headers.indexOf('tegenpartij naam')
  const iCIban  = headers.indexOf('tegenpartij iban')
  const iAmt    = headers.indexOf('bedrag')
  const iDesc   = headers.indexOf('omschrijving')
  const iCat    = headers.indexOf('categorie')
  const iDate   = headers.indexOf('datum')

  const iban = iIban >= 0 && rows[1]?.[iIban] ? rows[1][iIban] : null

  const transactions: ParsedTransaction[] = []

  for (let i = 1; i < rows.length; i++) {
    const cols = rows[i]
    if (!cols || cols.length < 4) continue

    const dateRaw = cols[iDate]?.trim() ?? ''
    if (!dateRaw) continue

    // Datum is al YYYY-MM-DD vanuit Dyme
    const bookingDate = dateRaw.slice(0, 10)

    const rawAmt    = parseFloat((cols[iAmt] ?? '0').toString().replace(',', '.')) || 0
    const amount    = Math.abs(rawAmt)
    const direction: 'credit' | 'debet' = rawAmt >= 0 ? 'credit' : 'debet'

    const name   = cols[iName]?.trim()  ?? ''
    const desc   = cols[iDesc]?.trim()  ?? ''
    const cIban  = cols[iCIban]?.trim() ?? null
    const dymeC  = cols[iCat]?.trim()   ?? ''
    const cat    = mapDymeCat(dymeC)

    transactions.push({
      external_id:   `dyme-xlsx-${bookingDate}-${i}-${rawAmt}`,
      booking_date:  bookingDate,
      value_date:    null,
      amount,
      direction,
      description:   (desc || name).slice(0, 500),
      creditor_name: direction === 'debet' ? (name || null) : null,
      debtor_name:   direction === 'credit' ? (name || null) : null,
      creditor_iban: direction === 'debet' ? (cIban || null) : null,
      debtor_iban:   direction === 'credit' ? (cIban || null) : null,
      currency:      'EUR',
      raw:           JSON.stringify({ name, desc, cat: dymeC, amt: rawAmt }).slice(0, 500),
      // Dyme categorie als extra context
      _dyme_cat:     cat,
    } as ParsedTransaction & { _dyme_cat: string })
  }

  return { transactions, iban }
}
