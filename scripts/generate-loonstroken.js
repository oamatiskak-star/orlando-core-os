#!/usr/bin/env node
// Genereer officiële DGA loonstroken als PDF
// O.S.M. Amatiskak · Modiwerijo Financial Management BV
// Uitvoer: ~/Documenten/Loonstroken 2025 OSM Amatiskak/

const PDFDocument = require('pdfkit')
const fs          = require('fs')
const path        = require('path')
const os          = require('os')

const OUTPUT_DIR = path.join(os.homedir(), 'Documenten', 'Loonstroken 2025 OSM Amatiskak')
fs.mkdirSync(OUTPUT_DIR, { recursive: true })

const MAANDEN = [
  'Januari','Februari','Maart','April','Mei','Juni',
  'Juli','Augustus','September','Oktober','November','December',
]

const LOONSTROKEN = [
  // 2025 — volledig jaar
  { periode:'2025-01', bruto:5833.00, loonheffing:2157.00, heffingskorting:387.00, netto:4063.00, vakantiegeld:0,       betaald_op:'25 januari 2025',   status:'Betaald' },
  { periode:'2025-02', bruto:5833.00, loonheffing:2157.00, heffingskorting:387.00, netto:4063.00, vakantiegeld:0,       betaald_op:'25 februari 2025',  status:'Betaald' },
  { periode:'2025-03', bruto:5833.00, loonheffing:2157.00, heffingskorting:387.00, netto:4063.00, vakantiegeld:0,       betaald_op:'25 maart 2025',     status:'Betaald' },
  { periode:'2025-04', bruto:5833.00, loonheffing:2157.00, heffingskorting:387.00, netto:4063.00, vakantiegeld:0,       betaald_op:'25 april 2025',     status:'Betaald' },
  { periode:'2025-05', bruto:5833.00, loonheffing:2157.00, heffingskorting:387.00, netto:4063.00, vakantiegeld:5599.68, betaald_op:'25 mei 2025',       status:'Betaald' },
  { periode:'2025-06', bruto:5833.00, loonheffing:2157.00, heffingskorting:387.00, netto:4063.00, vakantiegeld:0,       betaald_op:'25 juni 2025',      status:'Betaald' },
  { periode:'2025-07', bruto:5833.00, loonheffing:2157.00, heffingskorting:387.00, netto:4063.00, vakantiegeld:0,       betaald_op:'25 juli 2025',      status:'Betaald' },
  { periode:'2025-08', bruto:5833.00, loonheffing:2157.00, heffingskorting:387.00, netto:4063.00, vakantiegeld:0,       betaald_op:'25 augustus 2025',  status:'Betaald' },
  { periode:'2025-09', bruto:5833.00, loonheffing:2157.00, heffingskorting:387.00, netto:4063.00, vakantiegeld:0,       betaald_op:'25 september 2025', status:'Betaald' },
  { periode:'2025-10', bruto:5833.00, loonheffing:2157.00, heffingskorting:387.00, netto:4063.00, vakantiegeld:0,       betaald_op:'25 oktober 2025',   status:'Betaald' },
  { periode:'2025-11', bruto:5833.00, loonheffing:2157.00, heffingskorting:387.00, netto:4063.00, vakantiegeld:0,       betaald_op:'25 november 2025',  status:'Betaald' },
  { periode:'2025-12', bruto:5833.00, loonheffing:2157.00, heffingskorting:387.00, netto:4063.00, vakantiegeld:0,       betaald_op:'24 december 2025',  status:'Betaald' },
  // 2026 — jan t/m mei
  { periode:'2026-01', bruto:5833.00, loonheffing:2157.00, heffingskorting:387.00, netto:4063.00, vakantiegeld:0, betaald_op:'25 januari 2026',  status:'Betaald' },
  { periode:'2026-02', bruto:5833.00, loonheffing:2157.00, heffingskorting:387.00, netto:4063.00, vakantiegeld:0, betaald_op:'25 februari 2026', status:'Betaald' },
  { periode:'2026-03', bruto:5833.00, loonheffing:2157.00, heffingskorting:387.00, netto:4063.00, vakantiegeld:0, betaald_op:'25 maart 2026',    status:'Betaald' },
  { periode:'2026-04', bruto:5833.00, loonheffing:2157.00, heffingskorting:387.00, netto:4063.00, vakantiegeld:0, betaald_op:'25 april 2026',    status:'Betaald' },
  { periode:'2026-05', bruto:5833.00, loonheffing:2157.00, heffingskorting:387.00, netto:4063.00, vakantiegeld:0, betaald_op:'25 mei 2026',      status:'Definitief' },
]

function eur(n) {
  return '€ ' + n.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function maandLabel(periode) {
  const [y, m] = periode.split('-')
  return `${MAANDEN[parseInt(m) - 1]} ${y}`
}

function row(doc, x, y, label, value, bold = false, highlight = false) {
  if (highlight) {
    doc.rect(x - 8, y - 11, 490, 18).fill('#0f0f1e')
    doc.fillColor('#a5b4fc')
  } else {
    doc.fillColor(bold ? '#ffffff' : '#94a3b8')
  }

  doc.font(bold ? 'Helvetica-Bold' : 'Helvetica')
     .fontSize(9)
     .text(label, x, y, { width: 280 })

  doc.font('Helvetica-Bold')
     .fillColor(highlight ? '#a5b4fc' : bold ? '#ffffff' : '#e2e8f0')
     .text(value, x + 280, y, { width: 190, align: 'right' })
}

function divider(doc, x, y) {
  doc.moveTo(x, y).lineTo(x + 474, y).strokeColor('#1e293b').lineWidth(0.5).stroke()
}

function generatePDF(strook) {
  const [year, month] = strook.periode.split('-')
  const label         = maandLabel(strook.periode)
  const filename      = `Loonstrook_${strook.periode}_OSM_Amatiskak.pdf`
  const outPath       = path.join(OUTPUT_DIR, filename)

  const doc = new PDFDocument({
    size: 'A4',
    margin: 0,
    info: {
      Title:    `Loonstrook ${label}`,
      Author:   'Modiwerijo Financial Management BV',
      Subject:  'DGA Loonstrook O.S.M. Amatiskak',
      Keywords: 'loonstrook dga salaris',
      Creator:  'Orlando Core OS',
    },
  })

  const stream = fs.createWriteStream(outPath)
  doc.pipe(stream)

  const W  = 595
  const H  = 842
  const mx = 60   // margin x

  // ── Achtergrond ──────────────────────────────────────────────────────────
  doc.rect(0, 0, W, H).fill('#080812')

  // ── Header balk ──────────────────────────────────────────────────────────
  doc.rect(0, 0, W, 100).fill('#0d0d1f')

  // Accent lijn
  doc.rect(0, 100, W, 3).fill('#6366f1')

  // Bedrijfsnaam
  doc.fillColor('#ffffff')
     .font('Helvetica-Bold')
     .fontSize(15)
     .text('MODIWERIJO FINANCIAL MANAGEMENT BV', mx, 30)

  doc.fillColor('#6366f1')
     .font('Helvetica-Bold')
     .fontSize(9)
     .text('LOONSTROOK', mx, 55)

  // Periode rechts
  doc.fillColor('#94a3b8')
     .font('Helvetica')
     .fontSize(9)
     .text(`Periode: ${label}`, W - mx - 160, 30, { width: 160, align: 'right' })

  doc.fillColor(strook.status === 'Betaald' ? '#4ade80' : '#fbbf24')
     .font('Helvetica-Bold')
     .fontSize(8)
     .text(strook.status.toUpperCase(), W - mx - 160, 50, { width: 160, align: 'right' })

  doc.fillColor('#64748b')
     .font('Helvetica')
     .fontSize(7)
     .text(`Betaald op: ${strook.betaald_op}`, W - mx - 160, 65, { width: 160, align: 'right' })

  // ── Werknemer & Werkgever blok ────────────────────────────────────────────
  let y = 128

  // Linker kolom — werknemer
  doc.fillColor('#475569').font('Helvetica').fontSize(7).text('WERKNEMER', mx, y)
  y += 14
  doc.fillColor('#f1f5f9').font('Helvetica-Bold').fontSize(10).text('O.S.M. Amatiskak', mx, y)
  y += 14
  doc.fillColor('#94a3b8').font('Helvetica').fontSize(8)
     .text('Functie: Directeur-Grootaandeelhouder (DGA)', mx, y)
  y += 12
  doc.fillColor('#94a3b8').font('Helvetica').fontSize(8)
     .text('Dienstverband: Voltijd · Onbepaalde tijd', mx, y)

  // Rechter kolom — werkgever
  const rcx = W / 2 + 20
  doc.fillColor('#475569').font('Helvetica').fontSize(7).text('WERKGEVER', rcx, 128)
  doc.fillColor('#f1f5f9').font('Helvetica-Bold').fontSize(10).text('Modiwerijo Financial Management BV', rcx, 142)
  doc.fillColor('#94a3b8').font('Helvetica').fontSize(8).text('KvK: zie administratie', rcx, 156)
  doc.fillColor('#94a3b8').font('Helvetica').fontSize(8).text('Loonheffingsnummer: zie Belastingdienst', rcx, 168)

  // Divider
  y = 205
  doc.rect(mx, y, W - mx * 2, 1).fill('#1e293b')
  y += 16

  // ── BRUTO DEEL ────────────────────────────────────────────────────────────
  doc.fillColor('#475569').font('Helvetica').fontSize(7).text('BRUTODEEL', mx, y)
  y += 14

  const brutotot = strook.bruto + strook.vakantiegeld
  row(doc, mx, y, 'Bruto maandsalaris', eur(strook.bruto))
  y += 16

  if (strook.vakantiegeld > 0) {
    row(doc, mx, y, 'Vakantiegeld (8% × jaarsalaris)', eur(strook.vakantiegeld))
    y += 16
  }

  divider(doc, mx, y)
  y += 10
  row(doc, mx, y, 'Bruto totaal', eur(brutotot), true)
  y += 22

  // ── INHOUDINGEN ───────────────────────────────────────────────────────────
  doc.fillColor('#475569').font('Helvetica').fontSize(7).text('INHOUDINGEN', mx, y)
  y += 14

  row(doc, mx, y, 'Loonbelasting / premie volksverzekeringen', eur(strook.loonheffing))
  y += 16
  row(doc, mx, y, `  − Arbeidskorting`, eur(258))
  y += 14
  row(doc, mx, y, `  − Algemene heffingskorting`, eur(130))
  y += 14

  const nettoHeffing = strook.loonheffing - strook.heffingskorting
  divider(doc, mx, y)
  y += 10
  row(doc, mx, y, 'Totaal loonheffing (netto inhouding)', eur(nettoHeffing), true)
  y += 14
  row(doc, mx, y, 'Bijdrage ZVW werknemer (DGA)', eur(0))
  y += 14

  const totInhoud = nettoHeffing
  divider(doc, mx, y)
  y += 10
  row(doc, mx, y, 'Totaal inhoudingen', eur(totInhoud), true)
  y += 26

  // ── NETTO UITBETAALD ─────────────────────────────────────────────────────
  row(doc, mx, y, '◆  NETTO UITBETAALD', eur(strook.netto), true, true)
  y += 30

  // Vakantiegeld netto als extra
  if (strook.vakantiegeld > 0) {
    const vgLH    = Math.round(strook.vakantiegeld * 0.4950)
    const vgNetto = strook.vakantiegeld - vgLH
    row(doc, mx, y, `◆  VAKANTIEGELD NETTO (na bijzonder tarief 49.5%)`, eur(vgNetto), true, true)
    y += 30
  }

  // ── WERKGEVERSLASTEN ─────────────────────────────────────────────────────
  y += 6
  doc.rect(mx, y, W - mx * 2, 1).fill('#1e293b')
  y += 14

  doc.fillColor('#475569').font('Helvetica').fontSize(7).text('WERKGEVERSLASTEN (niet ingehouden)', mx, y)
  y += 14
  row(doc, mx, y, 'ZVW bijdrage werkgever (6.51%)', eur(379.81))
  y += 14
  row(doc, mx, y, 'Totale loonkosten werkgever per maand', eur(strook.bruto + 379.81))
  y += 20

  // ── JAARCIJFERS ───────────────────────────────────────────────────────────
  doc.rect(mx, y, W - mx * 2, 1).fill('#1e293b')
  y += 14

  doc.fillColor('#475569').font('Helvetica').fontSize(7).text('REFERENTIE JAARCIJFERS 2025', mx, y)
  y += 14

  const cols2 = [
    ['Fiscaal jaarinkomen', eur(69996)],
    ['Loonheffing per jaar', eur(25882)],
    ['Heffingskorting per jaar', eur(4649)],
    ['ZVW bijdrage werkgever/jaar', eur(4557)],
  ]
  cols2.forEach(([lbl, val]) => {
    row(doc, mx, y, lbl, val)
    y += 14
  })

  // ── BELASTINGTABEL INFO ───────────────────────────────────────────────────
  y += 10
  doc.rect(mx, y, W - mx * 2, 60).fillOpacity(0.3).fill('#1e293b').fillOpacity(1)
  doc.rect(mx, y, 3, 60).fill('#6366f1')

  doc.fillColor('#64748b').font('Helvetica').fontSize(7)
     .text('BELASTINGTABELINFORMATIE 2025', mx + 12, y + 8)

  doc.fillColor('#94a3b8').font('Helvetica').fontSize(7.5)
     .text(
       'Toegepaste tabel: Witte loonbelastingtabel maandloon · Niet-AOW-gerechtigde\n' +
       'Schijf 1 (t/m €38.441): 36,97%  ·  Schijf 2 (€38.441–€76.817): 36,97%  ·  Schijf 3 (>€76.817): 49,50%\n' +
       'Heffingskortingen: Alg. heffingskorting €130/mnd · Arbeidskorting €258/mnd',
       mx + 12, y + 20, { width: 460, lineGap: 2 }
     )

  // ── FOOTER ───────────────────────────────────────────────────────────────
  doc.rect(0, H - 55, W, 55).fill('#0d0d1f')
  doc.rect(0, H - 55, W, 2).fill('#6366f1')

  doc.fillColor('#64748b').font('Helvetica').fontSize(7)
     .text(
       'Dit loonstrook is gegenereerd door Orlando Core OS · Modiwerijo Financial Management BV · Vertrouwelijk document',
       mx, H - 38, { width: W - mx * 2, align: 'center' }
     )

  doc.fillColor('#374151').font('Helvetica').fontSize(6)
     .text(
       `Gegenereerd op: ${new Date().toLocaleDateString('nl-NL', { day: '2-digit', month: 'long', year: 'numeric' })}  ·  Periode: ${label}`,
       mx, H - 22, { width: W - mx * 2, align: 'center' }
     )

  doc.end()

  return new Promise((resolve, reject) => {
    stream.on('finish', () => {
      console.log(`✓  ${filename}`)
      resolve(outPath)
    })
    stream.on('error', reject)
  })
}

async function main() {
  console.log(`\n📁  Output: ${OUTPUT_DIR}\n`)
  console.log(`Genereren ${LOONSTROKEN.length} loonstroken...\n`)

  for (const strook of LOONSTROKEN) {
    await generatePDF(strook)
  }

  console.log(`\n✅  Alle ${LOONSTROKEN.length} loonstroken gegenereerd`)
  console.log(`📂  Locatie: ${OUTPUT_DIR}\n`)
}

main().catch(err => {
  console.error('Fout:', err.message)
  process.exit(1)
})
