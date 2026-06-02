---
name: render-ops
description: >
  Render-fleet runbook voor Orlando Core OS. Gebruik bij vragen over Render-services die
  down zijn, failed deploys (build_failed/update_failed), de watchdog (orlando-watchdog),
  Hermes-alerts, of "waarom kreeg ik geen melding". Bevat diagnose-stappen, fix-runbook en
  de exacte tabellen/functies.
---

# Render-ops runbook (Orlando Core OS)

Single source of truth voor de Render-fleet, de watchdog en het Hermes-alertpad.
Supabase-project: `shaunumewswpxhmgbtvv`. Repo: `Code/orlando-core-os`.

## Architectuur in één blik
- **orlando-watchdog** (Render web, `watchdog-engine/`) checkt elke 60s de hele fleet via de
  Render API. Het kijkt naar **deploy-status**, plus org-checks (http-ping/heartbeat/queue/
  data-freshness/cron-lateness) die naar Supabase schrijven.
- Failures → tabel `infra_watchdog_incidents` + events in `infra_watchdog_events`.
- Alerts lopen via **Hermes**: `hermes_notify_now()` pusht error/critical DIRECT naar Telegram;
  `hermes_supervisor()` (cron, 5 min) is de backstop voor critical alerts.

## Wat de watchdog WEL en NIET kan
- WEL: failed deploy detecteren, redeploy/restart bij transient build-fouten, direct alerten,
  incident openen voor mens/Claude.
- NIET: een **kapotte commit** repareren. `update_failed`/`canceled` = code/config stuk →
  opnieuw deployen van dezelfde commit is zinloos. Fix = nieuwe commit naar main.
- Blinde vlek: runtime-crash ná een geslaagde deploy houdt deploy-status `live` → dekking
  daarvoor zit in de org-checks (heartbeat/http-ping), niet in de deploy-check.

## Diagnose — "welke services zijn down en waarom"
```sql
select service_name, service_type, incident_kind, failure_kind, attempts_made,
       deploy_id, opened_at, left(coalesce(failure_summary,''),120) as summary
from infra_watchdog_incidents
where resolved_at is null
order by opened_at desc;
```
- `incident_kind='deploy_failure'` = echte Render-service down (build/deploy stuk).
- `incident_kind='check_failure'` = cron-lateness / data-freshness / heartbeat (vaak Vercel-crons
  of stille data, geen Render-service per se).

Live fleet-status zonder API-key (watchdog heeft de key server-side):
```bash
curl -s https://orlando-watchdog.onrender.com/health        | jq    # tickt hij nog? lastTickError?
curl -s https://orlando-watchdog.onrender.com/live-services  | jq    # actieve services
```

## Fix-runbook bij een failed deploy
1. Identificeer service + `deploy_id` (query hierboven). Lees `logs_tail` uit het incident:
   ```sql
   select logs_tail, proposed_actions from infra_watchdog_incidents
   where deploy_id = '<dep-...>';
   ```
2. Classificeer de fout in de log-tail:
   - `error TS####` / `Type error:` → TypeScript-fout. Patch de bron, push naar main.
   - missende env-var → zet env in Render dashboard, redeploy.
   - dependency/install-fout → lockfile/Node-versie checken.
3. Fix in een branch (projectregel: **branch vóór commit, niet auto-mergen naar prod**),
   commit-stijl `feat(scope): NL beschrijving`. Render auto-deployt op main.
4. Her-arm de watchdog door het incident te sluiten:
   ```sql
   update infra_watchdog_incidents set status='resolved', resolved_at=now()
   where deploy_id='<dep-...>';
   ```

## Alert-pad testen (zonder spam)
```sql
select public.hermes_notify_now('watchdog:selftest','critical','watchdog',
  'Test','Negeren', null);
select public.hermes_resolve('watchdog:selftest');
```
`hermes_config` moet `telegram_bot_token` + `telegram_chat_id` bevatten, anders geen push.

## Strakheid-instellingen (env op orlando-watchdog)
- `CHECK_INTERVAL_MS` (default 60000) — checkfrequentie.
- `MAX_RECOVERY_ATTEMPTS` (default 2) — redeploy-pogingen vóór escalatie. `update_failed`/
  `canceled` krijgen 0 pogingen (kapotte commit) en escaleren direct.
- `WATCHDOG_RECENT_FAILURE_MINUTES` (default 180) — failures ouder dan dit worden alleen
  gelogd, niet auto-hersteld. Verlaag voor strakker; verhoog tegen retry-spam.
- `TELEGRAM_MIN_SEVERITY` (default warning) — drempel; error/critical pushen altijd direct.

## Belangrijke bestanden
- `watchdog-engine/src/recovery.ts` — fleet-check + escalatie-beleid.
- `watchdog-engine/src/telegram.ts` — routing naar Hermes (direct vs stil loggen).
- `supabase/migrations/125_hermes_notify_now.sql` — directe alert-functie.
- `render.yaml` — fleet-definitie.
