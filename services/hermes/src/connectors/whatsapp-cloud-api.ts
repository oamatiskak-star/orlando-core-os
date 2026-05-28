import { createHmac, timingSafeEqual } from 'node:crypto';
import { request } from 'undici';
import { loadConfig, whatsappEnabled } from '../core/config.js';
import { childLogger } from '../core/logger.js';

const log = childLogger({ component: 'whatsapp-cloud-api' });

export type InteractiveListOption = {
  key: string;
  label: string;
  description?: string;
};

export type InteractiveListMessage = {
  to: string;
  header: string;
  body: string;
  footer?: string;
  button_label: string;
  options: InteractiveListOption[];
};

export type SendResult =
  | { ok: true; messageId: string }
  | { ok: false; error: string; status: number };

const GRAPH = 'https://graph.facebook.com/v20.0';

export async function sendInteractiveList(
  msg: InteractiveListMessage,
): Promise<SendResult> {
  const cfg = loadConfig();
  if (!whatsappEnabled(cfg)) {
    return { ok: false, error: 'whatsapp_not_configured', status: 0 };
  }
  if (msg.options.length === 0 || msg.options.length > 10) {
    return { ok: false, error: 'options_count_invalid', status: 400 };
  }

  const url = `${GRAPH}/${cfg.WHATSAPP_PHONE_NUMBER_ID}/messages`;
  const payload = {
    messaging_product: 'whatsapp',
    to: msg.to,
    type: 'interactive',
    interactive: {
      type: 'list',
      header: { type: 'text', text: msg.header.slice(0, 60) },
      body: { text: msg.body.slice(0, 1024) },
      footer: msg.footer ? { text: msg.footer.slice(0, 60) } : undefined,
      action: {
        button: msg.button_label.slice(0, 20),
        sections: [
          {
            title: 'Acties',
            rows: msg.options.map((o) => ({
              id: o.key,
              title: o.label.slice(0, 24),
              description: o.description?.slice(0, 72),
            })),
          },
        ],
      },
    },
  };

  const res = await request(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${cfg.WHATSAPP_CLOUD_API_TOKEN}`,
    },
    body: JSON.stringify(payload),
  });

  const text = await res.body.text();
  if (res.statusCode >= 200 && res.statusCode < 300) {
    const json = JSON.parse(text) as { messages?: Array<{ id: string }> };
    const messageId = json.messages?.[0]?.id ?? '';
    return messageId
      ? { ok: true, messageId }
      : { ok: false, error: 'no_message_id', status: res.statusCode };
  }
  log.warn({ status: res.statusCode, text }, 'whatsapp send failed');
  return { ok: false, error: text, status: res.statusCode };
}

export async function sendText(to: string, body: string): Promise<SendResult> {
  const cfg = loadConfig();
  if (!whatsappEnabled(cfg)) {
    return { ok: false, error: 'whatsapp_not_configured', status: 0 };
  }
  const url = `${GRAPH}/${cfg.WHATSAPP_PHONE_NUMBER_ID}/messages`;
  const res = await request(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${cfg.WHATSAPP_CLOUD_API_TOKEN}`,
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body: body.slice(0, 4096) },
    }),
  });
  const text = await res.body.text();
  if (res.statusCode >= 200 && res.statusCode < 300) {
    const json = JSON.parse(text) as { messages?: Array<{ id: string }> };
    const messageId = json.messages?.[0]?.id ?? '';
    return messageId
      ? { ok: true, messageId }
      : { ok: false, error: 'no_message_id', status: res.statusCode };
  }
  return { ok: false, error: text, status: res.statusCode };
}

export function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | undefined,
): boolean {
  const cfg = loadConfig();
  if (!cfg.WHATSAPP_APP_SECRET || !signatureHeader) return false;
  const expected =
    'sha256=' +
    createHmac('sha256', cfg.WHATSAPP_APP_SECRET).update(rawBody).digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(signatureHeader);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
