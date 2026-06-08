// CLI-L — Control & Development Node
// Geen zware workers. Alleen monitoring en verificatie.
// Start met: pm2 start ecosystem.cli-l.config.js

const BASE = process.env.ORLANDO_BASE ?? '/Users/bouwproffsnederlandbv/Github/orlando-core-os'

module.exports = {
  apps: [
    // ── Status reporter — lightweight CLI-L observer ──
    {
      name:         'status-reporter',
      cwd:          `${BASE}/local-agent`,
      script:       'node',
      args:         'dist/status-reporter.js',
      interpreter:  'none',
      watch:         false,
      autorestart:   true,
      max_restarts:  999,
      restart_delay: 10000,
      env: { NODE_ENV: 'production' },
      log_file:      '/tmp/pm2-status-reporter.log',
      error_file:    '/tmp/pm2-status-reporter-err.log',
      time:          true,
    },

    // ── Local Watchdog — PM2 fleet self-healer ──
    {
      name:         'local-watchdog',
      cwd:          `${BASE}/local-watchdog`,
      script:       'node',
      args:         'dist/index.js',
      interpreter:  'none',
      watch:         false,
      autorestart:   true,
      max_restarts:  999,
      restart_delay: 10000,
      env: {
        NODE_ENV: 'production',
        WATCHDOG_HOST_ID: 'cli-l',
        SELF_APP_NAME: 'local-watchdog',
        CHECK_INTERVAL_MS: '30000',
        CRASH_LOOP_THRESHOLD: '3',
        CRASH_LOOP_WINDOW_MS: '300000',
        MAX_REBUILDS: '2',
        RESTART_COOLDOWN_MS: '90000',
        REBUILD_COOLDOWN_MS: '600000',
        WATCHDOG_DENYLIST: '',
        PORT: '3007',
      },
      log_file:      '/tmp/pm2-local-watchdog.log',
      error_file:    '/tmp/pm2-local-watchdog-err.log',
      time:          true,
    },

    // ── Lokale YouTube competitor-scraper (dagploeg-vensters 06:00 & 14:00) ──
    // Draait apart van de Docker youtube-engine. Vereist youtube-engine/.env met
    // SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, YOUTUBE_DATA_API_KEY.
    {
      name:         'yt-competitor-scraper',
      cwd:          `${BASE}/youtube-engine`,
      script:       'node',
      args:         'dist/competitor-scanner/local-runner.js',
      interpreter:  'none',
      watch:         false,
      autorestart:   true,
      max_restarts:  999,
      restart_delay: 30000,
      env: { NODE_ENV: 'production' },
      log_file:      '/tmp/pm2-yt-competitor-scraper.log',
      error_file:    '/tmp/pm2-yt-competitor-scraper-err.log',
      time:          true,
    },

    // ── YouTube discovery (1x/dag 06:30) — vindt nieuwe virale video's + kanalen,
    //    voedt viral_opportunities -> launch-funnel. Aparte app = eigen quota-budget. ──
    {
      name:         'yt-discovery',
      cwd:          `${BASE}/youtube-engine`,
      script:       'node',
      args:         'dist/competitor-scanner/discovery-runner.js',
      interpreter:  'none',
      watch:         false,
      autorestart:   true,
      max_restarts:  999,
      restart_delay: 60000,
      env: { NODE_ENV: 'production', DISCOVERY_MAX_SEARCHES: '8' },
      log_file:      '/tmp/pm2-yt-discovery.log',
      error_file:    '/tmp/pm2-yt-discovery-err.log',
      time:          true,
    },

    // ── AI Router + Hermes routing-brein (orchestrator-poller) ──
    // Draait naast Ollama op CLI-L. Local-first routing + de 6-lagen pipeline.
    // Build vooraf: cd ai-os/router && npm install && npm run build.
    // Provider-keys (ANTHROPIC/OPENAI) optioneel — zonder keys degradeert
    // preflight naar local-only advies. SUPABASE_* uit host-env.
    {
      name:         'ai-router',
      cwd:          `${BASE}/ai-os/router`,
      script:       'node',
      args:         'dist/server.js',
      interpreter:  'none',
      watch:         false,
      autorestart:   true,
      max_restarts:  999,
      restart_delay: 10000,
      env: {
        NODE_ENV:        'production',
        AI_NODE_ID:      'cli-l',
        AI_ROUTER_PORT:  '8787',
        AI_ROUTER_HOST:  '127.0.0.1',
        OLLAMA_BASE_URL: 'http://localhost:11434',
        AI_LOCAL_FIRST:  '1',
        AI_EMBED_MODEL:  'nomic-embed-text',
        AI_EMBED_DIM:    '768', // nomic-embed-text levert 768 dims (NIET 1024)
      },
      log_file:      '/tmp/pm2-ai-router.log',
      error_file:    '/tmp/pm2-ai-router-err.log',
      time:          true,
    },
  ],
}
