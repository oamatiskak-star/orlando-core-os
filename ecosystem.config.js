const os = require('os')
const fs = require('fs')

// Laad ~/.orlando-env zodat PM2 child-processen SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY etc. krijgen.
try {
  const raw = fs.readFileSync(os.homedir() + '/.orlando-env', 'utf8')
  for (const line of raw.split('\n')) {
    const m = line.match(/^export\s+([A-Z_][A-Z0-9_]*)=["']?([^"'\n#]*)["']?/)
    if (m) process.env[m[1]] = m[2].trim()
  }
} catch { /* ~/.orlando-env niet gevonden — skip */ }

// Repo-root = de map waarin dit bestand staat → host-onafhankelijk (CLI-R, CLI-L, ...).
// Override mogelijk met ORLANDO_REPO env-var.
const BASE = process.env.ORLANDO_REPO || __dirname

const SUPA_ENV = {
  SUPABASE_URL:              process.env.SUPABASE_URL              || 'https://shaunumewswpxhmgbtvv.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
}

module.exports = {
  apps: [
    // ── 1. Local AI Agent — altijd actief, verwerkt generate_content taken ──
    {
      name:        'local-agent',
      cwd:         `${BASE}/local-agent`,
      script:      'npx',
      args:        'ts-node --transpile-only src/index.ts',
      interpreter: 'none',
      watch:       false,
      autorestart: true,
      max_restarts: 999,
      restart_delay: 5000,
      env: { NODE_ENV: 'production', ...SUPA_ENV },
      log_file:    '/tmp/pm2-local-agent.log',
      error_file:  '/tmp/pm2-local-agent-err.log',
      time:        true,
    },

    // ── Account Setup Runner — claimt account_setup_runs, LLM terms_analysis ──
    {
      name:        'account-setup-runner',
      cwd:         `${BASE}/local-agent`,
      script:      'npx',
      args:        'ts-node --transpile-only src/account-setup-runner.ts',
      interpreter: 'none',
      watch:       false,
      autorestart: true,
      max_restarts: 999,
      restart_delay: 5000,
      env: { NODE_ENV: 'production', ...SUPA_ENV },
      log_file:    '/tmp/pm2-account-setup-runner.log',
      error_file:  '/tmp/pm2-account-setup-runner-err.log',
      time:        true,
    },

    // ── Dispatch Runner — Hermes CLI-L/CLI-R werkverdeling (P5.1) ──────────────
    // Host-heartbeat + stale-reaper + surfacing van hermes.dispatch_queue. Draai
    // op ELKE host (CLI-L én CLI-R); DISPATCH_HOST_ID/WATCHDOG_HOST_ID bepaalt welke.
    // Voert GEEN Claude-werk autonoom uit — verdeelt/bewaakt alleen.
    {
      name:        'dispatch-runner',
      cwd:         `${BASE}/local-agent`,
      script:      'npx',
      args:        'ts-node --transpile-only src/dispatch-runner.ts',
      interpreter: 'none',
      watch:       false,
      autorestart: true,
      max_restarts: 999,
      restart_delay: 5000,
      env: { NODE_ENV: 'production', ...SUPA_ENV },
      log_file:    '/tmp/pm2-dispatch-runner.log',
      error_file:  '/tmp/pm2-dispatch-runner-err.log',
      time:        true,
    },

    // ── Browser Registration Runner — headed Chromium co-pilot (alleen CLI-L) ──
    // Stuurt een ECHTE browser aan om affiliate-formulieren in te vullen; pauzeert
    // vóór elke submit tot goedkeuring in het dashboard. Vereist een desktop-sessie
    // (headed). Draai alleen op de Mac met scherm. `npx playwright install chromium`
    // moet eenmalig gedraaid zijn op de host.
    {
      name:        'browser-registration-runner',
      cwd:         `${BASE}/local-agent`,
      script:      'npx',
      args:        'ts-node --transpile-only src/browser-registration-runner.ts',
      interpreter: 'none',
      watch:       false,
      autorestart: true,
      max_restarts: 999,
      restart_delay: 5000,
      // PLAYWRIGHT_BROWSERS_PATH expliciet → onafhankelijk van een (mis)geconfigureerde HOME.
      // Chromium staat in /Users/Shared (world-readable) zodat elke PM2-env hem vindt.
      env: { NODE_ENV: 'production', PLAYWRIGHT_BROWSERS_PATH: '/Users/Shared/ms-playwright', ...SUPA_ENV },
      log_file:    '/tmp/pm2-browser-registration-runner.log',
      error_file:  '/tmp/pm2-browser-registration-runner-err.log',
      time:        true,
    },

    // ── 2. YouTube Engine — altijd actief, slot-filler + upload + verificatie ──
    {
      name:        'youtube-engine',
      cwd:         `${BASE}/youtube-engine`,
      script:      'npx',
      args:        'ts-node --transpile-only src/index.ts',
      interpreter: 'none',
      watch:       false,
      autorestart: true,
      max_restarts: 999,
      restart_delay: 5000,
      env: { NODE_ENV: 'production', ...SUPA_ENV },
      log_file:    '/tmp/pm2-youtube-engine.log',
      error_file:  '/tmp/pm2-youtube-engine-err.log',
      time:        true,
    },

    // ── 3. YouTube Watchdog — 24/7 monitor, auto-fix vastgelopen uploads & crashes ──
    {
      name:         'youtube-watchdog',
      cwd:          `${BASE}/youtube-engine`,
      script:       'npx',
      args:         'ts-node --transpile-only src/watchdog.ts',
      interpreter:  'none',
      watch:        false,
      autorestart:  true,
      max_restarts: 999,
      restart_delay: 10000,
      env: { NODE_ENV: 'production', ...SUPA_ENV },
      log_file:     '/tmp/pm2-youtube-watchdog.log',
      error_file:   '/tmp/pm2-youtube-watchdog-err.log',
      out_file:     `${os.homedir()}/.pm2/logs/youtube-watchdog-out.log`,
      time:         true,
    },

    // ── 4. Mail Engine — 24/7 mail intake, AI classificatie, drafts ──
    {
      name:        'mail-engine',
      cwd:         `${BASE}/mail-engine`,
      script:      'node',
      args:        'dist/index.js',
      interpreter: 'none',
      watch:       false,
      autorestart: true,
      max_restarts: 999,
      restart_delay: 5000,
      env: { NODE_ENV: 'production', ...SUPA_ENV },
      log_file:    '/tmp/pm2-mail-engine.log',
      error_file:  '/tmp/pm2-mail-engine-err.log',
      time:        true,
    },

    // ── 5. Language Engine — multi-locale marketing QA (grammar/tone/SEO/CRO/consistency) ──
    {
      name:        'language-engine',
      cwd:         `${BASE}/language-engine`,
      script:      'npx',
      args:        'ts-node --transpile-only src/server/index.ts',
      interpreter: 'none',
      watch:       false,
      autorestart: true,
      max_restarts: 999,
      restart_delay: 5000,
      env: { NODE_ENV: 'production', PORT: '3007', ...SUPA_ENV },
      log_file:    '/tmp/pm2-language-engine.log',
      error_file:  '/tmp/pm2-language-engine-err.log',
      time:        true,
    },

    // ── 6. Daily Scheduler — cron 05:30, maakt dag-taken aan ──
    {
      name:          'daily-scheduler',
      cwd:           `${BASE}/local-agent`,
      script:        'npx',
      args:          'ts-node --transpile-only src/scheduler.ts',
      interpreter:   'none',
      watch:         false,
      autorestart:   false,
      cron_restart:  '30 5 * * *',
      env: { NODE_ENV: 'production', ...SUPA_ENV },
      log_file:      '/tmp/pm2-daily-scheduler.log',
      error_file:    '/tmp/pm2-daily-scheduler-err.log',
      time:          true,
    },

    // ── 6. Competitor Intelligence Engine — Spyglass / CONQUEST-USA ──
    //    Analyseert dagelijks publieke marketing/SEO van US-concurrenten
    //    voor AQUIER_USA_DOMINATION_ENGINE. Plain Node ESM, geen deps.
    {
      name:        'competitor-intel-engine',
      cwd:         `${BASE}/competitor-intel-engine`,
      script:      'node',
      args:        'src/index.mjs',
      interpreter: 'none',
      watch:       false,
      autorestart: true,
      max_restarts: 999,
      restart_delay: 5000,
      env: { NODE_ENV: 'production', PORT: '3007', ...SUPA_ENV },
      log_file:    '/tmp/pm2-competitor-intel-engine.log',
      error_file:  '/tmp/pm2-competitor-intel-engine-err.log',
      time:        true,
    },

    // ── 7. Apify Engine — 5 categorieën via Engine Planner ──────────────
    //    Cat 1: CF2 Intelligence (RSS + YouTube competitor transcripts)
    //    Cat 2: Vastgoed Apify Scrapers (DE/AE/SG/US/LATAM)
    //    Cat 3: Hermes MCP Registry (seed van 131 MCP servers)
    //    Cat 4: Aquier Lead Generation (B2B Leads + YCombinator)
    //    Cat 5: CF2 Cross-Platform Distributie (LinkedIn posts)
    //    Vereist: APIFY_API_TOKEN in .env of .env.gh-secrets
    {
      name:        'apify-engine',
      cwd:         `${BASE}/apify-engine`,
      script:      'node',
      args:        'src/index.mjs',
      interpreter: 'none',
      watch:       false,
      autorestart: true,
      max_restarts: 999,
      restart_delay: 10000,
      env: { NODE_ENV: 'production', PORT: '3012', DOTENV_PATH: `${BASE}/.env.gh-secrets`, ...SUPA_ENV },
      log_file:    '/tmp/pm2-apify-engine.log',
      error_file:  '/tmp/pm2-apify-engine-err.log',
      time:        true,
    },

    // ── 8. ScrapeGraph Engine — LLM-gestuurde webscraper (Python/FastAPI) ──
    //    SmartScraper, SearchGraph, MarkdownifyGraph, BatchScraper via Claude.
    //    Node.js workers roepen aan via fetch('http://localhost:3013/scrape').
    //    Setup: bash scrapegraph-engine/setup.sh  (maakt venv + playwright)
    //    Vereist: ANTHROPIC_API_KEY in .env.gh-secrets
    {
      name:        'scrapegraph-engine',
      cwd:         `${BASE}/scrapegraph-engine`,
      script:      'venv/bin/uvicorn',
      args:        'main:app --host 0.0.0.0 --port 3013',
      interpreter: 'none',
      watch:       false,
      autorestart: true,
      max_restarts: 999,
      restart_delay: 10000,
      env: { NODE_ENV: 'production', SCRAPEGRAPH_PORT: '3013' },
      log_file:    '/tmp/pm2-scrapegraph-engine.log',
      error_file:  '/tmp/pm2-scrapegraph-engine-err.log',
      time:        true,
    },

    // ── Ruflo Dispatcher — AI-orchestratie in 'ai' tijdblok (04:00-06:00 NL) ──
    // Checkt engine_window_open('ai:ruflo-coordinator') elke 5 minuten.
    // Spawnt ruflo CLI voor dagcontext-opslag (AgentDB) + viral-patterns-analyse
    // vóór de YouTube-pipeline start. Raakt NOOIT productiedata of upload-queues.
    // Migratie 220 registreert dit in de Engine Planner.
    {
      name:        'ruflo-dispatcher',
      cwd:         `${BASE}/local-agent`,
      script:      'npx',
      args:        'ts-node --transpile-only src/ruflo-dispatcher.ts',
      interpreter: 'none',
      watch:       false,
      autorestart: true,
      max_restarts: 999,
      restart_delay: 10000,
      env: { NODE_ENV: 'production', ...SUPA_ENV },
      log_file:    '/tmp/pm2-ruflo-dispatcher.log',
      error_file:  '/tmp/pm2-ruflo-dispatcher-err.log',
      time:        true,
    },

    // ── Ruflo Swarm Orchestrator — hiërarchische multi-swarm coördinator ──────
    // Beheert 3 sub-swarms op basis van Engine Planner-vensters (fase 3):
    //   orlando-youtube     → 'youtube' blok (06:00-07:00): trend + SEO + QC
    //   orlando-acquisition → 'acq_ai' blok (17:00-18:30): deals + affiliate
    //   orlando-memory      → 'ai' blok     (04:00-06:00): memory consolidatie
    // Config in local-agent/src/orlando-swarm.json.
    {
      name:        'ruflo-swarm-orchestrator',
      cwd:         `${BASE}/local-agent`,
      script:      'npx',
      args:        'ts-node --transpile-only src/ruflo-swarm-orchestrator.ts',
      interpreter: 'none',
      watch:       false,
      autorestart: true,
      max_restarts: 999,
      restart_delay: 15000,
      env: { NODE_ENV: 'production', ...SUPA_ENV },
      log_file:    '/tmp/pm2-ruflo-swarm-orchestrator.log',
      error_file:  '/tmp/pm2-ruflo-swarm-orchestrator-err.log',
      time:        true,
    },
  ],
}
