import axios from 'axios'
import { logger } from './logger'

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const CHAT_ID = process.env.TELEGRAM_CHAT_ID

export async function sendTelegram(message: string): Promise<void> {
  if (!BOT_TOKEN || !CHAT_ID) return
  try {
    await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      chat_id: CHAT_ID,
      text: message,
      parse_mode: 'HTML',
    })
  } catch (err) {
    logger.warn('Telegram notification failed', { error: (err as Error).message })
  }
}

export async function notifyUploadSuccess(videoTitle: string, channelName: string, youtubeUrl: string): Promise<void> {
  await sendTelegram(
    `✅ <b>YouTube Upload Verified</b>\n\n` +
    `📹 ${videoTitle}\n` +
    `📺 ${channelName}\n` +
    `🔗 <a href="${youtubeUrl}">${youtubeUrl}</a>`
  )
}

export async function notifyUploadFailure(videoTitle: string, channelName: string, error: string): Promise<void> {
  await sendTelegram(
    `❌ <b>YouTube Upload Failed</b>\n\n` +
    `📹 ${videoTitle}\n` +
    `📺 ${channelName}\n` +
    `⚠️ ${error}`
  )
}

export async function notifyCopyrightClaim(videoTitle: string, channelName: string, claimType: string): Promise<void> {
  await sendTelegram(
    `⚠️ <b>Copyright Claim Detected</b>\n\n` +
    `📹 ${videoTitle}\n` +
    `📺 ${channelName}\n` +
    `📋 Status: ${claimType.toUpperCase()}`
  )
}

export async function notifyManualReview(videoTitle: string, channelName: string, reason: string): Promise<void> {
  await sendTelegram(
    `🔍 <b>Manual Review Required</b>\n\n` +
    `📹 ${videoTitle}\n` +
    `📺 ${channelName}\n` +
    `📋 Reden: ${reason}`
  )
}

export async function notifyUploadStarted(videoTitle: string, channelName: string, scheduledAt: string | null): Promise<void> {
  const timeStr = scheduledAt
    ? new Date(scheduledAt).toLocaleString('nl-NL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
    : 'direct'
  await sendTelegram(
    `🚀 <b>Upload Gestart</b>\n\n` +
    `📹 ${videoTitle}\n` +
    `📺 ${channelName}\n` +
    `🕐 Gepland: ${timeStr}`
  )
}

export async function notifySlotFilled(videoTitle: string, channelName: string, scheduledAt: string): Promise<void> {
  const timeStr = new Date(scheduledAt).toLocaleString('nl-NL', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
  await sendTelegram(
    `📅 <b>Slot Ingepland</b>\n\n` +
    `📹 ${videoTitle}\n` +
    `📺 ${channelName}\n` +
    `🕐 ${timeStr}`
  )
}

export async function notifyPlannerRun(totalSlots: number, perChannel: Record<string, number>): Promise<void> {
  if (totalSlots === 0) return
  const lines = Object.entries(perChannel)
    .filter(([, n]) => n > 0)
    .map(([naam, n]) => `  • ${naam}: ${n} slots`)
    .join('\n')
  await sendTelegram(
    `📆 <b>Auto-planner: ${totalSlots} nieuwe slots</b>\n\n` +
    `${lines}`
  )
}

export async function notifyQuotaLimit(channelName: string, used: number, limit: number): Promise<void> {
  await sendTelegram(
    `⚠️ <b>Quota Limiet Bereikt</b>\n\n` +
    `📺 ${channelName}\n` +
    `📊 ${used}/${limit} uploads vandaag — wacht op reset 07:00 UTC`
  )
}
