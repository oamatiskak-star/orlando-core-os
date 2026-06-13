module.exports = {
  apps: [
    {
      name:        'content-factory',
      script:      'dist/factory.js',
      instances:   1,
      autorestart: true,
      watch:       false,
      env:         { NODE_ENV: 'production' },
    },
    {
      name:        'video-worker-1',
      script:      'dist/index.js',
      instances:   1,
      autorestart: true,
      watch:       false,
      env:         { NODE_ENV: 'production', WORKER_ID: 'W1' },
    },
    {
      name:        'video-worker-2',
      script:      'dist/index.js',
      instances:   1,
      autorestart: true,
      watch:       false,
      env:         { NODE_ENV: 'production', WORKER_ID: 'W2' },
    },
    {
      name:        'seo-optimizer',
      script:      'dist/seo-optimizer.js',
      instances:   1,
      autorestart: true,
      watch:       false,
      env:         { NODE_ENV: 'production' },
    },
    {
      name:        'status-reporter',
      script:      'dist/status-reporter.js',
      instances:   1,
      autorestart: true,
      watch:       false,
      env:         { NODE_ENV: 'production' },
    },
    {
      name:        'routines-runner',
      script:      'dist/routines-runner.js',
      instances:   1,
      autorestart: true,
      watch:       false,
      env:         {
        NODE_ENV: 'production',
        ROUTINES_SERVICE_ID:   'local-agent-macmini',
        ROUTINES_SERVICE_NAME: 'Routines Runner (Mac mini)',
        WATCHDOG_HOST_ID:      'cli-l',
      },
    },
    {
      // €60K Sprint B — CF2-producer als autonome, scheduler-driven loop.
      // Gated door de Engine Planner (engine content:cf2-video-projects-runner,
      // blok 'content' 18:30-22:00). Live-productie via lokale modellen (Ollama/LM Studio),
      // credit-vrij; upload als private + auto-public via publish-overdue.
      name:        'cf2-producer',
      script:      'dist/cf2-producer.js',
      instances:   1,
      autorestart: true,
      watch:       false,
      env:         {
        NODE_ENV:           'production',
        CF2_PRODUCER_LOOP:  '1',
        CF2_PRODUCER_MODE:  'live',
        CF2_PUBLISH:        '1',
        CF2_PRODUCER_LIMIT: '3',
      },
    },
    {
      // Affiliate Discovery — continue, config-gedreven crawler over affiliate_api_connectors.
      // Gated via Engine Planner ('affiliate:discovery', blok acq_ai). Slaat connectors zonder
      // credential over (geen mock). Draait alleen als enabled-connectors bestaan.
      name:        'affiliate-discovery',
      script:      'dist/affiliate-discovery.js',
      instances:   1,
      autorestart: true,
      watch:       false,
      env:         {
        NODE_ENV:                       'production',
        AFFILIATE_DISCOVERY_LOOP:       '1',
        AFFILIATE_DISCOVERY_INTERVAL_MS: '21600000',
      },
    },
  ],
}
