import axios from 'axios'

export type AlertSeverity = 'info' | 'warning' | 'error' | 'critical'

const ICONS: Record<AlertSeverity, string> = {
  info: 'ℹ️',
  warning: '⚠️',
  error: '🔴',
  critical: '🚨'
}

const SEVERITY_RANK: Record<AlertSeverity, number> = { info: 10, warning: 20, error: 30, critical: 40 }

// Anti-spam gate: alleen meldingen >= TELEGRAM_MIN_SEVERITY worden verwerkt.
// Default 'warning' dempt info-ruis (boot, recovery, dry-run previews).
function minSeverityRank(): number {
  const v = (process.env.TELEGRAM_MIN_SEVERITY ?? 'warning').toLowerCase() as AlertSeverity
  return SEVERITY_RANK[v] ?? SEVERITY_RANK.warning
}

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 80)
}

/**
 * Centrale watchdog-notificatie via Hermes.
 *
 * - info/warning   -> stil loggen in hermes.logs (log_to_hermes), géén push.
 * - error/critical -> hermes_notify_now: raise + ONMIDDELLIJKE Telegram-push,
 *                     zonder te wachten op de 5-min hermes_supervisor-cyclus.
 *
 * `dedupKey` houdt herhaalde ticks van dezelfde failure samen (anti-spam,
 * 6u her-notify-venster in de DB). Geef per service+deploy een stabiele sleutel.
 */
export async function sendTelegram(
  severity: AlertSeverity,
  title: string,
  body: string,
  dedupKey?: string
): Promise<void> {
  if ((SEVERITY_RANK[severity] ?? 40) < minSeverityRank()) {
    console.log(`[watchdog/telegram] suppressed ${severity} "${title}" (< ${process.env.TELEGRAM_MIN_SEVERITY ?? 'warning'})`)
    return
  }

  const sbUrl = process.env.SUPABASE_URL
  const sbKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!sbUrl || !sbKey) {
    console.log(`[watchdog/telegram] (no supabase creds, would send) ${severity.toUpperCase()} ${title}`)
    return
  }
  const headers = { apikey: sbKey, Authorization: `Bearer ${sbKey}` }
  const text = `${ICONS[severity]} ${title}\n\n${body}`.slice(0, 3500)
  // Regel: alleen KRITIEK (manuele input) pusht direct. error/warning/info loggen
  // stil in hermes.logs en verschijnen hooguit in de 6×/dag digest.
  const immediate = severity === 'critical'

  try {
    if (immediate) {
      // Failed service (kritiek): raise + directe Telegram-push via Hermes.
      await axios.post(
        `${sbUrl}/rest/v1/rpc/hermes_notify_now`,
        {
          p_key: dedupKey ?? `watchdog:${slug(title)}`,
          p_sev: severity,
          p_type: 'watchdog',
          p_titel: title.slice(0, 200),
          p_detail: body.slice(0, 3000),
          p_fabriek: null
        },
        { headers, timeout: 12_000 }
      )
    } else {
      // error/warning/info: alleen loggen in hermes.logs, geen push.
      await axios.post(
        `${sbUrl}/rest/v1/rpc/log_to_hermes`,
        {
          source: 'watchdog-engine',
          level: severity === 'error' ? 'error' : severity === 'warning' ? 'warn' : 'info',
          event: 'bot.notify',
          message: text
        },
        { headers, timeout: 10_000 }
      )
    }
  } catch (err) {
    console.error('[watchdog/telegram] hermes notify failed:', err instanceof Error ? err.message : err)
  }
}
