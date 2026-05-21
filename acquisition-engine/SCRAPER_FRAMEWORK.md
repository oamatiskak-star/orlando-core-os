# Acquisition OS — Scraper Framework

This document describes the foundation for building ethical, reliable web scrapers for the acquisition engine.

## Architecture

```
ScraperBase (abstract class)
├─ RateLimiter (in-memory rate limit tracking)
├─ HttpClient (fetch with retry + timeout)
└─ RobotsChecker (robots.txt compliance)

Concrete scrapers (extend ScraperBase)
├─ FundaScraper (Dutch real estate API)
├─ KadasterScraper (ownership data)
├─ PermitScraper (building permits)
└─ ... more scrapers
```

## Key Components

### 1. ScraperBase (`lib/scraper-base.ts`)

Base class for all scrapers. Provides:

- **Rate limiting**: tracks requests per hour per domain
- **Retry logic**: exponential backoff (2^n * delayMs)
- **Deal insertion**: batch insert to `acq_deals` table with duplicate detection
- **Error tracking**: records failures to `acq_scan_jobs`

**Usage:**

```typescript
import { ScraperBase } from '../lib/scraper-base'
import { ScraperConfig } from '../lib/types'

class MyScraperWorker extends ScraperBase {
  constructor() {
    const config: ScraperConfig = {
      name: 'my-scraper',
      rateLimitPerHour: 100,        // API limit
      retryAttempts: 3,              // backoff retries
      retryDelayMs: 1000,            // base delay (2^n * this)
      timeoutMs: 10000,              // fetch timeout
      domain: 'api.example.com',     // for rate limit tracking
    }
    super(config)
  }

  async run(): Promise<ScraperResult> {
    // Your implementation
    const deals = await this.retryWithBackoff(
      () => this.fetchDeals(),
      'Fetch deals'
    )
    const { inserted, skipped } = await this.insertDeals(deals)
    return { success: true, itemsFound: deals.length, itemsInserted: inserted, /* ... */ }
  }
}
```

### 2. HttpClient (`lib/http-client.ts`)

Handles HTTP requests with automatic retry.

**Features:**
- Respects `Retry-After` headers
- Exponential backoff on 5xx errors
- 429 (Rate Limit) handling
- Timeout enforcement
- User-Agent spoofing (ethical)

**Usage:**

```typescript
const client = new HttpClient({ timeout: 10000, retries: 3 })
const data = await client.get<ApiResponse>('https://api.example.com/listings')
```

### 3. RobotsChecker (`lib/robots-checker.ts`)

Ensures scraping complies with `robots.txt`.

**Features:**
- Caches robots.txt per domain
- Parses `Disallow` and `Crawl-Delay` directives
- Returns crawl delay to respect (default 2s)
- Refuses to scrape if `Disallow: /` present

**Usage:**

```typescript
const checker = new RobotsChecker()
const { allowed, crawlDelay } = await checker.canScrape('example.com')
if (allowed) {
  await scraper.sleep(crawlDelay)
  // proceed
}
```

## Building a New Scraper

### Step 1: Create worker file

```typescript
// acquisition-engine/src/workers/funda-scraper.ts
import { ScraperBase } from '../lib/scraper-base'
import { HttpClient } from '../lib/http-client'
import { ScraperConfig, RawDeal } from '../lib/types'

export class FundaScraperWorker extends ScraperBase {
  private httpClient: HttpClient

  constructor() {
    const config: ScraperConfig = {
      name: 'funda-scraper',
      rateLimitPerHour: 140,      // Funda API limit
      retryAttempts: 3,
      retryDelayMs: 500,
      timeoutMs: 10000,
      domain: 'funda.nl',
    }
    super(config)
    this.httpClient = new HttpClient({ timeout: 10000 })
  }

  async run(): Promise<ScraperResult> {
    const start = Date.now()

    try {
      // Check robots.txt
      const { allowed } = await this.robotsChecker.canScrape('funda.nl')
      if (!allowed) return { success: false, /* ... */ }

      // Fetch data
      const deals = await this.retryWithBackoff(
        () => this.fetchDealsFromFunda(),
        'Fetch Funda deals'
      )

      // Insert to DB
      const { inserted } = await this.insertDeals(deals)

      return {
        success: true,
        itemsFound: deals.length,
        itemsInserted: inserted,
        itemsSkipped: deals.length - inserted,
        duration_ms: Date.now() - start,
      }
    } catch (err) {
      return { success: false, /* ... */ }
    }
  }

  private async fetchDealsFromFunda(): Promise<RawDeal[]> {
    const response = await this.httpClient.get<FundaApiResponse>(
      'https://api.funda.nl/public/listings?...'
    )
    
    return response?.listings.map(item => ({
      id: item.funda_id,
      title: item.title,
      address: item.address,
      price: item.price,
      source: 'funda',
      source_url: item.url,
      // ... other fields
    })) || []
  }
}

export async function runFundaScraper() {
  const scraper = new FundaScraperWorker()
  const result = await scraper.run()
  await scraper.recordScraperRun('FundaScraper', result)
  return {
    agent: 'FundaScraper',
    itemsFound: result.itemsFound,
    itemsInserted: result.itemsInserted,
  }
}
```

### Step 2: Register in main index.ts

```typescript
import { runFundaScraper } from './workers/funda-scraper'

app.post('/agents/funda/run', async (_req, res) => {
  try {
    const result = await withAgentGuard('FundaScraper', runFundaScraper)
    res.json({ status: 'ok', ...result })
  } catch (err) {
    res.status(500).json({ status: 'error', error: (err as Error).message })
  }
})

// Add cron schedule
cron.schedule('0 */4 * * *', () => {
  withAgentGuard('FundaScraper', runFundaScraper)
    .catch(err => logger.error('Scheduled FundaScraper failed', { err: String(err) }))
}, { timezone: TZ })
```

### Step 3: Test

```bash
curl -X POST http://localhost:3005/agents/funda/run
```

## Ethical Scraping Rules

**✅ MUST DO:**
1. Check `robots.txt` BEFORE scraping
2. Respect `Crawl-Delay` directives (minimum 1-2 seconds between requests)
3. Use descriptive `User-Agent`
4. Respect `Retry-After` headers on 429/503
5. Cache aggressively (don't re-fetch same URL within 24h)
6. Stop immediately if you hit >5% error rate on a domain

**❌ NEVER:**
1. Bypass `robots.txt` or ToS
2. Make concurrent requests to same domain
3. Scrape personal data (emails, phone numbers) for cold contact
4. Use residential proxies (looks malicious)
5. Retry failed requests with same parameters immediately

## Rate Limits Per Source

| Source | Limit | Strategy |
|--------|-------|----------|
| Funda API | 150 req/hour | Queue with 24s delay |
| Kadaster BAG API | 100 req/10s | Batch 100, wait 10s |
| Gemeente PDFs | 1 req/2s | Sequential per gemeente |
| ImmoBelt | 500 req/day | 1 req/2s, respect 429 |

## Database Schema

Scrapers insert into `acq_deals`:

```sql
INSERT INTO acq_deals (
  title, address, city, province,
  asking_price, area_m2, build_year, energy_label,
  object_type, source, source_url,
  pipeline_stage, status, notes
) VALUES (...)
```

**Deduplication:** Uses `(source, source_url)` unique constraint.

## Testing

Run tests:

```bash
npm run test -- __tests__/scraper-base.test.ts
```

Mock a new scraper:

```typescript
class MockScraper extends ScraperBase {
  async run() {
    const deals: RawDeal[] = [
      {
        id: 'test-1',
        title: 'Test house',
        address: 'Test Street 1',
        price: 500000,
        source: 'test',
        source_url: 'https://test.local/1',
      },
    ]
    const { inserted } = await this.insertDeals(deals)
    return {
      success: true,
      itemsFound: 1,
      itemsInserted: inserted,
      itemsSkipped: 0,
      duration_ms: 100,
    }
  }
}
```

## Monitoring

Each scraper run logs:
- `itemsFound` — total items processed
- `itemsInserted` — items added to DB
- `itemsSkipped` — duplicates + errors
- `duration_ms` — execution time

View in `acq_scan_jobs` table:

```sql
SELECT agent_name, status, result_count, error_msg, created_at
FROM acq_scan_jobs
WHERE agent_name = 'FundaScraper'
ORDER BY created_at DESC
LIMIT 10;
```

## Completed Implementations

### Week 1: FundaScraper ✅
- Scrapes Dutch residential listings from Funda app-facing API (Elasticsearch)
- 150-200 listings per run, every 4 hours
- Rate limit: 360 req/hour (6 per minute)
- Postal code → province mapping
- Property type normalization
- Endpoints: `POST /workers/funda-scraper/run` + `GET /api/acquisition/cron/funda-scan`

### Week 2: KadasterScraper ✅
- Enriches deals with Kadaster BAG (Basisregistratie Adressen en Gebouwen) data
- Fetches ownership info, building year, property status
- Batch processing: 100 addresses per 10s
- Rate limit: 36000 req/hour
- Endpoints: `POST /workers/kadaster-scraper/run` + `GET /api/acquisition/cron/kadaster-enrich`

### Week 3: PermitsScraper ✅
- Fetches recent building permits from IMOW (Informatiemodel Omgevingswet)
- Supports: bouwvergunning, aanvraag, meldingsproces
- Searches last 30 days across all Dutch municipalities
- Rate limit: 1800 req/hour (1 req/2s sequential)
- Endpoints: `POST /workers/permits-scraper/run` + `GET /api/acquisition/cron/permits-scan`

### Week 4: ImmoBelt Scraper ✅
- Scrapes institutional commercial real estate listings
- Property types: kantoor, retail, logistiek, gemengd
- Fetches status: te_koop, biedingen with broker information
- Rate limit: 500 req/day (1 req/2s, max 10 pages × 50/page = 500 listings)
- Pagination with 2s delay between pages
- Endpoints: `POST /workers/immobelt-scraper/run` + `GET /api/acquisition/cron/immobelt-scan`

### Week 5: KvK Company Profiler ✅
- Enriches deals with KvK (Kamer van Koophandel) company information
- Searches for real estate developers, builders, project managers in each location
- Fetches: company status, SBI codes, employees, contact info, establishment date
- Rate limit: 36,000 req/hour (10 req/sec), batch processes 50 deals per run
- Stores enrichments in acq_company_profiles, links to acq_deals via kvk_number
- Endpoints: `POST /workers/kvk-profiler/run` + `GET /api/acquisition/cron/kvk-enrich`

## Next Steps

1. **Week 6:** Municipality Spatial Planning Data (RUD integration)
   - Fetch spatial planning data from ruimtelijkeplannen.nl
   - Identify zoning restrictions, development potential per location
   
2. **Week 7:** Government Building Inspection Data (BKWI)
   - Building safety certificates and inspection history
   - Risk indicators for properties
   
3. **Optional:** Real estate market analysis (WOZ, MLS-style aggregation)
   - Historical price trends per area
   - Comparable sales analysis
