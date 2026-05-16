// DGA Loonstrook berekening — NL 2025 belastingtabellen
// O.S.M. Amatiskak / Modiwerijo Financial Management BV

export type DgaInput = {
  bruto:           number   // bruto maandsalaris
  vakantiegeld?:   number   // vakantiegeld uitbetaling (eenmalig)
  bonus?:          number   // bonus / tantième
  pensioen?:       number   // eigen pensioenbijdrage
  periode:         string   // '2025-05'
  betaald_op?:     string   // betaaldatum ISO
}

export type DgaLoonstrook = {
  periode:          string
  // Brutodeel
  bruto_maand:      number
  vakantiegeld:     number
  bonus:            number
  bruto_totaal:     number
  // Inhoudingen
  loonheffing:      number
  algemene_heffkorting: number
  arbeidskorting:   number
  heffingskorting_totaal: number
  netto_loonheffing: number
  zvw_werknemer:    number  // Zvw DGA = 0 (werkgever betaalt)
  pensioen:         number
  // Netto
  netto_uitbetaald: number
  // Werkgeverslasten
  zvw_werkgever:    number
  // Berekeningsinfo
  tarief_box1_pct:  number
  jaarinkomen_est:  number
  betaald_op:       string | null
  status:           string
  // Supabase opslaan
  berekenings_data: Record<string, number>
}

// 2025 NL parameters
const PARAMS_2025 = {
  // Belastingschijven (loonbelasting + premie volksverzekeringen gecombineerd)
  schijf1_grens:    38_441,    // t/m €38.441
  schijf1_tarief:   0.3697,    // 36.97% (LB 9.32% + PVV 27.65%)
  schijf2_tarief:   0.3697,    // 36.97% (€38.441 - €76.817 zelfde gecombineerd tarief 2025)
  schijf2_grens:    76_817,    // t/m €76.817
  schijf3_tarief:   0.4950,    // 49.50% boven €76.817

  // Heffingskortingen
  alg_heffkorting_max:    3_977,   // max algemene heffingskorting
  alg_heffkorting_afbouw: 0.05363, // afbouw percentage boven drempel
  alg_heffkorting_drempel:24_814,  // inkomensgrens afbouw

  arbeidskorting_max:     5_053,   // max arbeidskorting (DGA actief)
  arbeidskorting_afbouw:  0.0651,  // afbouw boven €39.898
  arbeidskorting_drempel: 39_898,  // afbouwgrens

  // Zvw (Zorgverzekeringswet) 2025
  zvw_pct_werkgever: 0.0651,   // 6.51% werkgeversbijdrage
  zvw_max_bijdrage_jaar: 71_628, // maximumpremieloon

  vakantiegeld_pct: 0.0800,     // 8% vakantiegeldreservering
}

function bereken_loonheffing_jaar(jaarbruto: number): number {
  const p = PARAMS_2025
  if (jaarbruto <= p.schijf1_grens) {
    return jaarbruto * p.schijf1_tarief
  } else if (jaarbruto <= p.schijf2_grens) {
    return p.schijf1_grens * p.schijf1_tarief + (jaarbruto - p.schijf1_grens) * p.schijf2_tarief
  } else {
    return (
      p.schijf1_grens * p.schijf1_tarief +
      (p.schijf2_grens - p.schijf1_grens) * p.schijf2_tarief +
      (jaarbruto - p.schijf2_grens) * p.schijf3_tarief
    )
  }
}

function bereken_algemene_heffkorting(jaarbruto: number): number {
  const p = PARAMS_2025
  if (jaarbruto <= p.alg_heffkorting_drempel) return p.alg_heffkorting_max
  const afbouw = (jaarbruto - p.alg_heffkorting_drempel) * p.alg_heffkorting_afbouw
  return Math.max(0, p.alg_heffkorting_max - afbouw)
}

function bereken_arbeidskorting(jaarbruto: number): number {
  // DGA met actieve werkzaamheden heeft recht op arbeidskorting
  const p = PARAMS_2025
  if (jaarbruto <= p.arbeidskorting_drempel) return p.arbeidskorting_max
  const afbouw = (jaarbruto - p.arbeidskorting_drempel) * p.arbeidskorting_afbouw
  return Math.max(0, p.arbeidskorting_max - afbouw)
}

export function berekenDgaLoonstrook(input: DgaInput): DgaLoonstrook {
  const p = PARAMS_2025
  const vakantiegeld = input.vakantiegeld ?? 0
  const bonus        = input.bonus ?? 0
  const pensioen     = input.pensioen ?? 0
  const brutoMaand   = input.bruto
  const brutoTotaal  = brutoMaand + vakantiegeld + bonus

  // Jaarinkomen schatting (voor schijfberekening)
  const jaarbruto = brutoMaand * 12 + vakantiegeld + bonus

  // Jaarlijkse loonheffing voor dit inkomensniveau
  const loonheffingJaar       = bereken_loonheffing_jaar(jaarbruto)
  const algHeffkortingJaar    = bereken_algemene_heffkorting(jaarbruto)
  const arbeidskortingJaar    = bereken_arbeidskorting(jaarbruto)
  const heffkortingTotaalJaar = algHeffkortingJaar + arbeidskortingJaar

  // Netto loonheffing per jaar
  const nettoLoonheffingJaar = Math.max(0, loonheffingJaar - heffkortingTotaalJaar)

  // Per maand
  const loonheffingMaand       = loonheffingJaar / 12
  const algHeffkortingMaand    = algHeffkortingJaar / 12
  const arbeidskortingMaand    = arbeidskortingJaar / 12
  const heffkortingTotaalMaand = heffkortingTotaalJaar / 12
  const nettoLoonheffingMaand  = nettoLoonheffingJaar / 12

  // Zvw — DGA: werkgever betaalt, werknemer betaalt 0
  const zvwGrondslagJaar  = Math.min(jaarbruto, p.zvw_max_bijdrage_jaar)
  const zvwWerkgeverJaar  = zvwGrondslagJaar * p.zvw_pct_werkgever
  const zvwWerkgeverMaand = zvwWerkgeverJaar / 12

  // Extra inhoudingen op dit loonstrookje
  const extraLoonheffing = (vakantiegeld + bonus) > 0
    ? (vakantiegeld + bonus) * p.schijf2_tarief  // bijzondere beloning: toptarief
    : 0

  const totaalLoonheffing = nettoLoonheffingMaand + extraLoonheffing
  const nettoUitbetaald = brutoTotaal - totaalLoonheffing - pensioen

  const tarief = jaarbruto > p.schijf1_grens ? 49.50 : 36.97

  return {
    periode:           input.periode,
    bruto_maand:       Math.round(brutoMaand * 100) / 100,
    vakantiegeld:      Math.round(vakantiegeld * 100) / 100,
    bonus:             Math.round(bonus * 100) / 100,
    bruto_totaal:      Math.round(brutoTotaal * 100) / 100,
    loonheffing:       Math.round(loonheffingMaand * 100) / 100,
    algemene_heffkorting: Math.round(algHeffkortingMaand * 100) / 100,
    arbeidskorting:    Math.round(arbeidskortingMaand * 100) / 100,
    heffingskorting_totaal: Math.round(heffkortingTotaalMaand * 100) / 100,
    netto_loonheffing: Math.round(totaalLoonheffing * 100) / 100,
    zvw_werknemer:     0,
    pensioen:          Math.round(pensioen * 100) / 100,
    netto_uitbetaald:  Math.round(nettoUitbetaald * 100) / 100,
    zvw_werkgever:     Math.round(zvwWerkgeverMaand * 100) / 100,
    tarief_box1_pct:   tarief,
    jaarinkomen_est:   Math.round(jaarbruto),
    betaald_op:        input.betaald_op ?? null,
    status:            'definitief',
    berekenings_data: {
      jaarbruto,
      loonheffing_jaar:       Math.round(loonheffingJaar),
      alg_heffkorting_jaar:   Math.round(algHeffkortingJaar),
      arbeidskorting_jaar:    Math.round(arbeidskortingJaar),
      netto_loonheffing_jaar: Math.round(nettoLoonheffingJaar),
      zvw_werkgever_jaar:     Math.round(zvwWerkgeverJaar),
    },
  }
}

export function getPeriodeLabel(periode: string): string {
  const [y, m] = periode.split('-')
  const maanden = ['Januari','Februari','Maart','April','Mei','Juni','Juli','Augustus','September','Oktober','November','December']
  return `${maanden[parseInt(m) - 1]} ${y}`
}
