# Hermes — Telegram Escalation Bridge (setup)

Gratis, verificatie-vrij alternatief voor de Meta WhatsApp Cloud API. Telegram-bots
geven inline-keyboard knoppen → een gelijkwaardig actie-menu, zonder Facebook-gedoe.

> De escalatie-pipeline (`hermes.escalations`) is kanaal-agnostisch. De Telegram-bridge
> draait náást de WhatsApp-bridge; welk kanaal verstuurt bepaalt `HERMES_ESCALATION_CHANNEL`.
> Houd "de spam stil": gebruik een **aparte, dedicated bot + eigen chat** alleen voor
> critical/high — los van de bestaande service-bots.

## 1. Bot aanmaken (≈3 min, geen verificatie)

1. Telegram → `@BotFather` → `/newbot` → naam bv. "Hermes Escalations" → kopieer de
   `TELEGRAM_BOT_TOKEN`.
2. Start een chat met je nieuwe bot, stuur één bericht.
3. Haal je `chat_id` op:
   ```bash
   curl -s "https://api.telegram.org/bot<TOKEN>/getUpdates" | jq '.result[].message.chat.id'
   ```
4. Verzin een webhook secret-token (willekeurig): `openssl rand -hex 32`.

## 2. Env op de Render-service `orlando-hermes`

```
TELEGRAM_BOT_TOKEN        = <token van BotFather>
TELEGRAM_WEBHOOK_SECRET   = <openssl rand -hex 32>
HERMES_ESCALATION_CHANNEL = telegram      # of 'both' tijdens de overgang van WhatsApp
```

Auto-detect: als `HERMES_ESCALATION_CHANNEL` leeg is en `TELEGRAM_BOT_TOKEN` +
`TELEGRAM_WEBHOOK_SECRET` gezet zijn, kiest Hermes automatisch Telegram. Zonder Telegram-env
blijft het gedrag ongewijzigd (WhatsApp-only) — volledig backwards-compatible.

## 3. Webhook registreren bij Telegram

Wijst Telegram naar de Hermes HTTP-server (route zit in `boot.ts`):

```bash
curl -s "https://api.telegram.org/bot<TOKEN>/setWebhook" \
  -H "content-type: application/json" \
  -d '{
    "url": "https://orlando-hermes.onrender.com/hermes/telegram/webhook",
    "secret_token": "<TELEGRAM_WEBHOOK_SECRET>",
    "allowed_updates": ["callback_query"]
  }'
```

Verifieer met `getWebhookInfo`. Telegram stuurt de secret mee als header
`X-Telegram-Bot-Api-Secret-Token`; Hermes weigert (401) zonder match.

## 4. Recipient toevoegen (migratie 108)

`chat_id` is `UNIQUE` → idempotente upsert. Vul je chat_id in.

```sql
insert into hermes.telegram_recipients
  (chat_id,          display_name, receive_severities,        active)
values
  ('<JOUW_CHAT_ID>', 'Orlando',    array['critical','high'],  true)
on conflict (chat_id) do update set
  display_name       = excluded.display_name,
  receive_severities = excluded.receive_severities,
  active             = excluded.active,
  updated_at         = now();
```

Defaults: `timezone='Europe/Amsterdam'`, `quiet_hours=23:00–07:00`. Quiet-hours worden
gebypassed bij `severity='critical' AND revenue_or_compliance_impact=true`.

## 5. Smoke-test

```sql
insert into hermes.escalations
  (company_slug, os_label, severity, alert_kind, title, diagnosis,
   revenue_or_compliance_impact, options)
values
  ('osm', 'Orlando Core OS', 'critical', 'smoke_test',
   'Hermes Telegram smoke-test',
   'Test of de telegram-bridge end-to-end een inline-keyboard actie-menu aflevert.',
   true,
   '[
      {"key":"quick_fix","label":"Snelle fix"},
      {"key":"full_fix","label":"Volledige fix"},
      {"key":"ignore","label":"Negeer"},
      {"key":"cancel","label":"Annuleer"}
   ]'::jsonb);
```

Verwacht: Telegram-bericht `🚨 Orlando Core OS` met 4 inline-knoppen. Druk een knop →
`hermes.escalations` gaat `sent → answered`, `user_choice` + `whatsapp_message_id`
(= Telegram message_id) gevuld, en je krijgt "✓ Actie gestart: …".

```sql
select status, whatsapp_message_id, user_choice, user_choice_at
from hermes.escalations where alert_kind='smoke_test'
order by created_at desc limit 1;
```

## Architectuur (wat dit PR toevoegt)

- `supabase/migrations/108_hermes_telegram_bridge.sql` — `hermes.telegram_recipients`,
  `hermes.telegram_inbox`, `hermes.is_within_quiet_hours_tg`, RLS + grants. **Additief**:
  raakt de WhatsApp-tabellen niet aan.
- `src/connectors/telegram-bot.ts` — `sendInteractiveList` (inline keyboard), `sendText`,
  `answerCallbackQuery`, `verifyTelegramSecret`.
- `src/agents/telegram-bridge.ts` — spiegelt de whatsapp-bridge (claim → send → reply),
  leest `telegram_recipients`, quiet-hours via `is_within_quiet_hours_tg`.
- `src/core/config.ts` — `TELEGRAM_*` env + `telegramEnabled()` + `activeEscalationChannels()`.
- `src/core/boot.ts` — kanaal-gestuurde agent-registratie + `POST /hermes/telegram/webhook`.

Het provider-message-id wordt opgeslagen in de bestaande kolom `escalations.whatsapp_message_id`
(kanaal-agnostische naam uit mig 106). Aanname: één actieve recipient (Orlando) — message_id
is uniek binnen die chat.
