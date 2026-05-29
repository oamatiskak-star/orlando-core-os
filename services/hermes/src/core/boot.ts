import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import {
  loadConfig,
  whatsappEnabled,
  telegramEnabled,
  activeEscalationChannels,
} from './config.js';
import { logger } from './logger.js';
import { supabase } from '../connectors/supabase.js';
import { verifyWebhookSignature } from '../connectors/whatsapp-cloud-api.js';
import {
  verifyTelegramSecret,
  answerCallbackQuery,
} from '../connectors/telegram-bot.js';
import { WhatsAppBridgeAgent } from '../agents/whatsapp-bridge.js';
import { TelegramBridgeAgent } from '../agents/telegram-bridge.js';
import { ScannerAgent } from '../agents/scanner-agent.js';
import type { Subagent } from '../agents/base.js';

const cfg = loadConfig();
const agents: Subagent[] = [];
const channels = activeEscalationChannels(cfg);

export async function boot(): Promise<void> {
  logger.info({ env: cfg.HERMES_ENV, port: cfg.HERMES_PORT }, 'hermes booting');

  await registerAgents();
  startTickLoop();
  startHttpServer();

  logger.info('hermes ready');
}

async function registerAgents(): Promise<void> {
  logger.info({ channels: [...channels] }, 'active escalation channels');

  if (channels.has('whatsapp')) {
    const wa = new WhatsAppBridgeAgent();
    try {
      await wa.register();
    } catch (err) {
      logger.error({ err, agent: wa.def.name }, 'subagent register failed — degraded mode');
    }
    agents.push(wa);  // push regardless; tick() en healthcheck() hanteren null-id
  }

  if (channels.has('telegram')) {
    const tg = new TelegramBridgeAgent();
    try {
      await tg.register();
    } catch (err) {
      logger.error({ err, agent: tg.def.name }, 'subagent register failed — degraded mode');
    }
    agents.push(tg);
  }

  const scanner = new ScannerAgent();
  try {
    await scanner.register();
  } catch (err) {
    logger.error({ err, agent: scanner.def.name }, 'scanner register failed — degraded mode');
  }
  agents.push(scanner);
}

function startTickLoop(): void {
  const intervalMs = 5_000;
  let running = false;

  setInterval(async () => {
    if (running) return;
    running = true;
    try {
      for (const a of agents) {
        try {
          await a.tick();
        } catch (err) {
          logger.error({ err, agent: a.def.name }, 'tick failed');
        }
      }
    } finally {
      running = false;
    }
  }, intervalMs);
}

function startHttpServer(): void {
  const server = createServer((req, res) => {
    void handleRequest(req, res).catch((err) => {
      logger.error({ err, url: req.url }, 'request handler crashed');
      if (!res.headersSent) {
        res.statusCode = 500;
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify({ error: 'internal' }));
      }
    });
  });
  server.listen(cfg.HERMES_PORT, '0.0.0.0', () => {
    logger.info({ port: cfg.HERMES_PORT }, 'http server listening');
  });
}

async function handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? '/', `http://localhost:${cfg.HERMES_PORT}`);
  const path = url.pathname;
  const method = req.method ?? 'GET';

  if (path === '/healthz' && method === 'GET') {
    res.statusCode = 200;
    res.setHeader('content-type', 'application/json');
    res.end(
      JSON.stringify({
        status: 'ok',
        env: cfg.HERMES_ENV,
        agents: agents.map((a) => a.def.name),
        channels: [...channels],
        whatsapp: whatsappEnabled(cfg) ? 'configured' : 'disabled',
        telegram: telegramEnabled(cfg) ? 'configured' : 'disabled',
      }),
    );
    return;
  }

  if (path === '/hermes/whatsapp/webhook' && method === 'GET') {
    // Meta verification challenge
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');
    if (mode === 'subscribe' && token === cfg.WHATSAPP_VERIFY_TOKEN && challenge) {
      res.statusCode = 200;
      res.end(challenge);
      return;
    }
    res.statusCode = 403;
    res.end('forbidden');
    return;
  }

  if (path === '/hermes/whatsapp/webhook' && method === 'POST') {
    const raw = await readBody(req);
    const sig = req.headers['x-hub-signature-256'];
    if (typeof sig !== 'string' || !verifyWebhookSignature(raw, sig)) {
      res.statusCode = 401;
      res.end('invalid_signature');
      return;
    }
    await handleWhatsappWebhook(raw);
    res.statusCode = 200;
    res.end('ok');
    return;
  }

  if (path === '/hermes/telegram/webhook' && method === 'POST') {
    const secret = req.headers['x-telegram-bot-api-secret-token'];
    if (typeof secret !== 'string' || !verifyTelegramSecret(secret)) {
      res.statusCode = 401;
      res.end('invalid_secret');
      return;
    }
    const raw = await readBody(req);
    await handleTelegramWebhook(raw);
    // Telegram verwacht altijd 200, anders blijft het de update herhalen.
    res.statusCode = 200;
    res.end('ok');
    return;
  }

  if (path === '/hermes/scan/incomplete' && method === 'GET') {
    const scanner = agents.find((a) => a.def.name === 'Hermes Scanner') as any;
    if (!scanner) {
      res.statusCode = 503;
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ error: 'scanner not available' }));
      return;
    }
    try {
      const result = await scanner.scanAllIncomplete();
      res.statusCode = 200;
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify(result));
    } catch (err) {
      logger.error({ err }, 'scan failed');
      res.statusCode = 500;
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ error: 'scan failed' }));
    }
    return;
  }

  res.statusCode = 404;
  res.end('not_found');
}

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(Buffer.from(c));
  return Buffer.concat(chunks).toString('utf8');
}

async function handleWhatsappWebhook(raw: string): Promise<void> {
  const payload = JSON.parse(raw) as {
    entry?: Array<{
      changes?: Array<{ value?: { messages?: Array<Record<string, unknown>> } }>;
    }>;
  };

  const messages =
    payload.entry?.flatMap((e) =>
      (e.changes ?? []).flatMap((c) => c.value?.messages ?? []),
    ) ?? [];

  const db = supabase();

  for (const m of messages) {
    const metaId = String(m.id ?? '');
    if (!metaId) continue;

    // Idempotency: insert in inbox, skip duplicates
    const { error: insertErr } = await db
      .from('whatsapp_inbox')
      .insert({
        meta_event_id: metaId,
        from_phone: String(m.from ?? ''),
        message_type: String(m.type ?? ''),
        body: m,
      });
    if (insertErr) {
      logger.debug({ metaId }, 'duplicate or insert failed, skipping');
      continue;
    }

    const choice = extractChoice(m);
    const contextId = extractContextId(m);
    if (!choice || !contextId) {
      await db
        .from('whatsapp_inbox')
        .update({
          processed_at: new Date().toISOString(),
          processing_error: !choice ? 'no_choice_extracted' : 'no_context_id',
        })
        .eq('meta_event_id', metaId);
      continue;
    }

    const { data: matched } = await db
      .from('escalations')
      .select('id')
      .eq('whatsapp_message_id', contextId)
      .eq('status', 'sent')
      .limit(1)
      .maybeSingle();

    if (!matched) {
      await db
        .from('whatsapp_inbox')
        .update({
          processed_at: new Date().toISOString(),
          processing_error: 'no_matching_escalation',
        })
        .eq('meta_event_id', metaId);
      continue;
    }

    const wa = agents.find((a) => a.def.name === 'whatsapp-bridge');
    if (wa) {
      await wa.onMessage('whatsapp_reply', {
        escalation_id: matched.id,
        user_choice: choice,
        reply_from_phone: String(m.from ?? ''),
      });
    }

    await db
      .from('whatsapp_inbox')
      .update({
        processed_at: new Date().toISOString(),
        matched_escalation_id: matched.id,
      })
      .eq('meta_event_id', metaId);
  }
}

function extractContextId(m: Record<string, unknown>): string | null {
  const ctx = m.context as { id?: string } | undefined;
  return ctx?.id ?? null;
}

function extractChoice(m: Record<string, unknown>): string | null {
  const type = m.type;
  if (type === 'interactive') {
    const interactive = m.interactive as { list_reply?: { id?: string } } | undefined;
    return interactive?.list_reply?.id ?? null;
  }
  if (type === 'text') {
    const text = (m.text as { body?: string } | undefined)?.body?.trim();
    if (text && /^[1-9]$|^10$/.test(text)) return text;
  }
  return null;
}

type TelegramCallbackQuery = {
  id: string;
  data?: string;
  message?: { message_id?: number; chat?: { id?: number | string } };
  from?: { id?: number | string };
};

async function handleTelegramWebhook(raw: string): Promise<void> {
  const update = JSON.parse(raw) as {
    update_id?: number;
    callback_query?: TelegramCallbackQuery;
  };

  const updateId = update.update_id;
  const cq = update.callback_query;
  // We verwerken alleen knop-drukken (inline keyboard). Vrije tekst negeren we.
  if (typeof updateId !== 'number' || !cq) return;

  const db = supabase();
  const fromChat = String(cq.message?.chat?.id ?? cq.from?.id ?? '');
  const choice = cq.data ?? null;
  const messageId =
    cq.message?.message_id != null ? String(cq.message.message_id) : null;

  // Idempotency: insert in inbox op unieke update_id, skip duplicaten.
  const { error: insertErr } = await db.from('telegram_inbox').insert({
    update_id: updateId,
    from_chat_id: fromChat,
    message_type: 'callback_query',
    body: update,
  });
  if (insertErr) {
    logger.debug({ updateId }, 'duplicate or insert failed, skipping');
    return;
  }

  // Spinner in Telegram-client direct dismissen.
  await answerCallbackQuery(cq.id);

  if (!choice || !messageId) {
    await db
      .from('telegram_inbox')
      .update({
        processed_at: new Date().toISOString(),
        processing_error: !choice ? 'no_choice' : 'no_message_id',
      })
      .eq('update_id', updateId);
    return;
  }

  const { data: matched } = await db
    .from('escalations')
    .select('id')
    .eq('whatsapp_message_id', messageId)
    .eq('status', 'sent')
    .limit(1)
    .maybeSingle();

  if (!matched) {
    await db
      .from('telegram_inbox')
      .update({
        processed_at: new Date().toISOString(),
        processing_error: 'no_matching_escalation',
      })
      .eq('update_id', updateId);
    return;
  }

  const tg = agents.find((a) => a.def.name === 'telegram-bridge');
  if (tg) {
    await tg.onMessage('telegram_reply', {
      escalation_id: matched.id,
      user_choice: choice,
      reply_from_chat: fromChat,
    });
  }

  await db
    .from('telegram_inbox')
    .update({
      processed_at: new Date().toISOString(),
      matched_escalation_id: matched.id,
    })
    .eq('update_id', updateId);
}
