// config.mjs — env loading (process.env, of fallback dotenv-bestand)
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Laad een .env-achtig bestand in process.env (zonder bestaande waarden te overschrijven).
function loadEnvFile(path) {
  if (!path || !existsSync(path)) return false
  const text = readFileSync(path, 'utf8')
  for (const line of text.split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (!m) continue
    const key = m[1]
    let val = m[2].trim()
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    if (val && process.env[key] === undefined) process.env[key] = val
  }
  return true
}

// Volgorde: expliciet DOTENV_PATH → lokale .env → repo-root .env.gh-secrets
loadEnvFile(process.env.DOTENV_PATH)
loadEnvFile(join(__dirname, '..', '.env'))
loadEnvFile(join(__dirname, '..', '..', '.env.gh-secrets'))

export const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
export const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
export const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || ''
export const PORT = parseInt(process.env.PORT || '3007', 10)
export const CRON_HOUR = parseInt(process.env.COMPETITOR_CRON_HOUR || '4', 10)
export const HAIKU = 'claude-haiku-4-5-20251001'

if (!SUPABASE_URL || !SERVICE_KEY) {
  throw new Error('SUPABASE_URL en SUPABASE_SERVICE_ROLE_KEY zijn vereist (env of .env.gh-secrets)')
}
