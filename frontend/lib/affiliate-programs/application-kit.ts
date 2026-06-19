// Aanmeld-kit voor affiliate-programma's — invul-klare teksten/links per programma.
// Referentie-content (geen DB-state): gevoed door de platform/affiliate-research 2026-06-19.
// Gekoppeld aan de Program Registry (accounts/page.tsx) via getApplicationKit(name).
// Entiteit/IBAN = echte waarden (Moneybird 461906748297446498). KvK/BTW/adres/e-mail
// staan nergens in het systeem → ‹invullen›-token; vul je echte waarden in bij aanmelding.

import type { ProgramCategory } from './types'

// ── Gedeeld aanmeldprofiel (geldt voor elke aanmelding) ──────────────────────
export type ProfileField = { label: string; value: string; sensitive?: boolean }

export const APPLICATION_PROFILE: ProfileField[] = [
  { label: 'Payee / bedrijf', value: 'Modiwerijo Financial Management B.V.' },
  { label: 'Land', value: 'Nederland' },
  { label: 'Valuta', value: 'EUR' },
  { label: 'KvK-nummer', value: '97494380' },
  { label: 'BTW / VAT (NL)', value: 'NL868076314B01' },
  { label: 'Vestigingsadres', value: '‹adres — niet publiek; invullen bij KYC/payout›', sensitive: true },
  { label: 'Contact e-mail', value: 'intelligence@aquier.com' },
  { label: 'Hoofd-website', value: 'https://aquier.com' },
  { label: 'Uitbetaling (IBAN)', value: 'NL95INGB0114145970 — Modiwerijo FM B.V.' },
  { label: 'IBAN-alternatieven', value: 'NL85INGB0113826923 · NL10INGB0113826818 · NL19INGB0113826850 · NL29INGB0113785542' },
  { label: 'Talen content', value: 'NL · EN · DE · ES' },
  { label: 'Publiek-geografie', value: 'NL + EU + VS/VK/CA/AU + VAE/SG' },
]

// Kant-en-klare "hoe ga je promoten"-tekst (EN — meeste formulieren zijn Engels).
export const PROMO_METHOD_EN =
  'We run a network of finance & real-estate education channels on YouTube (Dutch, English, German and Spanish), '
  + 'plus an email newsletter and the website aquier.com. We promote partners through educational long-form videos, '
  + 'Shorts/Reels, newsletter placements and resource pages. Affiliate links are placed only in video descriptions and '
  + 'newsletters with clear disclosure — never as on-screen financial advice. Content is strictly educational '
  + '(ETFs, FIRE, real-estate investing, macro), in line with FCA/ASIC/MiCA guidance.'

// Onze kanalen (URL = ‹invullen› tot kanaal live is).
export const CHANNEL_URLS: Record<string, string> = {
  VermogenTv: '‹YouTube-URL invullen›',
  SpaarTv: '‹YouTube-URL invullen›',
  VastgoedTv: '‹YouTube-URL invullen›',
  PropertyInvestor: '‹YouTube-URL invullen›',
  CryptoVermogen: '‹YouTube-URL invullen›',
  BeleggingsTv: '‹YouTube-URL invullen›',
  AquierTv: '‹YouTube-URL invullen›',
  AquierDE: '‹YouTube-URL invullen (in aanmaak)›',
  AquierTvEs: '‹YouTube-URL invullen (in aanmaak)›',
}

// ── Per-programma kit ────────────────────────────────────────────────────────
export type ApplicationKit = {
  program: string
  signupUrl: string
  network: string          // 'Direct' | 'FinanceAds' | 'Impact' | 'Awin' | 'Rewardful' | ...
  category: ProgramCategory
  channels: string[]       // welke van onze kanalen dit promoten
  payoutModel: string
  cookie?: string
  compliance?: string      // rode-zone / compliance-vlag
  promoText: string        // invul-klaar voor "promotional method"
  notes?: string[]
}

const N = (s: string) => s

export const APPLICATION_KITS: ApplicationKit[] = [
  // ── Quick-win / kern ──
  {
    program: 'TradingView Partner Program',
    signupUrl: 'https://www.tradingview.com/partner-program/',
    network: 'Direct', category: 'finance_crypto',
    channels: ['BeleggingsTv', 'AquierTv', 'AquierDE', 'PropertyInvestor', 'VermogenTv'],
    payoutModel: '30% recurring lifetime', cookie: '90 dagen',
    compliance: 'GROEN — SaaS, geen geo-restrictie. Veiligste hoog-LTV-keuze.',
    promoText: PROMO_METHOD_EN,
    notes: [N('Hoogste LTV van de hele lijst — overal inzetbaar.')],
  },
  {
    program: 'Ledger', signupUrl: 'https://affiliate.ledger.com/',
    network: 'Impact', category: 'finance_crypto',
    channels: ['CryptoVermogen', 'AquierTv'], payoutModel: '10% CPS (hardware)', cookie: '30 dagen',
    compliance: 'GROEN — hardware, geen VASP-marketing. Mag óók in SG/VAE.',
    promoText: PROMO_METHOD_EN, notes: [N('Loopt via Impact — maak eerst een Impact-account aan.')],
  },
  {
    program: 'Trezor', signupUrl: 'https://trezor.io/affiliate',
    network: 'Direct', category: 'finance_crypto',
    channels: ['CryptoVermogen', 'AquierTv'], payoutModel: '12–15% CPS (hardware)',
    compliance: 'GROEN — hardware, universeel toegestaan (incl. SG/VAE).', promoText: PROMO_METHOD_EN,
  },
  {
    program: 'Bitvavo', signupUrl: 'https://bitvavo.com/en/affiliates',
    network: 'Direct', category: 'finance_crypto',
    channels: ['CryptoVermogen', 'VermogenTv'], payoutModel: '15% lifetime fees',
    compliance: 'GROEN NL/EU — MiCA-vergunning AFM. NOOIT richten op SG/VAE-retail.',
    promoText: PROMO_METHOD_EN, notes: [N('Veiligste crypto-exchange voor NL-publiek.')],
  },
  {
    program: 'Wise', signupUrl: 'https://wise.com/partners/',
    network: 'Direct', category: 'finance_crypto',
    channels: ['SpaarTv', 'AquierTv'], payoutModel: '£10–50 CPA', cookie: '365 dagen',
    compliance: 'GROEN — betalingen, laag risico. Breed inzetbaar.',
    promoText: PROMO_METHOD_EN, notes: [N('Lange cookie (365d) — sterk voor SpaarTv.')],
  },
  {
    program: 'Seeking Alpha', signupUrl: 'https://about.seekingalpha.com/affiliate-program',
    network: 'Direct', category: 'finance_crypto',
    channels: ['AquierTv', 'PropertyInvestor', 'BeleggingsTv'], payoutModel: '$90 flat CPA', cookie: '30 dagen',
    compliance: 'GROEN — analyse-platform, geen beleggingsdienst. EN-markten.',
    promoText: PROMO_METHOD_EN, notes: [N('~60% trial-to-paid; hoge voorspelbaarheid.')],
  },
  // ── Brokers ──
  {
    program: 'DEGIRO', signupUrl: 'https://affiliates.degiro.com/',
    network: 'Direct', category: 'finance_crypto',
    channels: ['BeleggingsTv', 'VermogenTv'], payoutModel: 'CPA per funded account',
    compliance: 'GROEN NL/EU — AFM. Educatief framen (let op BUX-boete €1,6M).',
    promoText: PROMO_METHOD_EN, notes: [N('Niet identiek pushen op BeleggingsTv én VermogenTv — segmenteer.')],
  },
  {
    program: 'eToro', signupUrl: 'https://www.etoropartners.com/',
    network: 'Direct', category: 'finance_crypto',
    channels: ['BeleggingsTv', 'AquierTv', 'PropertyInvestor'], payoutModel: 'tot $250 CPA of RevShare',
    compliance: 'LET OP — CFD-product. Geen werving in AU (ASIC). VK/EU: gebruik compliant teksten van eToro.',
    promoText: PROMO_METHOD_EN, notes: [N('Markeer als CFD/hefboom — hoog regulatoir risico.')],
  },
  {
    program: 'Interactive Brokers', signupUrl: 'https://www.interactivebrokers.com/en/general/about/affiliate-programs.php',
    network: 'Direct', category: 'finance_crypto',
    channels: ['BeleggingsTv', 'AquierTv', 'PropertyInvestor'], payoutModel: 'Influencer CPC / CPA',
    compliance: 'GROEN — breed geo, professioneel publiek. Educatief.',
    promoText: PROMO_METHOD_EN, notes: [N('Sterk voor serieuze/EN beleggers.')],
  },
  {
    program: 'Trade Republic', signupUrl: 'https://www.financeads.com/programs/trade-republic/',
    network: 'FinanceAds', category: 'finance_crypto',
    channels: ['AquierDE', 'VermogenTv', 'BeleggingsTv'], payoutModel: '€50–100 per klant',
    compliance: 'GROEN DE/EU — BaFin matig, MiCA voor crypto-deel. Educatief.',
    promoText: PROMO_METHOD_EN, notes: [N('Kern-programma voor AquierDE.'), N('Via FinanceAds — meld je daar eerst aan.')],
  },
  {
    program: 'Scalable Capital', signupUrl: 'https://affi.io/m/scalable-capital',
    network: 'FinanceAds', category: 'finance_crypto',
    channels: ['AquierDE'], payoutModel: 'CPA per funded account',
    compliance: 'GROEN DE/EU — BaFin. Educatief.', promoText: PROMO_METHOD_EN,
  },
  {
    program: 'Lightyear', signupUrl: 'https://lightyear.com/en-eu/affiliates',
    network: 'FinanceAds', category: 'finance_crypto',
    channels: ['BeleggingsTv', 'VermogenTv', 'AquierTv'], payoutModel: 'CPA',
    compliance: 'GROEN EU — gereguleerd. Educatief.', promoText: PROMO_METHOD_EN,
  },
  {
    program: 'Freedom24', signupUrl: 'https://affiliate.freedom24.com/',
    network: 'Direct', category: 'finance_crypto',
    channels: ['BeleggingsTv', 'AquierTv'], payoutModel: 'hoge CPA per funded account',
    compliance: 'GROEN EU — gereguleerd (CY). Hoge payout.', promoText: PROMO_METHOD_EN,
  },
  // ── Neobanks ──
  {
    program: 'N26', signupUrl: 'https://n26.com/en-eu',
    network: 'Awin', category: 'finance_crypto',
    channels: ['SpaarTv', 'AquierDE'], payoutModel: 'CPA per geactiveerde rekening',
    compliance: 'GROEN — neobank, laag risico.', promoText: PROMO_METHOD_EN,
    notes: [N('Aanmelden via Awin (zoek N26 als merchant).')],
  },
  {
    program: 'Revolut', signupUrl: 'https://www.revolut.com/affiliates/',
    network: 'Direct', category: 'finance_crypto',
    channels: ['SpaarTv'], payoutModel: 'CPA per actieve gebruiker',
    compliance: 'GROEN — fintech/neobank, laag risico.', promoText: PROMO_METHOD_EN,
  },
  // ── Crypto-exchanges ──
  {
    program: 'Coinbase', signupUrl: 'https://www.coinbase.com/affiliates',
    network: 'Impact', category: 'finance_crypto',
    channels: ['CryptoVermogen', 'AquierTv'], payoutModel: '50% fees → 20% (na 3 mnd)', cookie: '30 dagen',
    compliance: 'GROEN EU — MiCA (Luxemburg). NOOIT SG-retail.',
    promoText: PROMO_METHOD_EN, notes: [N('Goed voor burst-campagnes; merkerkenning.')],
  },
  {
    program: 'OKX', signupUrl: 'https://www.okx.com/affiliate',
    network: 'Direct', category: 'finance_crypto',
    channels: ['CryptoVermogen', 'AquierTvEs'], payoutModel: '30–50% RevShare',
    compliance: 'GROEN EU — MiCA (alle EEA). NOOIT SG-retail.',
    promoText: PROMO_METHOD_EN, notes: [N('Sterkste EU-exchange-affiliate qua dekking.')],
  },
  {
    program: 'Kraken', signupUrl: 'https://www.kraken.com/affiliate',
    network: 'Direct', category: 'finance_crypto',
    channels: ['CryptoVermogen', 'AquierTv'], payoutModel: 'RevShare op trading fees',
    compliance: 'GROEN EU/VK — MiCA. NOOIT SG-retail.', promoText: PROMO_METHOD_EN,
  },
  {
    program: 'Bybit', signupUrl: 'https://www.bybit.com/en/affiliate/',
    network: 'Direct', category: 'finance_crypto',
    channels: ['CryptoVermogen'], payoutModel: 'tot 50% lifetime fees',
    compliance: 'LET OP — MiCA-AT gepassporteerd; NIET VS; NOOIT SG-retail.',
    promoText: PROMO_METHOD_EN, notes: [N('Controleer per land of bereik EU-gepassporteerd is.')],
  },
  // ── Vastgoed / proptech ──
  {
    program: 'Fundrise', signupUrl: 'https://fundrise.com',
    network: 'Impact', category: 'vastgoed_data',
    channels: ['PropertyInvestor', 'AquierTv'], payoutModel: 'tiered CPA',
    compliance: 'VS-only — uitsluitend op VS-publiek richten (geo-target).',
    promoText: PROMO_METHOD_EN, notes: [N('Niet relevant voor NL/EU-kijkers.')],
  },
  {
    program: 'Roofstock', signupUrl: 'https://www.roofstock.com',
    network: 'Direct', category: 'vastgoed_data',
    channels: ['PropertyInvestor'], payoutModel: 'tot $500 CPA per transactie',
    compliance: 'VS-only.', promoText: PROMO_METHOD_EN,
  },
  {
    program: 'BiggerPockets', signupUrl: 'https://www.biggerpockets.com/affiliate-program',
    network: 'Impact', category: 'vastgoed_data',
    channels: ['PropertyInvestor'], payoutModel: '$75 CPA Pro / $40 lead', cookie: '30 dagen',
    compliance: 'VS-focus — vastgoed-educatie/community.', promoText: PROMO_METHOD_EN,
  },
  {
    program: 'DealCheck', signupUrl: 'https://dealcheck.io/affiliates/',
    network: 'Direct', category: 'vastgoed_data',
    channels: ['PropertyInvestor', 'VastgoedTv'], payoutModel: '30% recurring', cookie: '90 dagen',
    compliance: 'GROEN — SaaS, globaal.', promoText: PROMO_METHOD_EN,
    notes: [N('Vastgoed-analyse SaaS — recurring, hoge LTV.')],
  },
  {
    program: 'EstateGuru', signupUrl: 'https://estateguru.co',
    network: 'Direct', category: 'vastgoed_data',
    channels: ['PropertyInvestor'], payoutModel: '~0,5% cashback eerste 3 mnd', cookie: '90 dagen',
    compliance: 'GROEN EU (ECSP) — ⚠ reputatierisico betalingsachterstand 2023-24; transparant vermelden.',
    promoText: PROMO_METHOD_EN,
  },
  {
    program: 'Hostaway', signupUrl: 'https://www.hostaway.com/affiliate',
    network: 'Direct', category: 'vastgoed_data',
    channels: ['VastgoedTv', 'PropertyInvestor'], payoutModel: '20% eerste jaar', cookie: '30 dagen',
    compliance: 'GROEN — SaaS vakantieverhuur.', promoText: PROMO_METHOD_EN,
  },
  // ── Finance SaaS / tools ──
  {
    program: 'Sharesight', signupUrl: 'https://www.sharesight.com/affiliates/',
    network: 'Direct', category: 'saas_ai',
    channels: ['BeleggingsTv', 'AquierTv'], payoutModel: 'tot 50% over 12 mnd',
    compliance: 'GROEN — SaaS. Sterk in VK/AU/IE/SG (ook veilig voor SG).', promoText: PROMO_METHOD_EN,
  },
  {
    program: 'Koyfin', signupUrl: 'https://www.koyfin.com/affiliate-program/',
    network: 'Rewardful', category: 'saas_ai',
    channels: ['BeleggingsTv', 'AquierTv'], payoutModel: '~20% recurring',
    compliance: 'GROEN — SaaS, recurring LTV.', promoText: PROMO_METHOD_EN,
  },
  {
    program: 'Morningstar', signupUrl: 'https://www.awin.com',
    network: 'Awin', category: 'saas_ai',
    channels: ['AquierTv', 'PropertyInvestor', 'BeleggingsTv'], payoutModel: '~12% CPS', cookie: '30 dagen',
    compliance: 'GROEN — analyse, EN-markten.', promoText: PROMO_METHOD_EN,
    notes: [N('Aanmelden via Awin (zoek Morningstar als merchant).')],
  },
  // ── Netwerk-hub ──
  {
    program: 'FinanceAds (netwerk)', signupUrl: 'https://www.financeads.com/',
    network: 'Direct (hub)', category: 'affiliate_network',
    channels: ['AquierDE', 'VermogenTv', 'BeleggingsTv'], payoutModel: 'hub — per onderliggend programma',
    compliance: 'EU-hub — >500 finance-programma\'s in één dashboard.',
    promoText: PROMO_METHOD_EN, notes: [N('Meld je hier EERST aan — ontsluit Trade Republic, DEGIRO, Scalable, Lightyear, Saxo in één keer.')],
  },
]

// Normaliseer programmanaam → kit (matcht losjes op naam-prefix).
export function getApplicationKit(programName: string): ApplicationKit | null {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')
  const target = norm(programName)
  return (
    APPLICATION_KITS.find(k => norm(k.program) === target) ??
    APPLICATION_KITS.find(k => target.startsWith(norm(k.program)) || norm(k.program).startsWith(target)) ??
    null
  )
}
