# Orlando AI Marketing Orchestration System - Setup Guide

## 🎯 Overview

Complete end-to-end AI-powered marketing automation system for growing YouTube channels to 840K views in 10 days.

**Components:**
- 📊 YouTube Channel Analyst - Realtime performance monitoring
- 💡 Content Intelligence Engine - AI recommendation generation
- 🎯 Marketing Orchestrator - Execution & scheduling
- 🔔 Slack/Discord Notifier - Team alerts
- 📈 Marketing Dashboard - Live KPI visualization
- 📱 REST APIs - Programmatic access

---

## 🔧 Prerequisites

### Environment Variables

Create a `.env` file in project root:

```bash
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_key

# Telegram (Critical alerts)
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id

# Slack (Optional but recommended)
SLACK_WEBHOOK_CRITICAL=https://hooks.slack.com/services/...
SLACK_WEBHOOK_MARKETING=https://hooks.slack.com/services/...
SLACK_WEBHOOK_TESTS=https://hooks.slack.com/services/...

# Discord (Optional but recommended)
DISCORD_WEBHOOK_CRITICAL=https://discord.com/api/webhooks/...
DISCORD_WEBHOOK_MARKETING=https://discord.com/api/webhooks/...
DISCORD_WEBHOOK_TESTS=https://discord.com/api/webhooks/...

# Email (Optional - for marketing specialist reports)
MAILTRAP_API_TOKEN=your_mailtrap_token
MAILTRAP_INBOX_ID=your_inbox_id

# Frontend
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

### Required Tools

- Node.js 18+
- npm or yarn
- Docker (for local Supabase)
- Git

---

## 🚀 Quick Start

### 1. Run Database Migrations

```bash
# Apply Supabase migrations
supabase migration up

# Or manually run:
# - 078_youtube_channel_analyst.sql
# - 079_marketing_orchestration.sql
```

### 2. Start Marketing Automation

```bash
# Build and start all services
bash scripts/start-marketing-automation.sh
```

This will:
- ✅ Build monitoring-agent
- ✅ Build youtube-engine
- ✅ Start YouTube Analyst (1 hour cycle)
- ✅ Start Intelligence Engine (1 hour cycle)
- ✅ Start Marketing Orchestrator (30 min cycle)
- ✅ Start Slack/Discord Notifier (10 min cycle)

### 3. Access Dashboard

```
http://localhost:3000/youtube/marketing
```

### 4. Add Team Member

Marketing specialist will receive recommendations and alerts:

```sql
INSERT INTO team_members (email, name, role)
VALUES ('marketing@company.com', 'Alice Marketing', 'marketing_specialist');
```

---

## 📊 System Architecture

```
┌─────────────────────────────────────────────────────┐
│         YouTube Analytics (External)                │
└────────────────┬────────────────────────────────────┘
                 │ (synced via youtube-engine)
                 ▼
┌─────────────────────────────────────────────────────┐
│    youtube_video_analytics (Supabase table)         │
│    - views, watch_time, ctr, viral_score, revenue   │
└────────────────┬────────────────────────────────────┘
                 │
    ┌────────────┼────────────┬──────────────┐
    ▼            ▼            ▼              ▼
 ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
 │ YouTube  │ │Content   │ │Marketing │ │Slack/    │
 │Analyst   │ │Intel     │ │Orchest.  │ │Discord   │
 │(hourly)  │ │(hourly)  │ │(30min)   │ │(10min)   │
 └──────────┘ └──────────┘ └──────────┘ └──────────┘
      │             │            │             │
      ▼             ▼            ▼             ▼
 Channel        Recom-      Schedule    Team Alerts
 Reports        mendations   Updates    Notifications
 │ │ │ │ │ │ │ │ │ │ │ │ │ │ │ │ │ │ │ │ │ │ │ │ │
 └─────────────────────────────────────────────────┘
               ▼
        Marketing APIs
        (REST endpoints)
               │
      ┌────────┴────────┐
      ▼                 ▼
   Frontend      External Tools
   Dashboard    (Zapier, etc)
```

---

## 💡 Recommendation Types

The Intelligence Engine generates 5+ recommendation types:

### 1. Title Optimization (Priority: 85)
- Generates alternative titles with power words
- A/B tests different variations
- **Confidence:** 85%
- **Impact:** +20% views

```
Triggers when: CTR < 4%
Action: Create 5 title variants, test for 48h, declare winner
```

### 2. Thumbnail A/B Test (Priority: 80)
- High-contrast designs vs. minimal
- Emotional faces vs. text overlays
- **Confidence:** 80%
- **Impact:** +25% views

```
Triggers when: CTR < 5%
Action: Design 3 thumbnail variations, A/B test
```

### 3. Upload Burst Strategy (Priority: 90)
- Rapid content release when performing well
- 3-5 uploads per week
- **Confidence:** 85%
- **Impact:** 2x growth multiplier

```
Triggers when: Content performing well + <3 uploads/week
Action: Plan & execute 5-video rapid release
```

### 4. Niche Pivot (Priority: 75)
- Focus on underserved niche
- Narrow target audience for higher engagement
- **Confidence:** 70%
- **Impact:** +50% views

```
Triggers when: Viral score < 50
Action: Identify niche, create 5-video series
```

### 5. Content Timing (Priority: 70)
- Optimal upload day/hour based on audience patterns
- **Confidence:** 75%
- **Impact:** +40% views

```
Triggers when: Always
Action: Analyze audience timezone, test upload times
```

---

## 🎯 Business Plan Tracking

System tracks progress toward **840K views in 10 days** goal:

```
Daily Target: 84,000 views/day
Progress Calculation:
  - Current: X views
  - Target: 840,000 views
  - Progress %: (X / 840,000) * 100
  - Status: ON TRACK if >95% of expected daily pace
```

### Alerts Trigger When:

- ✅ **ON TRACK** - Continue current strategy
- 🚨 **BEHIND** by >50k views - Execute high-priority recommendations
- 🚀 **VIRAL** - Growth >100% in 48h - Capitalize immediately

---

## 📱 REST API Endpoints

All endpoints return JSON. Include `channelId` parameter.

### Get Realtime KPIs
```bash
GET /api/youtube/marketing/dashboard-kpis?channelId=UUID

Response:
{
  "kpis": {
    "views24h": 5000,
    "views7d": 30000,
    "growthRate": 15.5,
    "healthScore": 72,
    "businessPlan": {
      "current": 420000,
      "progressPercent": 50.0,
      "daysRemaining": 5,
      "dailyNeeded": 84000,
      "onTrack": true
    }
  },
  "recommendations": { ... },
  "abTests": { ... },
  "alerts": [ ... ]
}
```

### List Recommendations
```bash
GET /api/youtube/marketing/recommendations?channelId=UUID&status=pending

Response: [
  {
    "id": "...",
    "title": "A/B Test Title Variations",
    "type": "title_optimization",
    "priority": 85,
    "confidence": "0.85",
    "estimatedImpact": "+12000 views"
  }
]
```

### Get A/B Tests
```bash
GET /api/youtube/marketing/ab-tests?channelId=UUID&status=active

Response: [
  {
    "id": "...",
    "type": "title",
    "status": "Testing",
    "variantA": "Original Title...",
    "variantB": "REVEALED: Original Title...",
    "viewsA": 500,
    "viewsB": 750
  }
]
```

### Get Optimal Schedule
```bash
GET /api/youtube/marketing/schedule?channelId=UUID

Response: {
  "heatmap": {
    "0": { "0": {...}, "1": {...}, ... },  // Sunday
    "1": { "0": {...}, "1": {...}, ... },  // Monday
    ...
  },
  "bestSlots": [...],
  "summary": {...}
}
```

### Get Revenue Analysis
```bash
GET /api/youtube/marketing/revenue-analysis?channelId=UUID

Response: {
  "byContentType": [
    { "content_type": "long-form", "cpm": 3.50, "rpm": 5.20 },
    { "content_type": "shorts", "cpm": 0.50, "rpm": 0.75 }
  ],
  "projection": {
    "projectedRevenue": 8400,  // Revenue at 840k views
    "byContentType": [...]
  }
}
```

### Get Competitor Gaps
```bash
GET /api/youtube/marketing/competitor-gaps?channelId=UUID

Response: {
  "openGaps": [...],
  "gaps": [
    {
      "type": "shorts",
      "youHave": 2,
      "competitorAvg": 15,
      "gap": 13,
      "opportunity": 65000
    }
  ],
  "topOpportunities": [...]
}
```

---

## 🔔 Notifications

### Slack Alerts

Channels (configure webhooks in `.env`):

- **#orlando-critical** - Behind schedule alerts (URGENT)
- **#orlando-marketing** - Recommendations, viral momentum
- **#orlando-tests** - A/B test winners, conclusions
- **#orlando-analytics** - Daily analytics summary

### Discord Alerts

Same categories as Slack, formatted with embeds.

### Telegram

Single channel for quick critical alerts.

---

## 📊 Monitoring & Logs

### Check Service Status

```bash
# View logs
tail -f logs/analyst.log
tail -f logs/intelligence.log
tail -f logs/orchestrator.log
tail -f logs/notifier.log

# Check running processes
ps aux | grep node

# View current PIDs
cat .pids/analyst.pid
cat .pids/intelligence.pid
cat .pids/orchestrator.pid
cat .pids/notifier.pid
```

### Dashboard Metrics

Access `/youtube/marketing` to see:
- 📊 Real-time KPIs (updated every 5 min)
- 💡 Active recommendations with execute buttons
- 🧪 A/B test performance comparison
- ⚠️  Critical alerts
- 📈 Business plan progress toward 840K

---

## ⚙️ Configuration

### Adjust Frequencies

Edit service files to change run intervals:

```typescript
// monitoring-agent/src/youtube-channel-analyst.ts
setInterval(analyzeAllChannels, 3600000) // Change from 1 hour

// youtube-engine/src/marketing-orchestrator.ts
setInterval(orchestrateRecommendations, 30 * 60 * 1000) // Change from 30 min

// monitoring-agent/src/slack-discord-notifier.ts
setInterval(notifyAll, 10 * 60 * 1000) // Change from 10 min
```

### Adjust Business Plan Goal

Update constants:

```typescript
const VIEWS_TARGET = 840000  // Change target
const DAYS_GOAL = 10        // Change deadline
```

---

## 🐛 Troubleshooting

### Services Not Starting

```bash
# Check Node is installed
node --version

# Check dependencies
npm install -w monitoring-agent
npm install -w youtube-engine

# Check logs for errors
tail -20 logs/analyst.log
```

### No Recommendations Generated

- Wait for first Intelligence Engine cycle (1 hour)
- Check Supabase connection: `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`
- Verify analytics data exists in `youtube_video_analytics` table

### Slack/Discord Alerts Not Sending

- Verify webhook URLs in `.env`
- Test webhook directly: `curl -X POST $SLACK_WEBHOOK_CRITICAL ...`
- Check notifier logs: `tail logs/notifier.log`

### Dashboard Showing No Data

- API endpoints require `?channelId=UUID` parameter
- Verify channel exists in `youtube_channels` table
- Check KPI data: `SELECT * FROM marketing_kpis_realtime WHERE channel_id = 'UUID'`

---

## 🚀 Advanced Usage

### Custom Recommendation Weights

Adjust `priority` in `content-intelligence-engine.ts`:

```typescript
recommendations.push({
  type: 'custom_type',
  priority: 95,  // Higher = more urgent
  confidence: 0.9,
  // ...
})
```

### Extend Intelligence Engine

Add new recommendation type:

```typescript
async function customAnalysis(channelId: string) {
  // Your analysis logic
  recommendations.push({
    type: 'your_type',
    priority: 80,
    // ...
  })
}
```

### Connect External Tools

Use REST APIs to integrate with:
- **Zapier** - Trigger workflows on recommendations
- **Make** - Automate content creation
- **Your CMS** - Auto-publish content
- **Analytics Tools** - Custom dashboards

---

## 📞 Support

For issues:
1. Check logs: `tail -f logs/*.log`
2. Verify environment variables: `env | grep SUPABASE`
3. Test API endpoints directly
4. Check database: Supabase dashboard

---

## 📋 Checklist

- [ ] Environment variables configured in `.env`
- [ ] Supabase migrations applied
- [ ] YouTube channel connected (has analytics)
- [ ] Marketing specialist added to `team_members`
- [ ] Slack/Discord webhooks configured (optional)
- [ ] Services started with `bash scripts/start-marketing-automation.sh`
- [ ] Dashboard accessible at `http://localhost:3000/youtube/marketing`
- [ ] Received first alerts/notifications
- [ ] Business plan goal set (default: 840K in 10 days)

---

## 🎉 You're Ready!

Your complete AI-powered marketing automation system is now running 24/7:

- ✅ Analyzing channel performance
- ✅ Generating AI recommendations
- ✅ Executing strategies automatically
- ✅ Alerting your team via Slack/Discord
- ✅ Tracking progress toward 840K views

**Next steps:**
1. Monitor dashboard for first insights
2. Execute high-confidence recommendations
3. Test title/thumbnail A/B tests
4. Review weekly analytics report
5. Adjust strategy based on results

---

**Made with ❤️  for Orlando Media Holdings**
