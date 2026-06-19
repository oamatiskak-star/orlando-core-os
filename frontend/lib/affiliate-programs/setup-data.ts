/**
 * Setup-data voor affiliate-programma-registratie.
 *
 * Reference-content die Orlando per programma moet invullen bij aanmelding,
 * voorbereid zodat aanmelden ≤2 min kost. Bevat GEEN wachtwoorden of secrets —
 * die horen in een wachtwoordmanager. Gekoppeld aan affiliate_programs.name.
 */

export type SetupAnswer = {
  label: string
  value: string
}

export type ProgramSetup = {
  signupUrl: string
  network: string
  property: string
  approval: string
  threshold: string
  cookie: string
  commission: string
  payout: string
  kyc?: string
  requiredFields: string[]
  answers: SetupAnswer[]
  note?: string
}

export type SharedRegistrationField = {
  label: string
  value: string
}

/** Vaste gegevens — 1× invullen, overal hergebruiken. */
export const SHARED_REGISTRATION: SharedRegistrationField[] = [
  { label: 'Naam', value: 'Orlando Amatiskak' },
  { label: 'Land', value: 'Netherlands' },
  { label: 'Entiteit (tax/invoice)', value: 'Modiwerijo Financial Management BV' },
  { label: 'KvK', value: '97494380' },
  { label: 'BTW', value: 'NL868076314B01' },
  { label: 'PayPal (payout)', value: 'o.amatiskak@gmail.com' },
  { label: 'Wise (alleen Make.com)', value: 'o.amatiskak@gmail.com' },
  { label: 'Site die je opgeeft', value: 'https://aquier.com' },
  { label: 'Tax-form', value: 'W-8BEN-E' },
]

const PROMO_FINANCE =
  'Editorial SEO content on aquier.com (~300 finance, investing and real-estate articles, EN + NL). ' +
  'I place contextual tool links inside relevant guides and dedicated reviews, with risk disclosures. ' +
  'No brand-keyword bidding, no incentivized traffic.'

const AUDIENCE_FINANCE =
  'aquier.com is a personal-finance, investing and real-estate knowledge base (~300 articles, EN + NL, ' +
  'NL-first, expanding to more countries) for retail investors, savers and property-minded readers.'

const PROMO_BUSINESS =
  'Long-form SEO content on aquier.com (~300 articles, EN + NL) for small-business and marketing readers. ' +
  'I recommend tools via contextual in-article links, dedicated reviews and comparison/round-up content. ' +
  'No brand-keyword bidding, no incentivized traffic.'

const AUDIENCE_BUSINESS =
  'aquier.com is a finance + small-business knowledge base (~300 articles, EN + NL, NL-first). A meaningful ' +
  'share of readers are small-business owners and marketers researching tools to grow and automate.'

const SITE_URL = 'https://aquier.com'

/** Per affiliate-programma, gekoppeld op affiliate_programs.name. */
export const AFFILIATE_SETUP: Record<string, ProgramSetup> = {
  'TradingView Partner Program': {
    signupUrl: 'https://www.tradingview.com/partner-program/',
    network: 'Direct',
    property: SITE_URL,
    approval: 'Link direct actief, verificatie bij 1e payout',
    threshold: 'PayPal $15',
    cookie: '90 dagen',
    commission: 'CPA $10–200 per nieuwe betaalde sub',
    payout: 'PayPal — o.amatiskak@gmail.com',
    requiredFields: ['Naam', 'E-mail', 'Land (Netherlands)', 'Website-URL', 'Audience + promotie-omschrijving', 'PayPal-e-mail'],
    answers: [
      { label: 'Promotional methods', value: PROMO_FINANCE },
      { label: 'Audience / website', value: AUDIENCE_FINANCE },
      { label: 'Website-URL', value: SITE_URL },
    ],
    note: 'Beste eerste-winst: geen traffic-minimum, geen MiCA-issue, link meteen bruikbaar.',
  },
  Pabbly: {
    signupUrl: 'https://payments.pabbly.com/affiliate/signup/affiliateportal',
    network: 'Direct',
    property: SITE_URL,
    approval: 'Instant / self-serve',
    threshold: 'PayPal $50',
    cookie: '365 dagen',
    commission: '30% recurring lifetime',
    payout: 'PayPal — o.amatiskak@gmail.com',
    requiredFields: ['Naam', 'E-mail', 'Wachtwoord (in manager)', 'PayPal-e-mail', 'Website-URL (optioneel)'],
    answers: [
      { label: 'Promotional methods', value: PROMO_BUSINESS },
      { label: 'Audience / website', value: AUDIENCE_BUSINESS },
      { label: 'Website-URL', value: SITE_URL },
    ],
  },
  'Make.com': {
    signupUrl: 'https://www.make.com/user/affiliate',
    network: 'Direct',
    property: SITE_URL,
    approval: 'Instant (gratis Make-account nodig)',
    threshold: '$100 + 3 betalende referrals',
    cookie: '12 mnd vanaf registratie',
    commission: '35% recurring (12 mnd)',
    payout: 'Wise — o.amatiskak@gmail.com (geen PayPal)',
    requiredFields: ['Affiliate-code (5–20 tekens)', 'Wise-e-mail', 'Account-type (Personal/Business)', 'Payout-valuta', 'Promotie-survey'],
    answers: [
      { label: 'Promotional methods', value: PROMO_BUSINESS },
      { label: 'Audience / website', value: AUDIENCE_BUSINESS },
      { label: 'Website-URL', value: SITE_URL },
    ],
    note: 'Payout loopt uitsluitend via Wise — zet je Wise-account klaar.',
  },
  'ClickFunnels Affiliates': {
    signupUrl: 'https://www.clickfunnels.com/affiliate-program',
    network: 'Direct (Tipalti payout)',
    property: SITE_URL,
    approval: 'Join instant; payout via Tipalti + W-8BEN-E',
    threshold: '$100',
    cookie: '45 dagen',
    commission: '30% recurring',
    payout: 'PayPal via Tipalti',
    kyc: 'Tipalti tax-form (W-8BEN-E) na 1e commissie — binnen 120 dagen invullen',
    requiredFields: ['Naam', 'E-mail', 'Wachtwoord (in manager)', 'Land', 'Payout/Tipalti-e-mail'],
    answers: [
      { label: 'Promotional methods', value: PROMO_BUSINESS },
      { label: 'Audience / website', value: AUDIENCE_BUSINESS },
      { label: 'Website-URL', value: SITE_URL },
    ],
  },
  'Semrush Affiliate Program': {
    signupUrl: 'https://app.impact.com/campaign-promo-signup/Semrush.brand',
    network: 'Impact',
    property: SITE_URL,
    approval: 'Manueel ~2 dagen (traffic-bar ~1k/mnd)',
    threshold: '$50',
    cookie: '120 dagen',
    commission: '$200 CPA + $10 trial',
    payout: 'PayPal/bank via Impact',
    requiredFields: ['Impact-account (naam, e-mail, business name, land, valuta, website)', 'Programma: website-URL', 'Promotie-methodes', 'Audience', 'Maandelijkse traffic', 'Content-categorieën'],
    answers: [
      { label: 'Promotional methods', value: PROMO_BUSINESS },
      { label: 'Audience / website', value: AUDIENCE_BUSINESS },
      { label: 'Website-URL', value: SITE_URL },
    ],
    note: 'Maak het Impact-account 1× aan — Semrush + HubSpot lopen beide op Impact.',
  },
  'HubSpot Affiliate Program': {
    signupUrl: 'https://www.hubspot.com/partners/affiliates',
    network: 'Impact',
    property: SITE_URL,
    approval: 'Manueel 2–5 dagen',
    threshold: '$10',
    cookie: '180 dagen',
    commission: '30% recurring (tot 1 jaar)',
    payout: 'PayPal/bank via Impact',
    requiredFields: ['Naam', 'E-mail', 'Website-URL', 'Land', 'Promotie-methodes', 'Audience/traffic', 'Niche'],
    answers: [
      { label: 'Promotional methods', value: PROMO_BUSINESS },
      { label: 'Audience / website', value: AUDIENCE_BUSINESS },
      { label: 'Website-URL', value: SITE_URL },
    ],
  },
  ClickUp: {
    signupUrl: 'https://clickup.com/affiliate',
    network: 'PartnerStack',
    property: SITE_URL,
    approval: 'Manueel 1–5 dagen (laag risico)',
    threshold: '$20',
    cookie: '30 dagen',
    commission: 'tot $20–25/signup, betaalt op gratis signups',
    payout: 'PayPal via PartnerStack',
    requiredFields: ['Voor- en achternaam', 'E-mail', 'Wachtwoord (in manager)', 'Land', 'Bedrijf/website', 'Website-URL', 'Promotie-kanaal', 'Audience-omschrijving'],
    answers: [
      { label: 'Promotional methods', value: PROMO_BUSINESS },
      { label: 'Audience / website', value: AUDIENCE_BUSINESS },
      { label: 'Website-URL', value: SITE_URL },
    ],
    note: 'PartnerStack-account 1× aanmaken — ClickUp + SurferSEO lopen beide op PartnerStack.',
  },
  'SurferSEO Affiliate': {
    signupUrl: 'https://surferseo.com/affiliate-program/',
    network: 'PartnerStack',
    property: SITE_URL,
    approval: 'Manueel ~24 uur',
    threshold: '~$50',
    cookie: '~60 dagen',
    commission: '75–125% CPA op 1e betaling',
    payout: 'PayPal/bank via PartnerStack',
    kyc: 'Business moet een factuur kunnen uitgeven (Modiwerijo Financial Management BV)',
    requiredFields: ['Voor- en achternaam', 'E-mail', 'Wachtwoord (in manager)', 'Land', 'Website-URL', 'YouTube/LinkedIn (optioneel)', 'Promotie-methodes'],
    answers: [
      { label: 'Promotional methods', value: PROMO_BUSINESS },
      { label: 'Audience / website', value: AUDIENCE_BUSINESS },
      { label: 'Website-URL', value: SITE_URL },
    ],
  },
  'Jasper AI Affiliate': {
    signupUrl: 'https://www.jasper.ai/partners',
    network: 'FirstPromoter',
    property: SITE_URL,
    approval: 'Manueel (paar dagen–2 weken)',
    threshold: '$25',
    cookie: '14 dagen',
    commission: '25% recurring (12 mnd)',
    payout: 'PayPal/Wise',
    requiredFields: ['E-mail', 'Voor- en achternaam', 'Wachtwoord (in manager)', 'Website-URL', 'Land', 'Social-links'],
    answers: [
      { label: 'Promotional methods', value: PROMO_BUSINESS },
      { label: 'Audience / website', value: AUDIENCE_BUSINESS },
      { label: 'Website-URL', value: SITE_URL },
    ],
    note: 'Apply vroeg i.v.m. lead-time.',
  },
  Mashvisor: {
    signupUrl: 'https://www.mashvisor.com/affiliate-program/',
    network: 'Direct',
    property: SITE_URL,
    approval: 'Manueel, paar dagen (laagste afwijsrisico)',
    threshold: '~$20',
    cookie: '30–60 dagen',
    commission: '~20% recurring',
    payout: 'PayPal/bank',
    requiredFields: ['Naam', 'E-mail', 'Wachtwoord (in manager)', 'Website-URL', 'Land', 'Promotie-methodes', 'Audience-omschrijving'],
    answers: [
      {
        label: 'Promotional methods',
        value:
          'Contextual links within real-estate investing, rental-yield and property-analysis articles on aquier.com; ' +
          'data-driven "how to analyze an investment property" guides and tool round-ups (EN + NL).',
      },
      {
        label: 'Audience / website',
        value:
          'aquier.com is a finance, investing and real-estate knowledge base (~300 articles, EN + NL) serving real-estate ' +
          'investors, aspiring landlords and finance-minded readers researching property markets and rental returns.',
      },
      { label: 'Website-URL', value: SITE_URL },
    ],
  },
  Bitvavo: {
    signupUrl: 'https://bitvavo.com/en/affiliates',
    network: 'Direct',
    property: SITE_URL,
    approval: 'KYC-gated — eerst geverifieerd Bitvavo-account',
    threshold: 'Geen vaste drempel',
    cookie: 'Link/account-attributie (lifetime)',
    commission: '15% van trading fees, lifetime',
    payout: 'EUR naar Bitvavo-account → eigen IBAN',
    kyc: 'Volledig geverifieerd Bitvavo-account vereist; affiliate-account kan niet traden',
    requiredFields: ['Geverifieerd Bitvavo-account (KYC)', 'Promotie-kanaal: website-URL', 'Social/audience-omschrijving', 'Hoe je promoot'],
    answers: [
      {
        label: 'Promotional methods',
        value:
          'Educational crypto and investing content on aquier.com. I place Bitvavo links in "how to start investing in ' +
          'crypto in the Netherlands" guides and comparison content, with clear MiCA-compliant risk disclosures. ' +
          'No misleading return claims, no brand-keyword bidding.',
      },
      { label: 'Audience / website', value: AUDIENCE_FINANCE },
      { label: 'Website-URL', value: SITE_URL },
    ],
    note: 'Geen 2-min: reken op ~10 min door KYC. Altijd MiCA-risicowaarschuwing, geen rendementsbeloftes.',
  },
}
