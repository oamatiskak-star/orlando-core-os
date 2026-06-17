import { createClient } from '@supabase/supabase-js'

/**
 * AQUIER-PROMO BUNDLE (productie-type 'aquier_promo').
 *
 * Levert de feiten waarmee de AI een Aquier-advertentie/explainer schrijft:
 * wat Aquier doet + het uitgelichte product (naam/omschrijving/prijs) + de
 * WERKENDE Stripe-betaallink (uit aquier_products, mig 219). Geen verzonnen
 * producten/links — alles komt uit de DB die op de Stripe-catalogus is gebouwd.
 */

const db = createClient(
  (process.env.SUPABASE_URL ?? 'http://preflight.invalid'),
  (process.env.SUPABASE_SERVICE_ROLE_KEY ?? 'preflight'),
  { auth: { persistSession: false } },
)

// Wat Aquier IS — positionering PER LAND (EN/ES-kanalen richten zich op US/UK/ES enz., niet NL).
// Geen NL-specifieke bronnen (Kadaster/BAG/CBS) noemen: Aquier koppelt aan de officiële
// databronnen van ELKE markt afzonderlijk.
export const AQUIER_ABOUT =
  'Aquier is AI-driven real estate acquisition intelligence. It works PER COUNTRY: for each market it ' +
  'connects to that country\'s own authoritative public data — the national land registry / cadastre, ' +
  'zoning & permitting records and the statistics bureau — to score and analyze any property on ' +
  'development potential, permitting odds, construction cost and financing viability. ' +
  'Audiences: developers, investors, agents, financiers and family offices.'

export interface AquierProduct {
  sku: string
  name: string
  kind: string
  description: string | null
  audiences: string[]
  price: string | null
  url: string | null
  payment_link: string | null
  cta: string | null
}

export interface AquierPromoBundle {
  about: string
  product: AquierProduct
  link: string            // werkende checkout/landing-link voor in CTA + beschrijving
  audience: string        // primaire doelgroep voor deze video
  bundleText: string      // kant-en-klaar blok voor de AI-prompt
}

/** Officiële databronnen PER MARKT. NL noemt de echte NL-bronnen; andere markten generiek
 *  (elk land z'n eigen kadaster/registry) zodat EN/ES-publiek zich aangesproken voelt. */
function marketDataSources(language?: string | null): string {
  const l = (language || 'en').slice(0, 2).toLowerCase()
  if (l === 'nl') return 'de officiële Nederlandse bronnen: het Kadaster, de BAG (adressen/gebouwen) en het CBS (statistiek)'
  if (l === 'es') return 'las fuentes públicas oficiales de tu país: el registro de la propiedad / catastro, los registros de urbanismo y la oficina de estadística'
  return "your own country's official public sources: the national land registry / cadastre, zoning & permitting records and the statistics bureau"
}

/** Haalt actieve Aquier-producten op (optioneel gefilterd op doelgroep). */
export async function loadAquierProducts(audience?: string | null): Promise<AquierProduct[]> {
  const { data } = await db.from('aquier_products')
    .select('sku, name, kind, description, audiences, price, url, payment_link, cta')
    .eq('active', true).order('sort')
  let rows = (data ?? []) as AquierProduct[]
  if (audience) {
    const a = audience.toLowerCase()
    const matched = rows.filter(r => (r.audiences ?? []).some(x => x.toLowerCase() === a))
    if (matched.length) rows = matched
  }
  return rows
}

/**
 * Kiest het uit te lichten product voor één promo-video. Cold YouTube-publiek →
 * lage drempel: het goedkoopste rapport (entry) voor de doelgroep als primaire CTA.
 * idx roteert het onderwerp over meerdere video's (geen herhaling).
 */
export async function pickAquierProduct(audience?: string | null, idx = 0): Promise<AquierProduct | null> {
  const all = await loadAquierProducts(audience)
  if (!all.length) {
    const fallback = await loadAquierProducts(null)
    if (!fallback.length) return null
    return fallback[idx % fallback.length]
  }
  // Entry-first: rapporten (eenmalig, lagere drempel) vóór memberships, dan op prijs/sort.
  const reports = all.filter(p => p.kind === 'report')
  const pool = reports.length ? reports : all
  return pool[idx % pool.length]
}

/** Bouwt de promo-bundel + prompt-blok rond een gekozen product. `language` bepaalt de
 *  markt-specifieke databronnen (NL=Kadaster/BAG/CBS, anders generiek per land). */
export async function buildAquierPromoBundle(audience?: string | null, idx = 0, language?: string | null): Promise<AquierPromoBundle | null> {
  const product = await pickAquierProduct(audience, idx)
  if (!product) return null
  const link = product.payment_link || product.url || 'https://aquier.com'
  const aud = audience || (product.audiences?.[0] ?? 'investor')
  const sources = marketDataSources(language)
  const bundleText =
    `OVER AQUIER: ${AQUIER_ABOUT}\n` +
    `DATA SOURCES (this market): ${sources}\n` +
    `UITGELICHT PRODUCT: "${product.name}" — ${product.description ?? ''} Prijs: ${product.price ?? 'op aanvraag'}.\n` +
    `DOELGROEP: ${aud}.\n` +
    `WERKENDE LINK (gebruik EXACT in CTA + beschrijving, verzin geen andere URL): ${link}`
  return { about: AQUIER_ABOUT, product, link, audience: aud, bundleText }
}
