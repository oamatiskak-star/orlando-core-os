// Directe import van Dyme transactions.xlsx naar Supabase
// Gebruik: cd scripts && node import-dyme.js

const XLSX    = require('../frontend/node_modules/xlsx')
const { createClient } = require('../frontend/node_modules/@supabase/supabase-js')
const path    = require('path')
const fs      = require('fs')

const SUPABASE_URL      = 'https://shaunumewswpxhmgbtvv.supabase.co'
const SUPABASE_KEY      = process.env.SUPABASE_SERVICE_KEY
const DYME_FILE         = path.join(process.env.HOME, 'Documents/Dyme/transactions.xlsx')

if (!SUPABASE_KEY) {
  console.error('Zet SUPABASE_SERVICE_KEY als environment variable')
  process.exit(1)
}

const DYME_CAT_MAP = {
  'sparen':                        'sparen',
  'uitgesloten overboekingen':     'overig',
  'bank':                          'abonnementen',
  'streaming diensten':            'abonnementen',
  'elektronica':                   'overig',
  'aansprakelijkheidsverzekering': 'verzekering',
  'software':                      'abonnementen',
  'mobiel':                        'abonnementen',
  'zakelijke uitgaven':            'overig',
  'internet & tv':                 'abonnementen',
  'sport':                         'sport',
  'kinderen':                      'overig',
  'renovatie en reparaties':       'wonen',
  'verzekering':                   'verzekering',
  'huur':                          'wonen',
  'energie':                       'wonen',
  'zorgverzekering':               'gezondheid',
  'winkelen - overig':             'kleding',
  'restaurants':                   'horeca',
  'services':                      'overig',
  'geld opnemen':                  'overig',
  'auto':                          'auto',
  'overig':                        'overig',
  'boodschappen':                  'boodschappen',
  'vaste lasten - overig':         'abonnementen',
  'alcohol & tabak':               'horeca',
  'autoverzekering':               'auto',
  'openbaar vervoer':              'transport',
  'uiterlijk':                     'kleding',
  'hypotheek & leningen':          'wonen',
  'vakantie & accomodatie':        'entertainment',
  'bars & clubs':                  'horeca',
  'kleding & accessoires':         'kleding',
  'medicijnen':                    'gezondheid',
  'eten & drinken - overig':       'horeca',
  'vervoer - overig':              'transport',
  'betaalverzoek':                 'overig',
  'ongecategoriseerd':             'overig',
  'lunch & koffie':                'horeca',
  'evenementen & uitjes':          'entertainment',
  "cadeau's":                      'overig',
  'toeslagen':                     'belasting',
  'boeken, kranten & tijdschriften':'entertainment',
  'huisdieren':                    'overig',
  'entertainment - overig':        'entertainment',
  'overige overboekingen':         'overig',
  'inrichting & meubilair':        'wonen',
  'onderwijs':                     'overig',
  'tuin':                          'wonen',
  'gezondheidszorg':               'gezondheid',
  'inkomen':                       'salaris',
  'salaris':                       'salaris',
  'investeren':                    'investeren',
}

async function main() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

  console.log('📂 Dyme bestand lezen:', DYME_FILE)
  const wb    = XLSX.readFile(DYME_FILE)
  const sheet = wb.Sheets['Transacties']
  const rows  = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '' })

  const headers = rows[0].map(h => h.toLowerCase().trim())
  const col = name => headers.indexOf(name)

  const iIban  = col('iban')
  const iName  = col('tegenpartij naam')
  const iCIban = col('tegenpartij iban')
  const iAmt   = col('bedrag')
  const iDesc  = col('omschrijving')
  const iCat   = col('categorie')
  const iDate  = col('datum')

  const iban = rows[1]?.[iIban] ?? null
  console.log(`💳 IBAN: ${iban}`)
  console.log(`📊 ${rows.length - 1} transacties gevonden`)

  // Maak import verbinding aan
  let connId
  const { data: existing } = await supabase
    .from('personal_bank_connections')
    .select('id')
    .eq('status', 'import')
    .single()

  if (existing) {
    connId = existing.id
    console.log('🔗 Bestaande import-verbinding:', connId)
  } else {
    const { data: newConn, error } = await supabase
      .from('personal_bank_connections')
      .insert({ bank_id: 'IMPORT', bank_name: 'Dyme Import', iban, status: 'import' })
      .select('id')
      .single()
    if (error) { console.error('❌ Verbinding aanmaken mislukt:', error.message); process.exit(1) }
    connId = newConn.id
    console.log('✅ Nieuwe import-verbinding:', connId)
  }

  // Batch import — 100 per keer
  let inserted = 0, skipped = 0, errors = 0
  const txList = []

  for (let i = 1; i < rows.length; i++) {
    const cols = rows[i]
    if (!cols || !cols[iDate]) continue

    const dateRaw = cols[iDate]?.trim() ?? ''
    const date    = dateRaw.slice(0, 10)
    if (!date || date.length < 10) continue

    const rawAmt    = parseFloat((cols[iAmt] ?? '0').toString().replace(',', '.')) || 0
    const amount    = Math.abs(rawAmt)
    const direction = rawAmt >= 0 ? 'credit' : 'debet'
    const name      = cols[iName]?.trim() ?? ''
    const desc      = cols[iDesc]?.trim() ?? ''
    const cIban     = cols[iCIban]?.trim() || null
    const dymeC     = (cols[iCat] ?? '').toLowerCase().trim()
    const category  = DYME_CAT_MAP[dymeC] ?? 'overig'

    txList.push({
      connection_id:  connId,
      external_id:    `dyme-xlsx-${date}-${i}-${rawAmt}`,
      booking_date:   date,
      value_date:     date,
      amount,
      currency:       'EUR',
      description:    (desc || name).slice(0, 500),
      creditor_name:  direction === 'debet' ? (name || null) : null,
      debtor_name:    direction === 'credit' ? (name || null) : null,
      creditor_iban:  direction === 'debet' ? cIban : null,
      debtor_iban:    direction === 'credit' ? cIban : null,
      direction,
      category,
      subcategory:    dymeC || null,
      ai_confidence:  0.85,
      is_salary:      category === 'salaris',
      is_savings:     category === 'sparen',
      is_investment:  category === 'investeren',
      is_housing:     category === 'wonen',
      raw_data:       { source: 'dyme', dyme_cat: dymeC },
    })
  }

  // Upsert in batches van 100
  const BATCH = 100
  for (let b = 0; b < txList.length; b += BATCH) {
    const batch = txList.slice(b, b + BATCH)
    const { error } = await supabase
      .from('personal_transactions')
      .upsert(batch, { onConflict: 'external_id', ignoreDuplicates: true })

    if (error) {
      console.error(`❌ Batch ${b/BATCH + 1} fout:`, error.message)
      errors += batch.length
    } else {
      inserted += batch.length
      process.stdout.write(`\r⏳ ${inserted}/${txList.length} transacties verwerkt...`)
    }
  }

  console.log(`\n\n✅ Klaar!`)
  console.log(`   Verwerkt: ${txList.length}`)
  console.log(`   Ingevoerd: ${inserted}`)
  console.log(`   Fouten: ${errors}`)
}

main().catch(console.error)
