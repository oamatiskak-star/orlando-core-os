// CLI-R — Full Autonomous Production Node
// Alle zware workers. Fallback wanneer Coolify/Docker niet beschikbaar.
// Start met: pm2 start ecosystem.cli-r.config.js
//
// VOORKEUR: gebruik docker compose -f docker-compose.cli-r.yml up -d via Coolify.
// Deze PM2 config is de fallback voor directe uitvoering zonder Docker.

const BASE = process.env.ORLANDO_BASE ?? '/Users/bouwproffsnederlandbv/Github/orlando-core-os'

module.exports = {
  apps: [

    // ── 1. Local Agent — verwerkt generate_content taken ──────────────────
    {
      name:         'local-agent',
      cwd:          `${BASE}/local-agent`,
      script:       'npx',
      args:         'ts-node --transpile-only src/index.ts',
      interpreter:  'none',
      watch:         false,
      autorestart:   true,
      max_restarts:  999,
      restart_delay: 5000,
      env: { NODE_ENV: 'production' },
      log_file:      '/tmp/pm2-local-agent.log',
      error_file:    '/tmp/pm2-local-agent-err.log',
      time:          true,
    },

    // ── 2. Content Factory ────────────────────────────────────────────────
    {
      name:         'content-factory',
      cwd:          `${BASE}/local-agent`,
      script:       'node',
      args:         'dist/factory.js',
      interpreter:  'none',
      watch:         false,
      autorestart:   true,
      max_restarts:  999,
      restart_delay: 5000,
      env: { NODE_ENV: 'production' },
      log_file:      '/tmp/pm2-content-factory.log',
      error_file:    '/tmp/pm2-content-factory-err.log',
      time:          true,
    },

    // ── 3. Video Workers (2 parallelle workers) ───────────────────────────
    {
      name:         'video-worker-1',
      cwd:          `${BASE}/local-agent`,
      script:       'node',
      args:         'dist/index.js',
      interpreter:  'none',
      watch:         false,
      autorestart:   true,
      max_restarts:  999,
      restart_delay: 5000,
      env: { NODE_ENV: 'production', WORKER_ID: 'W1' },
      log_file:      '/tmp/pm2-video-worker-1.log',
      error_file:    '/tmp/pm2-video-worker-1-err.log',
      time:          true,
    },
    {
      name:         'video-worker-2',
      cwd:          `${BASE}/local-agent`,
      script:       'node',
      args:         'dist/index.js',
      interpreter:  'none',
      watch:         false,
      autorestart:   true,
      max_restarts:  999,
      restart_delay: 5000,
      env: { NODE_ENV: 'production', WORKER_ID: 'W2' },
      log_file:      '/tmp/pm2-video-worker-2.log',
      error_file:    '/tmp/pm2-video-worker-2-err.log',
      time:          true,
    },

    // ── 4. SEO Optimizer ──────────────────────────────────────────────────
    {
      name:         'seo-optimizer',
      cwd:          `${BASE}/local-agent`,
      script:       'node',
      args:         'dist/seo-optimizer.js',
      interpreter:  'none',
      watch:         false,
      autorestart:   true,
      max_restarts:  999,
      restart_delay: 5000,
      env: { NODE_ENV: 'production' },
      log_file:      '/tmp/pm2-seo-optimizer.log',
      error_file:    '/tmp/pm2-seo-optimizer-err.log',
      time:          true,
    },

    // ── 5. YouTube Engine — slot-filler + upload + verificatie ────────────
    {
      name:         'youtube-engine',
      cwd:          `${BASE}/youtube-engine`,
      script:       'node',
      args:         'dist/index.js',
      interpreter:  'none',
      watch:         false,
      autorestart:   true,
      max_restarts:  999,
      restart_delay: 5000,
      env: { NODE_ENV: 'production' },
      log_file:      '/tmp/pm2-youtube-engine.log',
      error_file:    '/tmp/pm2-youtube-engine-err.log',
      time:          true,
    },

    // ── 6. YouTube Watchdog ───────────────────────────────────────────────
    {
      name:         'youtube-watchdog',
      cwd:          `${BASE}/youtube-engine`,
      script:       'node',
      args:         'dist/watchdog.js',
      interpreter:  'none',
      watch:         false,
      autorestart:   true,
      max_restarts:  999,
      restart_delay: 10000,
      env: { NODE_ENV: 'production' },
      log_file:      '/tmp/pm2-youtube-watchdog.log',
      error_file:    '/tmp/pm2-youtube-watchdog-err.log',
      time:          true,
    },

    // ── 7. Mail Engine ────────────────────────────────────────────────────
    {
      name:         'mail-engine',
      cwd:          `${BASE}/mail-engine`,
      script:       'node',
      args:         'dist/index.js',
      interpreter:  'none',
      watch:         false,
      autorestart:   true,
      max_restarts:  999,
      restart_delay: 5000,
      env: { NODE_ENV: 'production' },
      log_file:      '/tmp/pm2-mail-engine.log',
      error_file:    '/tmp/pm2-mail-engine-err.log',
      time:          true,
    },

    // ── 8. Planning Engine ────────────────────────────────────────────────
    {
      name:         'planning-engine',
      cwd:          `${BASE}/planning-engine`,
      script:       'node',
      args:         'dist/index.js',
      interpreter:  'none',
      watch:         false,
      autorestart:   true,
      max_restarts:  999,
      restart_delay: 5000,
      env: { NODE_ENV: 'production', MACHINE_ID: 'cli-r-executor-1' },
      log_file:      '/tmp/pm2-planning-engine.log',
      error_file:    '/tmp/pm2-planning-engine-err.log',
      time:          true,
    },

    // ── 9. Daily Scheduler — cron 05:30 ──────────────────────────────────
    {
      name:          'daily-scheduler',
      cwd:           `${BASE}/local-agent`,
      script:        'node',
      args:          'dist/scheduler.js',
      interpreter:   'none',
      watch:          false,
      autorestart:    false,
      cron_restart:   '30 5 * * *',
      env: { NODE_ENV: 'production' },
      log_file:       '/tmp/pm2-daily-scheduler.log',
      error_file:     '/tmp/pm2-daily-scheduler-err.log',
      time:           true,
    },

    // ── 10. Monitoring Agent — host-level fallback ────────────────────────
    {
      name:         'monitoring-agent',
      cwd:          `${BASE}/monitoring-agent`,
      script:       'node',
      args:         'dist/index.js',
      interpreter:  'none',
      watch:         false,
      autorestart:   true,
      max_restarts:  999,
      restart_delay: 15000,
      env: { NODE_ENV: 'production', NODE_ID: 'cli-r', POLL_INTERVAL_MS: '30000' },
      log_file:      '/tmp/pm2-monitoring-agent.log',
      error_file:    '/tmp/pm2-monitoring-agent-err.log',
      time:          true,
    },

    // ── 11. Local Watchdog — PM2 fleet self-healer ────────────────────────
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
        WATCHDOG_HOST_ID: 'cli-r',
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
  ],
}
