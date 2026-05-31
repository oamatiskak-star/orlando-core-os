export const CONFIG = {
  // Service identity
  SERVICE_NAME: 'hermes-recovery-agent',
  NODE_ID: process.env.NODE_ID || `hermes-recovery-${Date.now()}`,

  // Database
  SUPABASE_URL: process.env.SUPABASE_URL || '',
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || '',

  // Recovery parameters
  MAX_RETRY_ATTEMPTS: 3,
  RECOVERY_TIMEOUT_MS: 5 * 60_000, // 5 minutes
  PATTERN_WINDOW_HOURS: 24,
  PATTERN_THRESHOLD: 2, // 2x same error = systemic

  // Health monitoring
  HEARTBEAT_INTERVAL_MS: 30_000, // 30 seconds
  HEALTH_CHECK_INTERVAL_MS: 30_000,
  HEARTBEAT_TIMEOUT_MS: 2 * 60_000, // 2 minutes
  CRITICAL_TIMEOUT_MS: 5 * 60_000, // 5 minutes

  // Notifications
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN || '',
  TELEGRAM_CHAT_ID: process.env.TELEGRAM_CHAT_ID || '',
  TELEGRAM_MIN_SEVERITY: process.env.TELEGRAM_MIN_SEVERITY || 'warning',

  // Environment
  ENVIRONMENT: process.env.NODE_ENV || 'development',
}

export function validateConfig(): string[] {
  const errors: string[] = []
  if (!CONFIG.SUPABASE_URL) errors.push('SUPABASE_URL not set')
  if (!CONFIG.SUPABASE_SERVICE_ROLE_KEY) errors.push('SUPABASE_SERVICE_ROLE_KEY not set')
  return errors
}
