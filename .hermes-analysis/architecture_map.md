# Hermes Integration — Architecture Map (Fase 1)

Datum: 2026-05-28
Bron-repo: `/Users/o.s.m.amatiskak/Documents/orlando-core-os` (read-only, git-equivalent met live `bouwproffsnederlandbv` checkout)
Supabase project: `shaunumewswpxhmgbtvv` (orlando-core-os)
Scope: bestaande architectuur die door Hermes geobserveerd of geaugmenteerd wordt. Géén Hermes-componenten — die staan in het plan.

---

## 1. Communicatie-laag (Telegram, vandaag)

Vier onafhankelijke Telegram-senders. Géén centrale router. Eigen rate-limit-cooldown per service (Map<key, timestamp>, ~1u dedup).

| Service | Pad | Bron-events | Env vars |
|---|---|---|---|
| local-watchdog | `/local-watchdog/src/telegram.ts` | PM2 procstatus, >3 restarts/session | `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` |
| watchdog-engine | `/watchdog-engine/src/telegram.ts` | Render infra (deploy fail, service down) | idem |
| checkout-auditor | `/checkout-auditor/src/lib/telegram.ts` | Aquier checkout-audit alerts | idem |
| youtube-engine | `/youtube-engine/src/lib/notifications.ts` | Upload status, daily digest 08:00 UTC | idem |

Severity-emoji-conventie: `ℹ️ info`, `⚠️ warning`, `🔴 error`, `🚨 critical`.
HTML-escape, 3500-char truncatie, 10s timeout, silent-fail (geen exception).

---

## 2. Watchdog-stack (3 lagen)

**Laag 1 — PM2/host (local-watchdog):**
Monitort 5 procs: `youtube-engine`, `video-worker-1`, `video-worker-2`, `content-factory`, `local-agent`. Auto-restart bij status ≠ `online`.

**Laag 2 — Applicatie (youtube-engine watchdog, 5-min cyclus):**
- Stuck uploads (>30 min in actief state) → auto-retry of `manual_review_required`
- Process health (PM2 + restart counts)
- Manual-review queue (1× per 4u)
- Upload/normalize/recovery queue-depth
- OAuth tokens (refresh + expiry, >2u stale = flag)
- Daily summary 08:00 UTC

**Laag 3 — Infra (mig 092):**
Tabellen: `infra_watchdog_checks`, `infra_watchdog_heartbeats`, `infra_watchdog_incidents`.
Apps self-reporten via heartbeat-upsert (local-agent, planning-engine). Consecutive failures → `infra_watchdog_incidents` row.

---

## 3. Alert-/notificatietabellen

| Tabel | Migratie | Doel |
|---|---|---|
| `executive_alerts` | 094 | C-suite realtime alerts (breakout, upload_failure, trend_explosion, …). Heeft `trg_executive_alerts_autopilot` → `autopilot_events`. |
| `cfo_risk_alerts` | — | Financiële risico's (liquiditeit, burnrate, deadlines), `is_resolved` flag |
| `osil_alerts` | 027 | Recovery/fiscale adviezen per BV |
| `mobile_notifications` | 018 | Frontend push |
| `infra_watchdog_incidents` | 092 | Render/infra + app-layer checks |
| `routine_audit_log` | 089 | Audit-trail inclusief Telegram-sends |

Trigger-chain (mig 094): `executive_alerts (critical)` → `trg_executive_alerts_autopilot` → `autopilot_events` → downstream executors. Async via `pg_net.http_post` naar `/api/routines/incident-relay`.

---

## 4. Multi-entity context (companies)

`public.companies(id uuid, name, type, slug)` + FK `company_id` (uuid, nullable) in `build_tracker`, `tasks`, `personal_account_setup`, `affiliate_revenue`. Migraties 087+088.

| Slug | Name | OS-label voor WhatsApp |
|---|---|---|
| `osm` | O.S.M. Amatiskak | OSM Advocaat OS (subset) |
| `modiwerijo` | Modiwé BV (financieel) | Modiwé Financial |
| `modiwe-media` | Modiwé Media BV | Media Holding OS |
| `modiwe-software` | Modiwé Software BV | Aquier / SterkCalc |
| `strkbeheer` | StrkBeheer BV | StrkBeheer |
| `strkbouw` | StrkBouw BV | SterkBouw |
| `bouwproffs` | Bouwproffs BV | Bouwproffs |

---

## 5. AO Executor

Pad: `/executor/`. Subprocess-based, géén claim/lease.

- Producer: `nl_produce_and_upload.py` (Claude script + MoviePy + Google API)
- Worker (v1): `workers/youtube_calendar_publisher.py`
- Daemon: `nl_queue_processor.py` (5-min polling op `youtube_upload_queue`)
- Result-write: `youtube_uploads`

**Hermes-impact:** subprocess-model heeft geen heartbeat — Hermes Executor Supervisor (subagent #4) moet observer zijn via youtube_upload_queue + youtube_uploads i.p.v. live proces-inspectie. Geen ingrijp in deze flow.

---

## 6. Realtime channels (Supabase)

Gepubliceerd (frontend luistert):
- `yt_failures_live`, `yt_queue_live`, `yt_verify_live`
- `pipeline_live`, `live_queue_monitor`, `workflow_timeline_live`
- `generated_media_live`, `recovery_dashboard_live`, `worker_registry_live`

In `supabase_realtime` publication (recent toegevoegd):
- `orchestrator_tasks`, `orchestrator_workers`, `orchestrator_events` (mig 035)
- `infra_watchdog_checks/check_runs/heartbeats` (mig 092)
- `mail_messages`, `mail_drafts` (mig 019)

**Hermes-channel:** nieuw `hermes:events` (geen overlap met bestaande naming).

---

## 7. Schedulers

**pg_cron (mig 089):**
- `routines_dispatch_cron` (`* * * * *`) → `routines_dispatch_cron_triggers()`
- `routines_health_sweep` (`*/5 * * * *`) → `routines_health_sweep()`

**local-agent (`/local-agent/src/`):**
- Entry: `index.ts` (agent_tasks poll) + `routines-runner.ts` (routine_runs poll)
- Interval: `POLL_INTERVAL_MS=5000`, heartbeat 30s, `SERVICE_HEARTBEAT_MS=60000`
- Claim: `FOR UPDATE SKIP LOCKED` op queue-tabel
- Status (uit memory 2026-05-27): infra+crons live MAAR 0 routines/0 runs — Hermes bouwt op een laag die zelf nog niets supervist.

---

## 8. Frontend `/dashboard/*` segments

30+ segments live: `account-setup`, `acquisition`, `advocaat`, `agents`, `build-tracker`, `companies`, `finance`, `holding-milestones`, `infra`, `mail`, `media-holding`, `operations`, `orchestrator`, `osm`, `personeel`, `planning`, `seo-network`, `workflows`, `youtube`, …

`/dashboard/hermes` bestaat niet → vrij voor nieuwe route. Geen overlap met `incident-*` of `escalation-*` naming.

---

## 9. Critical files voor Hermes-koppeling (observer-hooks)

1. **AO Executor producer** — `/executor/nl_produce_and_upload.py`
2. **AO Executor worker** — `/executor/workers/youtube_calendar_publisher.py`
3. **Local-agent entry** — `/local-agent/src/routines-runner.ts`
4. **Telegram send-helper (canonical)** — `/local-watchdog/src/telegram.ts`
5. **Incident-relay endpoint** — `/frontend/app/api/routines/incident-relay/route.ts`
6. **Executive alerts trigger** — `supabase/migrations/094_routines_incident_telegram.sql` (`trg_routines_incident_relay`)

---

## 10. Migratie-baseline

Recent (095–104):
- 095 watchdog_check_status_view
- 096 holding_milestones (24-milestone roadmap)
- 097 programmatic_seo_network
- 098 worker_control
- 099 account_setup_agent
- 100 affiliate_revenue_infra (payout queue)
- 101 account_setup_scaling
- 102 payouts_api_connectors
- 103 (Account Setup live-browser + Gmail-labels, per memory)
- 104 (vrij — Hermes claimt eerstvolgende slot)

**Hermes start: migratie 104** (`hermes` schema + escalations + recipients + inbox).
