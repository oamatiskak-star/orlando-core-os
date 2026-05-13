module.exports = {
  apps: [
    {
      name: 'local-agent',
      script: 'dist/index.js',
      instances: 1,
      autorestart: true,
      watch: false,
      env: { NODE_ENV: 'production' },
    },
    {
      name: 'status-reporter',
      script: 'dist/status-reporter.js',
      instances: 1,
      autorestart: true,
      watch: false,
      env: { NODE_ENV: 'production' },
    },
  ],
}
