// Submission-kit voor de Backlink Factory — invul-klare copy voor directory-
// aanmeldingen (aquier.com). Referentie-content, geen DB-state.

export type KitField = { label: string; value: string; sensitive?: boolean };

export const SUBMISSION_PROFILE: KitField[] = [
  { label: 'Productnaam', value: 'Aquier' },
  { label: 'Website', value: 'https://aquier.com' },
  { label: 'Tagline (EN)', value: 'AI-driven acquisition intelligence for real estate' },
  { label: 'Tagline (NL)', value: 'AI-gedreven acquisitie-intelligentie voor vastgoed' },
  { label: 'Categorie / tags', value: 'Real Estate, PropTech, AI, Investing, Data, SaaS' },
  { label: 'Prijs', value: 'Freemium · €49 – €15.000' },
  { label: 'Contact e-mail', value: 'intelligence@aquier.com' },
  { label: 'Land', value: 'Nederland' },
  { label: 'Logo (square PNG/SVG)', value: '‹logo-bestand uploaden — bv. /public/logo of OG-asset›', sensitive: true },
  { label: 'X / LinkedIn', value: '‹handle invullen›', sensitive: true },
];

// Korte omschrijving (≤60 tekens — veel directories hebben een limiet).
export const DESC_SHORT_EN = 'Find off-market real-estate deals before the market does.';
export const DESC_SHORT_NL = 'Vind off-market vastgoeddeals vóór de markt ze ziet.';

// Medium (≤160 tekens — meta/listing-omschrijving).
export const DESC_MEDIUM_EN =
  'Aquier is AI acquisition intelligence for real estate: it monitors Kadaster, permits, municipal data & off-market signals and grades deals A/B/C by ROI.';
export const DESC_MEDIUM_NL =
  'Aquier is AI-acquisitie-intelligentie voor vastgoed: monitort Kadaster, vergunningen, gemeentedata & off-market-signalen en scoort deals A/B/C op rendement.';

// Lange omschrijving (directory "about"-veld).
export const DESC_LONG_EN =
  'Aquier is an AI-driven acquisition intelligence platform for professional real-estate investors, developers and family offices. '
  + 'It continuously analyses thousands of public and off-market data sources — Kadaster, permit systems, municipal datasets and marketplaces — '
  + 'to surface hidden redevelopment opportunities before they reach the open market. Each property is scored A/B/C on development potential, ROI, '
  + 'permit odds and construction cost, with three development routes per object. Plans range from a €49 basic screening to a €15,000 full development package.';
export const DESC_LONG_NL =
  'Aquier is een AI-gedreven acquisitie-intelligentieplatform voor professionele vastgoedbeleggers, ontwikkelaars en family offices. '
  + 'Het analyseert continu duizenden publieke en off-market databronnen — Kadaster, vergunningen, gemeentedata en marktplaatsen — '
  + 'om verborgen herontwikkelkansen te vinden vóór ze op de markt komen. Elk object krijgt een A/B/C-score op ontwikkelpotentieel, rendement, '
  + 'vergunningskans en bouwkosten, met drie ontwikkelroutes per pand. Van €49 basisscan tot €15.000 volledig ontwikkelpakket.';

// Per-categorie indien-tips.
export const CATEGORY_TIPS: { key: string; label: string; tip: string }[] = [
  { key: 'owned', label: 'Owned', tip: 'Plaats de link in kanaalbeschrijvingen / bio / nieuwsbrief-footer. Snelste discovery voor de 94 "unknown to Google"-pagina\'s.' },
  { key: 'directory_saas', label: 'SaaS-directory', tip: 'Gebruik EN-copy + categorie PropTech/Real Estate. Veel zijn nofollow maar leveren crawl-discovery + verwijsverkeer.' },
  { key: 'directory_ai', label: 'AI-directory', tip: 'Benadruk de AI-hoek (machine learning op Kadaster/vergunningen). Tags: AI, Real Estate, Data.' },
  { key: 'directory_nl', label: 'NL-directory', tip: 'Gebruik NL-copy. Hoogste relevantie voor je NL-doelgroep + lokale signalen.' },
  { key: 'community', label: 'Community', tip: 'GEEN drop-and-run. Lever eerst waarde (bv. de gids-rekentool als referentie), link contextueel. Anders = spam/verwijderd.' },
  { key: 'pr', label: 'PR / pers', tip: 'Pitch een data-hoek (off-market deal-cijfers per provincie). Vastgoedjournaal/Sprout linken bij plaatsing.' },
];
