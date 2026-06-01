// Aquier product catalog + personas for the Would Buy Runner.
// Prices grounded in live Stripe / vastgoed_core.membership_tiers (2026-06-01).
// Readiness labels grounded in AQUIER_REVENUE_READINESS_AUDIT.md.

export type Readiness = "LAUNCH_READY" | "MINOR_FIXES" | "BLOCKING_ISSUE";

export interface Product {
  key: string;
  name: string;
  priceLabel: string;
  kind: "membership" | "report" | "scan" | "calc" | "service";
  readiness: Readiness;
  pitch: string;
  /** persona keys most relevant to this product */
  personas: string[];
}

export interface Persona {
  key: string;
  name: string;
  profile: string;
  drivers: string[];
  skepticism: string;
}

export const PERSONAS: Record<string, Persona> = {
  particuliere_belegger: {
    key: "particuliere_belegger",
    name: "Particuliere vastgoedbelegger",
    profile: "Bezit 1–10 panden, zoekt rendement en off-market deals, beslist zelf, prijsbewust.",
    drivers: ["rendement/m²", "off-market voorsprong", "tijd besparen", "fout vermijden"],
    skepticism: "Waarom zou ik €199/mnd betalen als ik Funda zelf kan afstruinen?",
  },
  professionele_ontwikkelaar: {
    key: "professionele_ontwikkelaar",
    name: "Professionele ontwikkelaar",
    profile: "Doet transformatie/nieuwbouw, denkt in haalbaarheid + bouwkosten + financierbaarheid.",
    drivers: ["ontwikkelpotentie", "bouwkosten-realisme (STABU)", "financierbaarheid", "snelheid naar GO/NO-GO"],
    skepticism: "Levert de analyse iets op dat mijn calculator/architect niet al doet?",
  },
  family_office: {
    key: "family_office",
    name: "Family office / fonds-acquisitie",
    profile: "Institutioneel, zoekt pre-gefilterde pipeline + Investment Memo's, hoog ticket OK.",
    drivers: ["institutionele kwaliteit", "deal-flow at scale", "IM klaar voor commissie", "due diligence"],
    skepticism: "Is de data institutioneel betrouwbaar en herleidbaar (geen black box)?",
  },
  makelaar: {
    key: "makelaar",
    name: "Makelaar (commercieel/residentieel)",
    profile: "Wil moeilijk verkochte panden bewegen, white-label ontwikkelanalyse in eigen huisstijl.",
    drivers: ["hogere vraagprijs onderbouwen", "kopers aantrekken", "white-label uitstraling", "sneller verkopen"],
    skepticism: "Past dit in mijn workflow en mag ik het als mijn eigen rapport leveren?",
  },
  dealfinder: {
    key: "dealfinder",
    name: "Dealfinder / sourcer",
    profile: "Vindt adressen, wil ze verkoopbaar maken aan fondsen/ontwikkelaars, betaalt per resultaat.",
    drivers: ["adres → verkoopbare deal", "success-fee", "geloofwaardigheid richting kopers"],
    skepticism: "Verdien ik dit terug op één deal?",
  },
  aannemer: {
    key: "aannemer",
    name: "Aannemer / bouwpartij",
    profile: "Zoekt projecten vroeg in de pijplijn, bouwkosten-calculaties, contractor-matching.",
    drivers: ["vroege projectinstroom", "calculatie-omzet", "preferred placement"],
    skepticism: "Krijg ik echt leads of alleen een rapport?",
  },
};

export const PRODUCTS: Product[] = [
  {
    key: "scout",
    name: "Scout Membership (Mandaat I)",
    priceLabel: "€199/mnd · €1.910/jr",
    kind: "membership",
    readiness: "LAUNCH_READY",
    pitch: "Doorlopende deal-alerts + emerging dealflow, €/m² inkoop vs. turnkey, hard floor €1.000/m².",
    personas: ["particuliere_belegger", "dealfinder"],
  },
  {
    key: "developer",
    name: "Developer Membership (Mandaat II)",
    priceLabel: "€299/mnd · €2.989/jr",
    kind: "membership",
    readiness: "LAUNCH_READY",
    pitch: "Deal + bouwanalyse, 25 alerts, 50 pipeline deals, 3 seats — voor wie echt ontwikkelt.",
    personas: ["professionele_ontwikkelaar", "particuliere_belegger"],
  },
  {
    key: "black",
    name: "Black Membership (Mandaat III)",
    priceLabel: "€14.940/jr · €3.735/kw",
    kind: "membership",
    readiness: "LAUNCH_READY",
    pitch: "Premium dealflow alle asset classes, 50 alerts, 100 pipeline deals.",
    personas: ["family_office", "professionele_ontwikkelaar"],
  },
  {
    key: "deal_analyses",
    name: "Deal Analyses / Dealscan",
    priceLabel: "€49 (basis) – €149 (premium)",
    kind: "scan",
    readiness: "MINOR_FIXES",
    pitch: "Losse deal-analyse op één adres: inkoop vs. turnkey-waarde, marge/m², GO/NO-GO.",
    personas: ["particuliere_belegger", "dealfinder", "professionele_ontwikkelaar"],
  },
  {
    key: "vastgoedrapporten",
    name: "Vastgoedrapporten",
    priceLabel: "€99 acq · €495 feas · €2.450 IM",
    kind: "report",
    readiness: "MINOR_FIXES",
    pitch: "Acquisitie-/haalbaarheids-/investeringsmemo's — bankbeoordeeld, herleidbaar, geen black box.",
    personas: ["professionele_ontwikkelaar", "family_office", "dealfinder"],
  },
  {
    key: "bouwcalculaties",
    name: "Bouwcalculaties (SterkCalc)",
    priceLabel: "Basis / Uitgebreid / Volledig (tot €1.495)",
    kind: "calc",
    readiness: "MINOR_FIXES",
    pitch: "STABU-gedreven bouwkosten per project — CAPEX-realisme als Modiwe-moat.",
    personas: ["professionele_ontwikkelaar", "aannemer"],
  },
  {
    key: "financierings_intake",
    name: "Financierings Intake",
    priceLabel: "gratis (lead-instroom)",
    kind: "service",
    readiness: "MINOR_FIXES",
    pitch: "Gratis intake → financierbaarheidsbeeld; bouwt pijplijn voor latere matching.",
    personas: ["professionele_ontwikkelaar", "particuliere_belegger"],
  },
  {
    key: "financierings_matching",
    name: "Financierings Matching",
    priceLabel: "success-/lead-fee (na AFM-check)",
    kind: "service",
    readiness: "BLOCKING_ISSUE",
    pitch: "Match developer ↔ financier; fee op gefinancierde deal.",
    personas: ["professionele_ontwikkelaar", "dealfinder"],
  },
  {
    key: "investeerders_matching",
    name: "Investeerders Matching",
    priceLabel: "concierge / fee (na AFM-check)",
    kind: "service",
    readiness: "BLOCKING_ISSUE",
    pitch: "Match deal ↔ kapitaal; pre-gefilterde institutionele pipeline.",
    personas: ["family_office", "dealfinder"],
  },
  {
    key: "affiliate",
    name: "Affiliate Producten",
    priceLabel: "commissie (jij = affiliate)",
    kind: "service",
    readiness: "MINOR_FIXES",
    pitch: "Tracked partner-links (crypto/fintech/tools) → commissie-omzet via live affiliate-engine.",
    personas: ["particuliere_belegger"],
  },
];

/** Pre-launch founding-member offer (Off-Market NL + warm netwerk). */
export const FOUNDING_OFFER = {
  name: "Founding Member",
  scarcity: "Eerste 50 leden",
  hook: "Founding-tarief op Scout/Developer + gratis deal-analyse op één pand naar keuze",
  cta: "Claim je Founding-plek",
};
