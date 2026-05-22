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

export async function sendTelegram(severity: AlertSeverity, title: string, body: string): Promise<void> {
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
