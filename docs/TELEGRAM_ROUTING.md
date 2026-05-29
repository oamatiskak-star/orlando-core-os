# Telegram alert-routing

Alerts zijn opgesplitst in **4 domein-bots** zodat elk domein zijn eigen, stille kanaal
heeft. Routing is **env-gedreven**: elke service leest `TELEGRAM_BOT_TOKEN` +
`TELEGRAM_CHAT_ID` uit zijn eigen omgeving. Door per service een ander bot-token te zetten,
landt de melding in de juiste bot.

> **Tokens staan NIET in dit bestand.** Ze leven uitsluitend als env-secret op de
> Render/PM2-services en in je eigen secret-manager. Bot-tokens = volledige controle over
> de bot; bij twijfel `@BotFather` → `/revoke` → nieuw token.

## De 4 bots

| Bot (username) | Bot-id | Domein |
|---|---|---|
| `YT_Agent_OS_Bot` | 8697610741 | Media Holding (YouTube) |
| `Os_Vastgoed_Bot` | 8987212573 | Verzamelaar / vastgoed |
| `Orlando_OS_Bot` | 8132376579 | Systeem + Dashboard (Orlando Core OS) + **Hermes** |
| `Aquier_Ops_Bot` | 8670503708 | Alles Aquier |

## chat_id

In een **privéchat met een bot** is de `chat_id` gelijk aan de **Telegram user-id van de
ontvanger**. Voor Orlando is dat **`7583931210`** — **dezelfde voor alle vier de bots**.

> ⚠️ De bot-id (kolom hierboven) is **géén** chat_id. Een bot kan niet naar zijn eigen id
> sturen. Gebruik altijd `7583931210`.

**Voorwaarde:** stuur eenmalig `/start` (of een bericht) naar elke nieuwe bot vanuit je
Telegram, anders mag de bot je niet DM'en.

## Env-mapping per service

Zet op elke service: `TELEGRAM_BOT_TOKEN` = het juiste bot-token, `TELEGRAM_CHAT_ID` = `7583931210`.

| Service | Bot | Bijzonderheid |
|---|---|---|
| `youtube-engine` | YT Agent | — |
| `monitoring-agent` (youtube-channel-analyst) | YT Agent | — |
| `local-watchdog` | Orlando OS | + `TELEGRAM_MIN_SEVERITY` (zie onder) |
| `watchdog-engine` | Orlando OS | + `TELEGRAM_MIN_SEVERITY` |
| `planning-engine` (+ sync-coordinator) | Orlando OS | — |
| frontend `routines/incident-relay` | Orlando OS | env op Vercel |
| `checkout-auditor` | Aquier Ops | + `TELEGRAM_MIN_SEVERITY` |
| `orlando-hermes` (Hermes) | Orlando OS | chat via DB-recipient, zie onder |
| Verzamelaar (Os Vastgoed) | Os Vastgoed | **service/repo nog te bevestigen — niet in orlando-core-os** |

## Anti-spam drempel

De vier alert-services respecteren `TELEGRAM_MIN_SEVERITY` (default `warning`):
- `warning` (default): dempt info-ruis (boots, recovery, dry-runs, "audit ok",
  upload-success/started, slot-ingepland, auto-planner). error + critical komen door.
- `error`: onderdrukt ook waarschuwingen (retries, drempels).

Tunen gaat puur via env — geen redeploy van code nodig.

## Hermes (Orlando OS) — afwijkend

De Hermes telegram-bridge gebruikt de DB als bron voor recipients, niet `TELEGRAM_CHAT_ID`.

Env op `orlando-hermes`:
```
TELEGRAM_BOT_TOKEN        = <Orlando_OS_Bot token>
TELEGRAM_WEBHOOK_SECRET   = <openssl rand -hex 32>
HERMES_ESCALATION_CHANNEL = telegram
```
Recipient (chat) in de DB:
```sql
insert into hermes.telegram_recipients (chat_id, display_name, receive_severities, active)
values ('7583931210', 'Orlando', array['critical','high'], true)
on conflict (chat_id) do update set active = excluded.active, updated_at = now();
```
Volledige setup (BotFather → setWebhook → smoke-test): `services/hermes/TELEGRAM_SETUP.md`.

## Open punt — Verzamelaar

"Os Vastgoed Bot = Verzamelaar", maar er is **geen verzamelaar-service in
orlando-core-os**. De verzamelaar draait onder Aquier (`aquier.com/verzamelaar`,
waarschijnlijk in de `vastgoed_core`-repo). Te beslissen: welke service/repo gebruikt de
Os Vastgoed bot, en blijft die los van Aquier Ops.
