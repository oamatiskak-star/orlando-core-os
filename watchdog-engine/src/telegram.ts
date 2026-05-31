import axios from 'axios'

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const CHAT_ID = process.env.TELEGRAM_CHAT_ID

export type AlertSeverity = 'info' | 'warning' | 'error' | 'critical'

const ICONS: Record<AlertSeverity, string> = {
  info: 'ℹ️',
  warning: '⚠️',
  error: '🔴',
  critical: '🚨'
}

const SEVERITY_RANK: Record<AlertSeverity, number> = { info: 10, warning: 20, error: 30, critical: 40 }

// Anti-spam gate: alleen meldingen >= TELEGRAM_MIN_SEVERITY gaan naar Telegram.
// Default 'warning' dempt alle info-ruis (boot, recovery, dry-run previews).
// Zet 'error' om ook waarschuwingen (retries/redeploy-attempts) te onderdrukken.
function minSeverityRank(): number {
  const v = (process.env.TELEGRAM_MIN_SEVERITY ?? 'warning').toLowerCase() as AlertSeverity
  return SEVERITY_RANK[v] ?? SEVERITY_RANK.warning
}

export async function sendTelegram(severity: AlertSeverity, title: string, body: string): Promise<void> {
  if ((SEVERITY_RANK[severity] ?? 40) < minSeverityRank()) {
    console.log(`[watchdog/telegram] suppressed ${severity} "${title}" (< ${process.env.TELEGRAM_MIN_SEVERITY ?? 'warning'})`)
    return
  }
  if (!BOT_TOKEN || !CHAT_ID) {
    console.log(`[watchdog/telegram] (no credentials, would send) ${severity.toUpperCase()} ${title}`)
    return
  }
  const text = `${ICONS[severity]} <b>${escapeHtml(title)}</b>\n\n${escapeHtml(body).slice(0, 3500)}`
  // Omgeleid naar Hermes: centraal loggen i.p.v. direct naar Orlando's Telegram.
  const sbUrl = process.env.SUPABASE_URL
  const sbKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!sbUrl || !sbKey) return
  try {
    await axios.post(
      `${sbUrl}/rest/v1/rpc/log_to_hermes`,
      {
        source: 'watchdog-engine',
        level: severity === 'critical' || severity === 'error' ? 'error' : severity === 'warning' ? 'warn' : 'info',
        event: 'bot.notify',
        message: text.slice(0, 3500),
      },
      { headers: { apikey: sbKey, Authorization: `Bearer ${sbKey}` }, timeout: 10_000 }
    )
  } catch (err) {
    console.error('[watchdog/telegram] hermes-log failed:', err instanceof Error ? err.message : err)
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
