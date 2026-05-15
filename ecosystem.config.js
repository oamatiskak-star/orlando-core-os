const BASE = '/Users/bouwproffsnederlandbv/Github/orlando-core-os'

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
      env: { NODE_ENV: 'production' },
      log_file:    '/tmp/pm2-local-agent.log',
      error_file:  '/tmp/pm2-local-agent-err.log',
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
      env: { NODE_ENV: 'production' },
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
      env: { NODE_ENV: 'production' },
      log_file:     '/tmp/pm2-youtube-watchdog.log',
      error_file:   '/tmp/pm2-youtube-watchdog-err.log',
      out_file:     '/Users/bouwproffsnederlandbv/.pm2/logs/youtube-watchdog-out.log',
      time:         true,
    },

    // ── 4. Daily Scheduler — cron 05:30, maakt dag-taken aan ──
    {
      name:          'daily-scheduler',
      cwd:           `${BASE}/local-agent`,
      script:        'npx',
      args:          'ts-node --transpile-only src/scheduler.ts',
      interpreter:   'none',
      watch:         false,
      autorestart:   false,
      cron_restart:  '30 5 * * *',
      env: { NODE_ENV: 'production' },
      log_file:      '/tmp/pm2-daily-scheduler.log',
      error_file:    '/tmp/pm2-daily-scheduler-err.log',
      time:          true,
    },
  ],
}
