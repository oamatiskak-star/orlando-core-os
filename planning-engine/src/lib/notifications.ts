import axios from 'axios'
import { logger } from './logger'

export async function sendTelegram(msg: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_CHAT_ID
  if (!token || !chatId) return
  try {
    await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
      chat_id: chatId, text: msg, parse_mode: 'HTML',
    })
  } catch (err) {
    logger.warn('Telegram failed', { error: (err as Error).message })
  }
}

export async function notifyDailyPlan(summary: string): Promise<void> {
  await sendTelegram(`📅 <b>Daily Execution Plan</b>\n\n${summary}`)
}

export async function notifyBottleneck(type: string, severity: string, description: string): Promise<void> {
  const icon = severity === 'critical' ? '🚨' : severity === 'high' ? '⚠️' : '📌'
  await sendTelegram(`${icon} <b>Bottleneck: ${type}</b>\n${description}`)
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
