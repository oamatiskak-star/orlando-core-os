# Hermes Service

Additieve orchestration / memory / watchdog laag voor Orlando Core OS.

## Status

Draft skeleton (Fase 2 hoofdplan). 1 subagent geïmplementeerd: WhatsApp Escalation Bridge (#16). Andere 14 subagents komen in volgende iteraties.

## Architectuurregels

- **Observer-first.** Hermes raakt geen bestaande tabellen aan buiten lezen.
- **Eigen schema.** Alle schrijfacties gaan naar `hermes.*` (zie migraties 104–106).
- **Geen vervanging.** AO Executor, Routines Control Center, Telegram-services blijven canonical.

## Env vars (verplicht)

```
SUPABASE_URL=https://shaunumewswpxhmgbtvv.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...        # gerouteerd, zie key-rotation
HERMES_PORT=8787
HERMES_LOG_LEVEL=info
HERMES_ENV=local|staging|production
```

## Env vars (optioneel — WhatsApp)

Zonder deze blijft de bridge inactief; service start nog steeds.

```
WHATSAPP_CLOUD_API_TOKEN=...
WHATSAPP_PHONE_NUMBER_ID=...
WHATSAPP_VERIFY_TOKEN=...
WHATSAPP_APP_SECRET=...
```

## Lokaal draaien

```bash
pnpm install
pnpm dev
curl http://localhost:8787/healthz
```

## Docker

```bash
docker build -t hermes:dev .
docker run --rm -p 8787:8787 --env-file .env hermes:dev
```

## Endpoints

- `GET  /healthz` — agent-status + WhatsApp-config
- `GET  /hermes/whatsapp/webhook` — Meta verification challenge
- `POST /hermes/whatsapp/webhook` — Meta callbacks (HMAC verified)

## Volgende stappen

Zie Build Tracker sectie `hermes-integration` voor de fasering. Direct hierna: subagents #4 (Executor Supervisor) en #1 (Scheduler Supervisor) toevoegen, dan `/dashboard/hermes` frontend.
