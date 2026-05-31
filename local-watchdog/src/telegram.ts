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
// Default 'warning' dempt alle info-ruis (boot, recovery, periodieke ok-meldingen).
// Zet 'error' om ook waarschuwingen (retries/drempels) te onderdrukken.
function minSeverityRank(): number {
  const v = (process.env.TELEGRAM_MIN_SEVERITY ?? 'warning').toLowerCase() as AlertSeverity
  return SEVERITY_RANK[v] ?? SEVERITY_RANK.warning
}

export async function sendTelegram(severity: AlertSeverity, title: string, body: string): Promise<void> {
  if ((SEVERITY_RANK[severity] ?? 40) < minSeverityRank()) {
    console.log(`[local-watchdog/telegram] suppressed ${severity} "${title}" (< ${process.env.TELEGRAM_MIN_SEVERITY ?? 'warning'})`)
    return
  }
  if (!BOT_TOKEN || !CHAT_ID) {
    console.log(`[local-watchdog/telegram] (no credentials) ${severity} ${title}`)
    return
  }
  const text = `${ICONS[severity]} <b>${escapeHtml(title)}</b>\n\n${escapeHtml(body).slice(0, 3500)}`
  try {
    await axios.post(
      `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
      { chat_id: CHAT_ID, text, parse_mode: 'HTML', disable_web_page_preview: true },
      { timeout: 10_000 }
    )
  } catch (err) {
    console.error('[local-watchdog/telegram] send failed:', err instanceof Error ? err.message : err)
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
