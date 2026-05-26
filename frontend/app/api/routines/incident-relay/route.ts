import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * POST /api/routines/incident-relay
 *
 * Endpoint dat door de Supabase pg_trigger `trg_routines_incident_relay` wordt
 * aangeroepen wanneer een `executive_alerts` row wordt ingevoerd met
 * `target_kind='routine' AND severity in ('critical','high')`.
 *
 * Stuurt een geformatteerde Telegram bericht (zelfde stack als watchdog).
 *
 * Auth: X-Routines-Token header moet match met env ROUTINES_TOKEN.
 * Telegram: env TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID verplicht.
 *
 * Payload van pg_trigger (zie migratie 094):
 *   {
 *     alert:   { id, alert_kind, severity, title, message, payload, detected_at },
 *     routine: { id, name, slug, kind, status } | null,
 *     context: {
 *       failed_runs_1h: [...],
 *       open_watchdog_incidents: [...]
 *     }
 *   }
 */
export const revalidate = 0

type IncidentPayload = {
  alert: {
    id: string
    alert_kind: string
    severity: string
    title: string
    message: string
    payload: Record<string, unknown>
    detected_at: string
  }
  routine: { id: string; name: string; slug: string; kind: string; status: string } | null
  context: {
    failed_runs_1h: Array<{ run_id: string; routine_id: string; started_at: string; error: Record<string, unknown> | null }>
    open_watchdog_incidents: Array<{ service_id: string; service_name: string; failure_kind: string; opened_at: string }>
  }
}

const SEVERITY_EMOJI: Record<string, string> = {
  critical: '🔴',
  high:     '🟠',
  medium:   '🟡',
  low:      '⚪',
  info:     '🔵',
}

function escapeMarkdown(s: string): string {
  return s.replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, c => `\\${c}`)
}

function fmtTime(s: string): string {
  return new Date(s).toLocaleString('nl-NL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function buildTelegramMessage(p: IncidentPayload): string {
  const emoji = SEVERITY_EMOJI[p.alert.severity] ?? '⚠️'
  const lines: string[] = []
  lines.push(`${emoji} *Routine incident — ${p.alert.severity.toUpperCase()}*`)
  lines.push('')
  lines.push(`*${escapeMarkdown(p.alert.title)}*`)
  lines.push(escapeMarkdown(p.alert.message))
  if (p.routine) {
    lines.push('')
    lines.push(`📋 Routine: \`${escapeMarkdown(p.routine.slug)}\` — ${escapeMarkdown(p.routine.name)} \\(${escapeMarkdown(p.routine.kind)}, ${escapeMarkdown(p.routine.status)}\\)`)
  }
  if (p.context.failed_runs_1h.length > 0) {
    lines.push('')
    lines.push(`💥 *Failed runs \\(1u\\)*: ${p.context.failed_runs_1h.length}`)
    p.context.failed_runs_1h.slice(0, 3).forEach((r) => {
      const errMsg = r.error && typeof r.error === 'object' && 'message' in r.error
        ? String((r.error as { message?: unknown }).message).slice(0, 80)
        : '—'
      lines.push(`  • \`${r.run_id.slice(0, 8)}\` @ ${escapeMarkdown(fmtTime(r.started_at))}: ${escapeMarkdown(errMsg)}`)
    })
  }
  if (p.context.open_watchdog_incidents.length > 0) {
    lines.push('')
    lines.push(`🩺 *Open watchdog incidents*: ${p.context.open_watchdog_incidents.length}`)
    p.context.open_watchdog_incidents.slice(0, 3).forEach((i) => {
      lines.push(`  • ${escapeMarkdown(i.service_name)} — ${escapeMarkdown(i.failure_kind)}`)
    })
  }
  lines.push('')
  lines.push(`🕒 ${escapeMarkdown(fmtTime(p.alert.detected_at))}`)
  return lines.join('\n')
}

async function sendTelegram(text: string): Promise<{ ok: boolean; status: number; body?: string }> {
  const token  = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_CHAT_ID
  if (!token || !chatId) return { ok: false, status: 0, body: 'TELEGRAM_BOT_TOKEN of TELEGRAM_CHAT_ID env mist' }

  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id:    chatId,
      text,
      parse_mode: 'MarkdownV2',
      disable_web_page_preview: true,
    }),
  })
  const body = await res.text()
  return { ok: res.ok, status: res.status, body }
}

export async function POST(req: NextRequest) {
  const token = req.headers.get('x-routines-token') ?? ''
  if (!process.env.ROUTINES_TOKEN || token !== process.env.ROUTINES_TOKEN) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const payload = await req.json().catch(() => null) as IncidentPayload | null
  if (!payload?.alert?.id) {
    return NextResponse.json({ error: 'invalid payload — alert.id missing' }, { status: 400 })
  }

  const text = buildTelegramMessage(payload)
  const telegram = await sendTelegram(text)

  const db = createAdminClient()
  await db.from('routine_audit_log').insert({
    routine_id: payload.routine?.id ?? null,
    action:     telegram.ok ? 'incident.telegram_sent' : 'incident.telegram_failed',
    actor:      'system',
    detail:     {
      alert_id:        payload.alert.id,
      severity:        payload.alert.severity,
      telegram_status: telegram.status,
      telegram_error:  telegram.ok ? null : telegram.body?.slice(0, 200),
    },
  })

  return NextResponse.json({
    ok:       telegram.ok,
    telegram: { status: telegram.status },
  })
}

// GET voor smoke-test (geen Telegram, alleen config check)
export async function GET(req: NextRequest) {
  const token = req.headers.get('x-routines-token') ?? ''
  if (!process.env.ROUTINES_TOKEN || token !== process.env.ROUTINES_TOKEN) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return NextResponse.json({
    ok: true,
    config: {
      has_routines_token: !!process.env.ROUTINES_TOKEN,
      has_bot_token:      !!process.env.TELEGRAM_BOT_TOKEN,
      has_chat_id:        !!process.env.TELEGRAM_CHAT_ID,
    },
  })
}
