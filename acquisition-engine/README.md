# Acquisition Engine

High-performance real estate acquisition pipeline with intelligent scraping, enrichment, and ML-based opportunity scoring.

## Quick Start

```bash
npm install
npm run build
node dist/index.js
```

The engine starts on port 3005 with 21 cron schedules active.

## Architecture

- **Scrapers (13)**: Funda, Kadaster, Permits, ImmoBelt, KvK, Spatial Planning, Building Inspection, Market Analysis, Environmental Risk, Neighborhood Analytics, Property Valuation, Predictive Models, Opportunity Scoring
- **Agents (8)**: DealHunter, OffMarketAI, PermitAI, MunicipalityAI, InvestorAI, OutreachAI, RiskAI, AcquisitionDirectorAI
- **Database**: Supabase PostgreSQL (acq_deals, acq_*_enrichment tables)
- **Scheduling**: Node-cron (21 built-in schedules, all local)

## Deployment

See [`DEPLOYMENT.md`](./DEPLOYMENT.md) for:
- Mac Mini setup with LaunchAgent auto-start
- Environment configuration
- Monitoring & troubleshooting
- Multi-Mac load balancing

**TL;DR**: Copy `.env`, run `npm run build`, load LaunchAgent plist.

## Framework

See [`SCRAPER_FRAMEWORK.md`](./SCRAPER_FRAMEWORK.md) for:
- Architecture patterns (ScraperBase, HttpClient, RobotsChecker)
- Building new scrapers
- Ethical scraping rules
- Rate limits per source
- Database schema
- Completed implementations (Weeks 1-13)

## Endpoints

### Workers (Manual Trigger)

```bash
POST /workers/funda-scraper/run
POST /workers/kadaster-scraper/run
POST /workers/permits-scraper/run
POST /workers/immobelt-scraper/run
POST /workers/kvk-company-profiler/run
POST /workers/spatial-planning/run
POST /workers/building-inspection/run
POST /workers/market-analysis/run
POST /workers/environmental-risk/run
POST /workers/neighborhood-analytics/run
POST /workers/property-valuation/run
POST /workers/predictive-models/run
POST /workers/opportunity-scoring/run
```

### Agents

```bash
POST /agents/deal-hunter/run
POST /agents/offmarket-ai/run
POST /agents/permit-ai/run
POST /agents/municipality-ai/run
POST /agents/investor-ai/run
POST /agents/outreach-ai/run
POST /agents/risk-ai/run
POST /agents/acquisition-director/run
POST /agents/build-opps-scanner/run
```

### Batch Trigger

```bash
POST /scan
# Runs: DealHunter, PermitAI, RiskAI, InvestorAI in parallel
```

### Health

```bash
GET /health
# Response: { status: 'ok', timestamp: '...', uptime_ms: ... }
```

## Data Flow

```
Raw Listings (Funda, ImmoBelt)
    ↓
Enrichment (Kadaster, Permits, KvK, Spatial, Inspections)
    ↓
Analysis (Market, Environmental, Neighborhood, Valuation)
    ↓
Opportunity Scoring + ML Predictions
    ↓
Agent-driven outreach & portfolio optimization
```

## Development

```bash
# Build
npm run build

# Test
npm run test

# Watch
npm run dev  # (if configured)
```

## Rate Limits

Scrapers respect source rate limits:
- Funda API: 360 req/hour (6/min)
- Kadaster: 36,000 req/hour (batched)
- IMOW (Permits): 1,800 req/hour (1/2s)
- ImmoBelt: 500 req/day (1/2s)
- Others: Configurable per scraper

## Tech Stack

- **Runtime**: Node.js + TypeScript
- **Framework**: Express.js
- **Database**: Supabase (PostgreSQL)
- **HTTP Client**: Fetch (with retry + timeout)
- **Scheduling**: node-cron
- **Logging**: Custom logger (JSON format)

## Team & Support

Built by Orlando acquisition team. Questions? Check logs:

```bash
tail -f /var/log/acquisition-engine.log
```

All errors + successes logged to `acq_scan_jobs` table via `recordScraperRun()`.

---

**Version**: Q4 2025 | **Last Updated**: May 2026
