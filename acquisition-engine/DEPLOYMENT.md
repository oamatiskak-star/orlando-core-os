# Acquisition Engine — Local Deployment Guide

This document describes how to deploy the acquisition-engine as a self-contained service on Mac Mini (or any local machine) with built-in cron scheduling.

## Architecture

```
Mac Mini (macOS)
└─ acquisition-engine (Node.js process)
   ├─ Express server on port 3005
   ├─ Built-in cron schedules (21 schedules)
   └─ Direct database access (Supabase)
   
No Vercel involvement — fully local, economical, and efficient.
```

## Setup

### 1. Install Dependencies

```bash
cd acquisition-engine
npm install
```

### 2. Environment Variables

Create `.env` file in `acquisition-engine/` directory with:

```env
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-key

# Server
PORT=3005
AGENT_TIMEZONE=Europe/Amsterdam
NODE_ENV=production

# API Keys (optional)
DVGO_API_KEY=your-dvgo-key
```

### 3. Build

```bash
npm run build
```

### 4. Run as Service (macOS)

#### Option A: LaunchAgent (Recommended — Auto-Start)

Create `/Library/LaunchAgents/com.orlando.acquisition-engine.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.orlando.acquisition-engine</string>
    
    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/node</string>
        <string>/path/to/acquisition-engine/dist/index.js</string>
    </array>
    
    <key>WorkingDirectory</key>
    <string>/path/to/acquisition-engine</string>
    
    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>/usr/local/bin:/usr/bin:/bin</string>
        <key>NODE_ENV</key>
        <string>production</string>
    </dict>
    
    <key>StandardOutPath</key>
    <string>/var/log/acquisition-engine.log</string>
    
    <key>StandardErrorPath</key>
    <string>/var/log/acquisition-engine-error.log</string>
    
    <key>KeepAlive</key>
    <true/>
    
    <key>RunAtLoad</key>
    <true/>
</dict>
</plist>
```

Then load it:

```bash
launchctl load /Library/LaunchAgents/com.orlando.acquisition-engine.plist
launchctl start com.orlando.acquisition-engine
```

#### Option B: Manual (Development)

```bash
npm run build
node dist/index.js
```

## Monitoring

### Check if Service is Running

```bash
launchctl list | grep acquisition-engine
ps aux | grep "node.*index.js"
```

### View Logs

```bash
tail -f /var/log/acquisition-engine.log
tail -f /var/log/acquisition-engine-error.log
```

### Manual Trigger (Testing)

```bash
curl -X POST http://localhost:3005/workers/funda-scraper/run
curl -X POST http://localhost:3005/workers/property-valuation/run
curl -X POST http://localhost:3005/workers/predictive-models/run
```

## Cron Schedules (Built-In)

The engine runs **21 built-in cron schedules** — no Vercel needed:

| Agent | Schedule | Purpose |
|-------|----------|---------|
| DealHunter | Every hour | Scan queued jobs + score deals |
| OffMarketAI | Every 2 hours | Enrich new leads |
| PermitAI | Every 4 hours (30m) | Update relevance scores |
| MunicipalityAI | Daily 6am | Enrich municipality profiles |
| InvestorAI | 3x daily (8am, 1pm, 6pm) | Deal matching |
| OutreachAI | Every 30 minutes | Generate scheduled messages |
| RiskAI | Every 3 hours | Risk re-evaluation |
| AcquisitionDirectorAI | Daily 8am | Strategic briefing |
| FundaScraper | Every 4 hours | Funda listings |
| KadasterScraper | Every 6 hours | Property enrichment |
| PermitsScraper | Every 6 hours | Building permits |
| ImmobeltScraper | Every 12 hours | Commercial listings |
| KvKCompanyProfiler | Every 6 hours | Company profiles |
| SpatialPlanningScraper | Every 8 hours | Zoning data |
| BuildingInspectionScraper | Daily 2am | Safety certificates |
| MarketAnalysisScraper | Every 12 hours | Market analysis |
| EnvironmentalRiskScraper | Every 8 hours | Environmental risk |
| NeighborhoodAnalyticsScraper | Every 6 hours | Neighborhood data |
| PropertyValuationScraper | Every 6 hours | Property valuation |
| OpportunityScoringScraperWorker | Every 4 hours | Opportunity ranking |
| PredictiveModelsScraperWorker | Every 4 hours | ML predictions |

All timings are in **Europe/Amsterdam** timezone.

## Troubleshooting

### Process crashes on startup

```bash
# Check logs
tail -20 /var/log/acquisition-engine-error.log

# Verify environment variables
cat acquisition-engine/.env

# Test manually
node dist/index.js
```

### Supabase connection fails

```bash
# Verify credentials
echo $SUPABASE_URL
echo $SUPABASE_KEY

# Test connection
curl -H "Authorization: Bearer YOUR_KEY" https://your-project.supabase.co/rest/v1/
```

### Cron schedules not running

```bash
# Check if process is alive
launchctl list com.orlando.acquisition-engine

# Force restart
launchctl stop com.orlando.acquisition-engine
launchctl start com.orlando.acquisition-engine
```

## Resource Usage

- **Memory**: ~150-300MB (Node + dependencies)
- **CPU**: <5% idle, peaks during scraper runs
- **Network**: ~1-5 Mbps during active scraping
- **Disk**: ~500MB (node_modules + dist)

Mac Mini is more than sufficient for this workload.

## Multi-Mac Setup (Optional)

If you have 2 Mac Mini's, distribute load:

**Mac Mini #1** (Primary scrapers):
- FundaScraper, KadasterScraper, PermitsScraper, ImmobeltScraper
- KvKCompanyProfiler, SpatialPlanningScraper, BuildingInspectionScraper

**Mac Mini #2** (Analysis agents):
- DealHunter, OffMarketAI, PermitAI, MunicipalityAI, InvestorAI
- PropertyValuationScraper, OpportunityScoringScraperWorker, PredictiveModelsScraperWorker

This balances CPU load across machines.

## Backup Strategy

The engine is stateless — all state lives in Supabase. To preserve:

1. **Database backups** (Supabase handles daily)
2. **Environment variables** (back up `.env` file separately)
3. **Code** (already in git)

Nothing else needs backing up.

## Cost Analysis

| Setup | Monthly Cost |
|-------|---|
| **Local (This)** | $0 (electricity ≈ €5-10) |
| Vercel crons | €20-100+ (compute + overages) |
| AWS Lambda | €50-200+ (invocations + compute) |

Local deployment is **economical and efficient**.
