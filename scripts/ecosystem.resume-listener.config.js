// PM2 ecosystem voor de iTerm2 resume-listener ("Ga verder"-knop).
// Draai per host ALLEEN de eigen app:
//   CLI-L:  pm2 start scripts/ecosystem.resume-listener.config.js --only resume-listener-cli-l
//   CLI-R:  pm2 start scripts/ecosystem.resume-listener.config.js --only resume-listener-cli-r
//
// Vereist in de shell vóór `pm2 start` (of via `pm2 set`):
//   export SUPABASE_SERVICE_ROLE_KEY=...    (service-role key — NIET in repo)
// SUPABASE_URL heeft een default (publieke project-URL) maar mag overschreven worden.
//
// Belangrijk (macOS): de listener stuurt iTerm2/System Events aan. Geef het
// proces (node/pm2 of Terminal) Toegankelijkheid-rechten, en start PM2 in je
// eigen login-sessie (niet als root/launchd-systeemdaemon) zodat het de GUI mag bedienen.

const HOME = process.env.HOME
const REPO = process.env.ORLANDO_CORE_OS_DIR || `${HOME}/Code/orlando-core-os`
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://shaunumewswpxhmgbtvv.supabase.co'

const app = (machine) => ({
  name: `resume-listener-${machine}`,
  script: 'scripts/iterm-resume-listener.sh',
  interpreter: 'bash',
  cwd: REPO,
  env: {
    MACHINE_ID: machine,
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    CLAUDE_BOOT_DELAY: process.env.CLAUDE_BOOT_DELAY || '5',
    POLL_INTERVAL: process.env.POLL_INTERVAL || '4',
  },
  autorestart: true,
  max_restarts: 20,
  restart_delay: 3000,
  out_file: `${HOME}/.pm2/logs/resume-listener-${machine}.out.log`,
  error_file: `${HOME}/.pm2/logs/resume-listener-${machine}.err.log`,
})

module.exports = { apps: [app('cli-l'), app('cli-r')] }
