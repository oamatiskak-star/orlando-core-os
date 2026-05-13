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
