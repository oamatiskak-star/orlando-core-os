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
      env: { NODE_ENV: 'production' },
      log_file:    '/tmp/pm2-account-setup-runner.log',
      error_file:  '/tmp/pm2-account-setup-runner-err.log',
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
      env: { NODE_ENV: 'production' },
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
      env: { NODE_ENV: 'production', PORT: '3007' },
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
      env: { NODE_ENV: 'production' },
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
      env: { NODE_ENV: 'production', PORT: '3007' },
      log_file:    '/tmp/pm2-competitor-intel-engine.log',
      error_file:  '/tmp/pm2-competitor-intel-engine-err.log',
      time:        true,
    },
  ],
}
