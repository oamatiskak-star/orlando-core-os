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
  ],
}
