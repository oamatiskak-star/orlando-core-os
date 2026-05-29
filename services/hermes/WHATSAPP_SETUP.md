# Hermes — Escalatiekanaal setup (WhatsApp + alternatief)

Hermes stuurt **alleen kritieke escalaties** (`severity in (critical, high)`, ná falende
auto-recovery) naar Orlando met een interactief actie-menu. Telegram blijft de bestaande
4 services bedienen voor low/medium ruis; dit kanaal moet **stil** zijn tenzij een mens
nodig is.

Alle SQL hieronder is geverifieerd tegen het live schema (`hermes`) op project
`shaunumewswpxhmgbtvv` en tegen de bridge-code (`src/agents/whatsapp-bridge.ts` +
`src/connectors/whatsapp-cloud-api.ts`). Niets is automatisch uitgevoerd.

---

## Optie A — Meta WhatsApp Cloud API (oorspronkelijk plan)

Gratis tier: ~1000 conversaties/maand. **Nadeel:** Meta Business + nummer-verificatie is
de bottleneck (open gate).

### 1. Recipient toevoegen

`phone_e164` is `UNIQUE` → idempotente upsert. Vul je nummer in E.164 in (landcode, geen
spaties/streepjes, bv. `+31612345678`).

```sql
insert into hermes.whatsapp_recipients
  (phone_e164,        display_name, receive_severities,            active)
values
  ('+31XXXXXXXXX',    'Orlando',    array['critical','high'],      true)
on conflict (phone_e164) do update set
  display_name       = excluded.display_name,
  receive_severities = excluded.receive_severities,
  active             = excluded.active,
  updated_at         = now();
```

Defaults (niets aan te doen): `timezone='Europe/Amsterdam'`, `quiet_hours=23:00–07:00`,
`receive_severities={critical,high}`, `active=false` (hierboven expliciet op `true` gezet).

### 2. Meta Cloud API-credentials (env op Render-service `orlando-hermes`)

De recipient-rij alleen is niet genoeg. De bridge heeft de Cloud API-credentials nodig:

- `WHATSAPP_PHONE_NUMBER_ID`
- `WHATSAPP_ACCESS_TOKEN`  (permanent system-user token)
- `WHATSAPP_WABA_ID`
- (+ Meta-nummer geverifieerd in WhatsApp Business / Cloud API)

Zolang dit ontbreekt staat de bridge stil (`whatsappEnabled()` → false).

### 3. End-to-end smoke-test

De bridge pollt op `status='pending'` (de default — dus níet zetten). Quiet-hours worden
**alleen** gebypassed bij `severity='critical' AND revenue_or_compliance_impact=true`;
daarom staat die hieronder op `true` zodat de test altijd afgaat.

`options` is verplicht (jsonb), vorm `{key,label,description?}`, max 10 opties, `label` ≤24 tekens.

```sql
insert into hermes.escalations
  (company_slug, os_label, severity, alert_kind, title, diagnosis,
   revenue_or_compliance_impact, options)
values
  ('osm',
   'Orlando Core OS',
   'critical',
   'smoke_test',
   'Hermes WhatsApp smoke-test',
   'Test of de bridge end-to-end een interactief actie-menu aflevert.',
   true,
   '[
      {"key":"quick_fix","label":"Snelle fix","action":"quick_fix"},
      {"key":"full_fix","label":"Volledige fix","action":"full_fix"},
      {"key":"ignore","label":"Negeer","action":"ignore"},
      {"key":"cancel","label":"Annuleer","action":"cancel"}
   ]'::jsonb);
```

Verwacht: WhatsApp-bericht met header `🚨 Orlando Core OS`, body = title+diagnosis, knop
"Kies actie" met 4 opties. Bij antwoord matcht de bridge op `key`, schrijft `user_choice` +
`whatsapp_message_id` terug en bevestigt met "✓ Actie gestart: …".

### 4. Verifieer

```sql
select status, whatsapp_message_id, user_choice, sent_at
from hermes.escalations
where alert_kind = 'smoke_test'
order by created_at desc limit 1;
-- pending → sending → sent (na ontvangst) → answered/actioned (na reply)
```

---

## Optie B — Telegram-escalatiebot (AANBEVOLEN als Meta blijft tegenwerken)

**Geen business-verificatie, geen nummer-koppeling, gratis, direct.** Telegram-bots
ondersteunen **inline keyboard-knoppen** — een 1-op-1 vervanging van het WhatsApp
interactieve actie-menu.

> Het "Telegram is spammy"-bezwaar gold voor de 4 bestaande services in één chat. Dit lost
> je op met een **aparte, dedicated escalatie-bot + eigen chat** die uitsluitend
> critical/high voert. Stil tenzij een mens nodig is — exact de oorspronkelijke eis.

### Setup (≈5 min, geen verificatie)

1. Open Telegram → `@BotFather` → `/newbot` → naam bv. "Hermes Escalations" → krijg
   `TELEGRAM_BOT_TOKEN`.
2. Start een chat met de nieuwe bot, stuur één bericht, haal je `chat_id` op via
   `https://api.telegram.org/bot<token>/getUpdates`.
3. Env op `orlando-hermes` (Render): `HERMES_TG_BOT_TOKEN`, `HERMES_TG_CHAT_ID`.

### Wat er gebouwd moet worden (connector-swap, geen redesign)

Het `hermes`-schema is kanaal-agnostisch genoeg; alleen de connector + poll-agent wisselen:

- Nieuwe connector `src/connectors/telegram-bot.ts` met dezelfde interface als
  `sendInteractiveList` → mapt `options` naar Telegram `inline_keyboard`
  (`callback_data = option.key`).
- De button-press komt binnen als Telegram `callback_query` op een webhook
  (`/api/hermes/telegram/webhook` in Vercel of een Render-route) → schrijf `user_choice` +
  `whatsapp_message_id` (hergebruik de kolom voor het Telegram message-id) terug op
  `hermes.escalations`, net als de WhatsApp-bridge nu doet.
- Recipient: hergebruik `hermes.whatsapp_recipients` (zet `phone_e164` op de `chat_id`) of
  voeg een kolom `channel` toe — minimale migratie.

De escalatie-INSERT (sectie A.3) blijft **identiek** — de DB is het contract; alleen het
afleverkanaal verandert.

---

## Optie C — ntfy.sh (lichtste, al deels in de OSM-stack)

Gratis, open-source push naar de ntfy-app (zie `OSM_NTFY_TOPIC` in de OSM-setup). Geen
account/verificatie. Ondersteunt **actie-knoppen** via HTTP-actions (knop → roept een
Hermes-webhook aan). Eenrichtings-alert met tap-to-action; minder rijk dan een echt
interactief menu, maar nul setup-frictie en al beschikbaar.

---

## Aanbeveling

| | Verificatie | Interactief menu | Setup | Kosten |
|---|---|---|---|---|
| **A. Meta WhatsApp** | ⚠️ zwaar (bottleneck) | ✅ ja | hoog | gratis tot 1000/mnd |
| **B. Telegram-bot** | ✅ geen | ✅ inline keyboard | laag (~5 min + connector) | gratis |
| **C. ntfy.sh** | ✅ geen | 🟡 HTTP-knoppen | zeer laag | gratis |

**Advies:** ga voor **Optie B (dedicated Telegram-escalatiebot)** — dichtstbijzijnde
gelijkwaardige vervanging van het WhatsApp-menu, zonder Meta-gedoe. Het is een
connector-swap bovenop de bestaande, geverifieerde escalatie-pipeline, geen herontwerp.
