import axios from 'axios'
import { env } from './secrets'

export type AlertSeverity = 'info' | 'warning' | 'error' | 'critical'

const ICONS: Record<AlertSeverity, string> = {
  info: 'ℹ️',
  warning: '⚠️',
  error: '🔴',
  critical: '🚨',
}

const SEVERITY_RANK: Record<AlertSeverity, number> = { info: 10, warning: 20, error: 30, critical: 40 }

// Anti-spam gate: alleen meldingen >= TELEGRAM_MIN_SEVERITY gaan naar Telegram.
// Default 'warning' dempt de info-melding "audit ok, geen findings" per run.
function minSeverityRank(): number {
  const v = (process.env.TELEGRAM_MIN_SEVERITY ?? 'warning').toLowerCase() as AlertSeverity
  return SEVERITY_RANK[v] ?? SEVERITY_RANK.warning
}

export async function sendTelegram(severity: AlertSeverity, title: string, body: string): Promise<void> {
  if ((SEVERITY_RANK[severity] ?? 40) < minSeverityRank()) {
    console.log(`[checkout-auditor/telegram] suppressed ${severity} "${title}" (< ${process.env.TELEGRAM_MIN_SEVERITY ?? 'warning'})`)
    return
  }
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) {
    console.log(`[checkout-auditor/telegram] (no credentials) ${severity.toUpperCase()} ${title}`)
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
        source: 'checkout-auditor',
        level: severity === 'critical' || severity === 'error' ? 'error' : severity === 'warning' ? 'warn' : 'info',
        event: 'bot.notify',
        message: text.slice(0, 3500),
      },
      { headers: { apikey: sbKey, Authorization: `Bearer ${sbKey}` }, timeout: 10_000 },
    )
  } catch (err) {
    console.error('[checkout-auditor/telegram] hermes-log failed:', err instanceof Error ? err.message : err)
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
