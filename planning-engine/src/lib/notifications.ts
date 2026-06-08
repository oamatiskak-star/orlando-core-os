import axios from 'axios'
import { logger } from './logger'

// Alles loopt via Hermes (centraal brein). Niet meer direct naar Telegram.
// level 'critical' -> directe push (manuele input); anders stil loggen in hermes.logs.
export async function sendTelegram(msg: string, level: 'info' | 'warn' | 'critical' = 'info'): Promise<void> {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return
  const headers = { apikey: key, Authorization: `Bearer ${key}` }
  try {
    if (level === 'critical') {
      await axios.post(`${url}/rest/v1/rpc/hermes_notify_now`, {
        p_key: `planning:${msg.slice(0, 60)}`, p_sev: 'critical', p_type: 'planning',
        p_titel: 'Planning', p_detail: msg.slice(0, 3000), p_fabriek: null,
      }, { headers })
    } else {
      await axios.post(`${url}/rest/v1/rpc/log_to_hermes`, {
        source: 'planning-engine', level: level === 'warn' ? 'warn' : 'info', event: 'notify', message: msg.slice(0, 3500),
      }, { headers })
    }
  } catch (err) {
    logger.warn('Hermes log failed', { error: (err as Error).message })
  }
}

export async function notifyDailyPlan(summary: string): Promise<void> {
  await sendTelegram(`📅 <b>Daily Execution Plan</b>\n\n${summary}`)
}

export async function notifyBottleneck(type: string, severity: string, description: string): Promise<void> {
  const icon = severity === 'critical' ? '🚨' : severity === 'high' ? '⚠️' : '📌'
  const level = severity === 'critical' ? 'critical' : severity === 'high' ? 'warn' : 'info'
  await sendTelegram(`${icon} <b>Bottleneck: ${type}</b>\n${description}`, level)
}

export async function notifyMilestoneAchieved(naam: string, impact: number): Promise<void> {
  await sendTelegram(`🎯 <b>Milestone Bereikt!</b>\n\n${naam}\n💰 Impact: €${impact.toLocaleString('nl-NL')}`)
}

export async function notifyAgentIdle(agentSlug: string, machine: string): Promise<void> {
  await sendTelegram(`🤖 Agent idle — ${agentSlug} op ${machine} — nieuw werk toegewezen`)
}

export async function notifyDeadlineRisk(taskName: string, daysLeft: number): Promise<void> {
  await sendTelegram(`⏰ <b>Deadline Risk</b>\n\n${taskName}\n${daysLeft} dag(en) over`)
}
