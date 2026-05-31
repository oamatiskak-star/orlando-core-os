import { timingSafeEqual } from 'node:crypto';
import { request } from 'undici';
import { loadConfig, telegramEnabled } from '../core/config.js';
import { childLogger } from '../core/logger.js';
import type { InteractiveListOption } from './whatsapp-cloud-api.js';

const log = childLogger({ component: 'telegram-bot' });

const API = 'https://api.telegram.org';

export type TelegramListMessage = {
  chat_id: string;
  header: string;
  body: string;
  footer?: string;
  options: InteractiveListOption[];
};

export type TelegramSendResult =
  | { ok: true; messageId: string }
  | { ok: false; error: string; status: number };

function apiUrl(token: string, method: string): string {
  return `${API}/bot${token}/${method}`;
}

/**
 * Verstuurt een escalatie met inline-keyboard actie-menu.
 * Elke optie wordt een knop op een eigen rij; callback_data = option.key
 * (Telegram-limiet: 1–64 bytes). Géén parse_mode → plain text, robuust tegen
 * speciale tekens in diagnosis.
 */
export async function sendInteractiveList(
  msg: TelegramListMessage,
): Promise<TelegramSendResult> {
  const cfg = loadConfig();
  if (!telegramEnabled(cfg) || !cfg.TELEGRAM_BOT_TOKEN) {
    return { ok: false, error: 'telegram_not_configured', status: 0 };
  }
  if (msg.options.length === 0 || msg.options.length > 10) {
    return { ok: false, error: 'options_count_invalid', status: 400 };
  }
  // callback_data mag max 64 bytes — sla over als een key te lang is.
  const tooLong = msg.options.find(
    (o) => Buffer.byteLength(o.key, 'utf8') > 64,
  );
  if (tooLong) {
    return { ok: false, error: `callback_data_too_long:${tooLong.key}`, status: 400 };
  }

  const textParts = [msg.header, '', msg.body];
  if (msg.footer) textParts.push('', msg.footer);

  const payload = {
    chat_id: msg.chat_id,
    text: textParts.join('\n').slice(0, 4096),
    disable_web_page_preview: true,
    reply_markup: {
      inline_keyboard: msg.options.map((o) => [
        { text: o.label.slice(0, 64), callback_data: o.key },
      ]),
    },
  };

  const res = await request(apiUrl(cfg.TELEGRAM_BOT_TOKEN, 'sendMessage'), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const text = await res.body.text();
  if (res.statusCode >= 200 && res.statusCode < 300) {
    const json = JSON.parse(text) as {
      ok: boolean;
      result?: { message_id: number };
    };
    const messageId = json.result?.message_id;
    return messageId
      ? { ok: true, messageId: String(messageId) }
      : { ok: false, error: 'no_message_id', status: res.statusCode };
  }
  log.warn({ status: res.statusCode, text }, 'telegram send failed');
  return { ok: false, error: text, status: res.statusCode };
}

export async function sendText(
  chatId: string,
  body: string,
): Promise<TelegramSendResult> {
  const cfg = loadConfig();
  if (!telegramEnabled(cfg) || !cfg.TELEGRAM_BOT_TOKEN) {
    return { ok: false, error: 'telegram_not_configured', status: 0 };
  }
  const res = await request(apiUrl(cfg.TELEGRAM_BOT_TOKEN, 'sendMessage'), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: body.slice(0, 4096),
      disable_web_page_preview: true,
    }),
  });
  const text = await res.body.text();
  if (res.statusCode >= 200 && res.statusCode < 300) {
    const json = JSON.parse(text) as {
      ok: boolean;
      result?: { message_id: number };
    };
    const messageId = json.result?.message_id;
    return messageId
      ? { ok: true, messageId: String(messageId) }
      : { ok: false, error: 'no_message_id', status: res.statusCode };
  }
  return { ok: false, error: text, status: res.statusCode };
}

/** Bevestigt een knop-druk zodat de loading-spinner in Telegram verdwijnt. */
export async function answerCallbackQuery(
  callbackQueryId: string,
  text?: string,
): Promise<void> {
  const cfg = loadConfig();
  if (!cfg.TELEGRAM_BOT_TOKEN) return;
  try {
    await request(apiUrl(cfg.TELEGRAM_BOT_TOKEN, 'answerCallbackQuery'), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        callback_query_id: callbackQueryId,
        text: text?.slice(0, 200),
      }),
    });
  } catch (err) {
    log.warn({ err }, 'answerCallbackQuery failed');
  }
}

/** Constant-time vergelijking van de Telegram webhook secret-token header. */
export function verifyTelegramSecret(headerValue: string | undefined): boolean {
  const cfg = loadConfig();
  if (!cfg.TELEGRAM_WEBHOOK_SECRET || !headerValue) return false;
  const a = Buffer.from(cfg.TELEGRAM_WEBHOOK_SECRET);
  const b = Buffer.from(headerValue);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
