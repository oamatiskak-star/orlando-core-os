/**
 * Cat 2 — Vastgoed Apify Scrapers
 * Draait Apify-actors voor markten die nog niet gedekt zijn door de
 * bestaande 45 scrapers: DE (ImmoScout24), UAE (Bayut, Propertyfinder),
 * SG (99.co), US (Zillow), LATAM (Zonaprop).
 * Resultaten gaan naar vastgoed_core.property_listings via upsert.
 */
import { runAndCollect } from '../lib/apify.mjs'
import { db, heartbeat } from '../lib/supabase.mjs'
import { ACTORS } from '../config.mjs'

const ENGINE_KEY = 'apify:vastgoed-scrapers'

const SCRAPER_CONFIGS = [
  {
    key: 'immoscout24',
    actorKey: 'IMMOSCOUT24',
    country: 'DE',
    input: { searchUrl: 'https://www.immobilienscout24.de/Suche/de/wohnung-kaufen?enteredFrom=one_step_search', maxItems: 100 },
    mapItem: item => ({
      external_id: String(item.id || item.exposeId || ''),
      source_name: 'immoscout24',
      country: 'DE',
      city: item.address?.city || item.city || null,
      address: item.address?.street || item.streetAddress || null,
      price: item.price?.value || item.price || null,
      price_currency: 'EUR',
      area_m2: item.livingSpace || item.area || null,
      property_type: item.propertyType || 'apartment',
      url: item.url || (item.id ? `https://www.immobilienscout24.de/expose/${item.id}` : null),
      raw: item,
    }),
  },
  {
    key: 'bayut',
    actorKey: 'BAYUT',
    country: 'AE',
    input: { startUrls: [{ url: 'https://www.bayut.com/to-buy/residential/dubai/' }], maxItems: 100 },
    mapItem: item => ({
      external_id: String(item.id || item.externalID || ''),
      source_name: 'bayut',
      country: 'AE',
      city: item.location?.[1]?.name || item.city || 'Dubai',
      address: item.title || null,
      price: item.price || null,
      price_currency: 'AED',
      area_m2: item.area || null,
      property_type: item.type || 'apartment',
      url: item.externalID
        ? `https://www.bayut.com/property/details-${item.externalID}.html`
        : (item.url || null),
      raw: item,
    }),
  },
  {
    key: 'propertyfinder',
    actorKey: 'PROPERTYFINDER',
    country: 'AE',
    input: { startUrls: [{ url: 'https://www.propertyfinder.ae/en/buy/apartments-for-sale.html' }], maxItems: 100 },
    mapItem: item => ({
      external_id: String(item.id || item.reference || ''),
      source_name: 'propertyfinder',
      country: 'AE',
      city: item.city || 'Dubai',
      address: item.title || item.address || null,
      price: item.price || null,
      price_currency: 'AED',
      area_m2: item.size || item.area || null,
      property_type: item.type || 'apartment',
      url: item.url || null,
      raw: item,
    }),
  },
  {
    key: '99co',
    actorKey: 'NINETYNINECO',
    country: 'SG',
    input: { startUrls: [{ url: 'https://www.99.co/singapore/sale' }], maxItems: 100 },
    mapItem: item => ({
      external_id: String(item.id || item.listing_id || ''),
      source_name: '99co',
      country: 'SG',
      city: 'Singapore',
      address: item.address || item.title || null,
      price: item.price || null,
      price_currency: 'SGD',
      area_m2: item.floor_area || item.area || null,
      property_type: item.property_type || 'apartment',
      url: item.url || null,
      raw: item,
    }),
  },
  {
    key: 'zillow',
    actorKey: 'ZILLOW',
    country: 'US',
    input: { searchQuery: 'New York, NY', maxItems: 100, listingType: 'FOR_SALE' },
    mapItem: item => ({
      external_id: String(item.zpid || item.id || ''),
      source_name: 'zillow',
      country: 'US',
      city: item.city || null,
      address: item.address || item.streetAddress || null,
      price: item.price || item.unformattedPrice || null,
      price_currency: 'USD',
      area_m2: item.livingArea ? Math.round(item.livingArea * 0.0929) : null,
      property_type: item.homeType || 'house',
      url: item.url || (item.zpid ? `https://www.zillow.com/homes/${item.zpid}_zpid/` : null),
      raw: item,
    }),
  },
  {
    key: 'zonaprop',
    actorKey: 'ZONAPROP',
    country: 'AR',
    input: { startUrls: [{ url: 'https://www.zonaprop.com.ar/departamentos-venta-buenos-aires.html' }], maxItems: 100 },
    mapItem: item => ({
      external_id: String(item.id || item.postingId || ''),
      source_name: 'zonaprop',
      country: 'AR',
      city: item.address?.city || 'Buenos Aires',
      address: item.address?.full || item.title || null,
      price: item.price?.amount || item.price || null,
      price_currency: item.price?.currency || 'USD',
      area_m2: item.surface || item.area || null,
      property_type: item.type || 'apartment',
      url: item.url || null,
      raw: item,
    }),
  },
  {
    key: 'airbnb_amsterdam',
    actorKey: 'AIRBNB',
    country: 'NL',
    input: { location: 'Amsterdam, Netherlands', maxListings: 100, currency: 'EUR' },
    mapItem: item => ({
      external_id: String(item.id || item.listing?.id || ''),
      source_name: 'airbnb',
      country: 'NL',
      city: 'Amsterdam',
      address: item.name || item.listing?.name || null,
      price: item.price?.amount || item.pricing?.rate?.amount || null,
      price_currency: 'EUR',
      area_m2: null,
      property_type: item.roomType || item.listing?.roomType || 'rental',
      url: item.id ? `https://www.airbnb.com/rooms/${item.id}` : (item.url || null),
      raw: item,
    }),
  },
  {
    key: 'airbnb_dubai',
    actorKey: 'AIRBNB',
    country: 'AE',
    input: { location: 'Dubai, UAE', maxListings: 100, currency: 'USD' },
    mapItem: item => ({
      external_id: String(item.id || item.listing?.id || '') + '_dubai',
      source_name: 'airbnb',
      country: 'AE',
      city: 'Dubai',
      address: item.name || item.listing?.name || null,
      price: item.price?.amount || item.pricing?.rate?.amount || null,
      price_currency: 'USD',
      area_m2: null,
      property_type: item.roomType || 'rental',
      url: item.id ? `https://www.airbnb.com/rooms/${item.id}` : (item.url || null),
      raw: item,
    }),
  },
  {
    key: 'airbnb_nyc',
    actorKey: 'AIRBNB',
    country: 'US',
    input: { location: 'New York, NY', maxListings: 100, currency: 'USD' },
    mapItem: item => ({
      external_id: String(item.id || item.listing?.id || '') + '_nyc',
      source_name: 'airbnb',
      country: 'US',
      city: 'New York',
      address: item.name || item.listing?.name || null,
      price: item.price?.amount || item.pricing?.rate?.amount || null,
      price_currency: 'USD',
      area_m2: null,
      property_type: item.roomType || 'rental',
      url: item.id ? `https://www.airbnb.com/rooms/${item.id}` : (item.url || null),
      raw: item,
    }),
  },
]

export async function run(log = console.log) {
  log('[vastgoed-scrapers] start')
  const started = Date.now()
  let totalSaved = 0, totalFailed = 0

  for (const cfg of SCRAPER_CONFIGS) {
    const actorId = ACTORS[cfg.actorKey]
    log(`→ ${cfg.key} (${actorId})`)

    // Registreer run in tracking-tabel
    const { data: runRow } = await db()
      .from('apify_vastgoed_runs')
      .insert({ actor_key: cfg.key, actor_id: actorId, status: 'running' })
      .select('id')
      .single()

    try {
      const { items, runId } = await runAndCollect(actorId, cfg.input, { timeoutMs: 300_000 })

      const rows = items
        .map(cfg.mapItem)
        .filter(r => r.external_id && r.url)

      if (rows.length) {
        const { error } = await db()
          .schema('vastgoed_core')
          .from('property_listings')
          .upsert(rows, { onConflict: 'source_name,external_id', ignoreDuplicates: false })
        if (error) throw new Error(error.message)
      }

      await db().from('apify_vastgoed_runs').update({
        run_id: runId,
        status: 'done',
        items_fetched: items.length,
        finished_at: new Date().toISOString(),
      }).eq('id', runRow?.id)

      totalSaved += rows.length
      log(`  ✓ ${cfg.key}: ${rows.length}/${items.length} opgeslagen`)
    } catch (err) {
      totalFailed++
      log(`  ✗ ${cfg.key}: ${err.message}`)
      await db().from('apify_vastgoed_runs').update({
        status: 'failed',
        error: err.message,
        finished_at: new Date().toISOString(),
      }).eq('id', runRow?.id)
    }
  }

  const ms = Date.now() - started
  await heartbeat(ENGINE_KEY, { saved: totalSaved, failed: totalFailed, ms })
  log(`[vastgoed-scrapers] klaar in ${ms}ms — ${totalSaved} opgeslagen, ${totalFailed} mislukt`)
  return { saved: totalSaved, failed: totalFailed }
}
