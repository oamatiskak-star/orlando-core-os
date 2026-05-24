# Orlando Core OS — PROJECT_STATUS

> **Sessie protocol** (CLAUDE.md): Lees dit bestand bij elke nieuwe Claude Code sessie. Update na elke voltooide taak. Houd het herstel-blok actueel.

**Laatste update:** 2026-05-24 (sessie 6) — Organization Watchdog (app/workflow-laag) toegevoegd aan watchdog-engine + heartbeats in 3 engines en 24 Vercel cron routes. Eerdere sessie 5 (Routines & Automation Control Layer 6/6 fases LIVE) gearchiveerd.

---

## 🔴 HERSTEL HIER NA CRASH

**Sessie focus (2026-05-24, sessie 6)**: Organization Watchdog — uitbreiding op `watchdog-engine` met 5 nieuwe check types (http_ping, heartbeat, queue_depth, data_freshness, cron_lateness). Monitort nu naast Render-deploys ook alle engines, Vercel crons, verzamelaar/acquisition feeds en datafreshness.

**Wat is gedaan (sessie 6):**
- Migrations applied via MCP op project `shaunumewswpxhmgbtvv`:
  - `092_watchdog_organization`: `infra_watchdog_checks` + `infra_watchdog_check_runs` + `infra_watchdog_heartbeats` + `incidents.check_slug/incident_kind` columns
  - `093_watchdog_seed_checks`: 38 checks geseed (5 http_ping, 3 heartbeat, 24 cron_lateness, 2 queue_depth, 4 data_freshness)
  - (Migrations werden initieel als 084/085 gemaakt, hernoemd naar 092/093 nadat remote main eigen 084-091 reeks doorzette)
- `watchdog-engine/src/checks/runners/*.ts` — 5 runners
- `watchdog-engine/src/checks/runner.ts` — orchestrator met consecutive-failure escalation, info/warn/error/critical Telegram, incident upsert (host_id='organization', deploy_id='check:<slug>:<epoch>')
- `watchdog-engine/src/index.ts` — tick() roept nu na Render check + cleanup ook `runOrganizationChecks()` aan
- `watchdog-engine/package.json` — `cron-parser@^4.9.0` toegevoegd
- `watchdog-engine/heartbeat-snippet.ts` — copy-pasta helper
- Heartbeats ingebouwd: `youtube-engine` + `planning-engine` + `competitor-scanner` (interval 5min) + 24 Vercel cron routes (via `frontend/lib/watchdog/heartbeat.ts`)
- `render.yaml` toggle `WATCHDOG_ORG_CHECKS_ENABLED=true` toegevoegd

**Render env vars nog te zetten op `orlando-watchdog`:**
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- (`WATCHDOG_ORG_CHECKS_ENABLED` zit al in render.yaml)

**Hoe te testen na deploy:**
```bash
curl https://orlando-watchdog.onrender.com/health | jq
# verwacht: orgChecksEnabled: true, lastOrgTickAt: <recent ISO>
curl -X POST https://orlando-watchdog.onrender.com/check-now
```
```sql
select c.slug, r.ok, r.message, r.ran_at
from infra_watchdog_check_runs r join infra_watchdog_checks c on c.id=r.check_id
order by r.ran_at desc limit 20;
select slug, last_seen_at, status from infra_watchdog_heartbeats order by last_seen_at desc;
select check_slug, failure_summary, opened_at from infra_watchdog_incidents
where host_id='organization' and status='open' order by opened_at desc;
```

---

## 🟢 Sessie 5 archief (Routines & Automation Control Layer — ALLE 6 FASES LIVE)

**Sessie focus (2026-05-24, sessie 5)**: Enterprise Routines Control Center bouwen onder Dashboard Software → Build Tracker → Routines. Fase 1 (read-only observability) ✅ LIVE.

**Wat is gedaan deze sessie:**
- ✅ Migratie 087 (`per_entity_fundatie.sql`) en 088 (`build_tracker_seed.sql`) als idempotente files gereconstrueerd (waren via MCP applied zonder file in repo)
- ✅ Migratie **089 `routines_control_center.sql`** applied via MCP — 9 nieuwe tabellen + view + functies + pg_cron jobs:
  * `routines`, `routine_steps`, `routine_triggers`, `routine_runs`, `routine_run_steps`, `routine_approvals`, `routine_agents_map`, `routine_autopilot_config`, `routine_audit_log` (immutable via PG RULE)
  * ALTER `orchestrator_tasks` + `triggered_by_routine_run_id` column
  * VIEW `v_system_health` — unions van acq_agent_registry + executive_agents + infra_watchdog_events (<1h) + orchestrator queue depth + routine_runs counts (<24h)
  * Functies `routines_dispatch_cron_triggers()` + `routines_health_sweep()` (security definer)
  * pg_cron jobs `routines_dispatch_cron` (`* * * * *`) en `routines_health_sweep` (`*/5 * * * *`)
  * RLS enabled met `service_role` full access + `authenticated` read-only
- ✅ Frontend Fase 1 routes onder `/dashboard/build-tracker/routines/`:
  * `layout.tsx` — sub-nav met 4 actieve + 6 toekomstige routes (greyed met fase-label)
  * `page.tsx` — Routines hub: 5 KPI tiles (active routines/runs/paused/agents/watchdog) + per-company routine list
  * `live/page.tsx` — Live Operations: active runs + orchestrator queue per executor + recente runs (24u)
  * `agents/page.tsx` — System Health: alle bronnen uit v_system_health gegroepeerd (acq/executive/watchdog/orchestrator/routines)
  * `logs/page.tsx` — Immutable audit log met filter op action+actor + paginatie
- ✅ Shared lib: `lib/routines/types.ts` + `lib/routines/badges.tsx` (RoutineStatusBadge / RunStatusBadge / HealthStatusBadge)
- ✅ `nav-config.ts` uitgebreid met 4 modules + "Routines Control" sectie in ALLE 7 COMPANY_NAVs (osm, modiwerijo, modiwe-media, modiwe-software, strkbeheer, strkbouw, bouwproffs)
- ✅ Type-check pass (tsc --noEmit, exit 0)
- ✅ Verificatie via MCP: `select source, count(*) from v_system_health group by source` → acq:9, executive:6, orchestrator:12 (live data, no mocks)

**Fase 2 toegevoegd in deze sessie:**
- ✅ Server actions `actions.ts` — createRoutine, updateRoutine, addStep, setTrigger, runRoutineNow, pauseRoutine, resumeRoutine, cancelRun + ingebouwde minimale cron-parser `computeNextCron`
- ✅ Builder route `routines/builder/page.tsx` — form-based v1 (name/kind/description/company/status)
- ✅ Detail route `routines/[id]/page.tsx` — RoutineStatusBadge header, steps list met inline AddStep form, triggers list met inline AddTrigger form, runs table met cancel-action, Run/Pause/Resume knoppen
- ✅ Layout sub-nav: Builder gemarkeerd als `live`
- ✅ Local-agent `src/routines-runner.ts` — polling claim van queued runs, step executor (action.http / action.supabase_rpc / delay / condition.jsonpath / approval / fallback), service-heartbeat in infra_watchdog_events, run-heartbeat elke 30s
- ✅ `ecosystem.config.js` — `routines-runner` PM2 app toegevoegd (env: ROUTINES_SERVICE_ID, ROUTINES_SERVICE_NAME, WATCHDOG_HOST_ID)
- ✅ TS-check: frontend EXIT=0, local-agent EXIT=0 (na `npm install`)

**Fase 3 toegevoegd in deze sessie:**
- ✅ `POST /api/routines/heartbeat` — token-protected (X-Routines-Token = env ROUTINES_TOKEN), remote runners updaten routine_runs.heartbeat_at + insert/update routine_run_steps + finaliseer status
- ✅ `POST /api/routines/webhook/[secret]` — SHA-256 hash check tegen `routine_triggers.config.secret_hash`, alleen voor enabled webhook-triggers waar routine.status='active', enqueue routine_runs + audit log
- ✅ pg_cron `routines_dispatch_cron` (* * * * *) en `routines_health_sweep` (*/5 * * * *) actief — bevestigd via `cron.job` query

**Fase 4 toegevoegd in deze sessie:**
- ✅ Server actions toegevoegd aan actions.ts: `restartRun` (zet vorige op `recovered`, enqueue retry met `parent_run_id`), `approveStep` / `denyStep` / `deferStep`, `setAutopilot` (upsert routine_autopilot_config), `ackRecommendation` / `dismissAlert`
- ✅ `/routines/recovery` — KpiStrip (failed runs / pending approvals / watchdog incidents / routine alerts) + failed+paused runs tabel met restart/cancel acties + pending approvals lijst met inline approve/deny/defer + open watchdog incidents + routine alerts met ack-knop
- ✅ `/routines/settings` — Per-routine autopilot config UI (`auto_recover` / `auto_escalate` checkboxes + `auto_approve_threshold` cents)

**Fase 5 toegevoegd in deze sessie:**
- ✅ Migratie **090 `routines_intelligence.sql`** applied — 4 detectie-functies + dispatcher:
  * `routines_detect_duplications()` — meerdere routines met zelfde HTTP URL → `executive_recommendations.action_kind='dedupe_routines'`
  * `routines_detect_bottlenecks()` — avg duration >30 min over recent 5+ runs (7d) → `executive_alerts.alert_kind='bottleneck'`
  * `routines_detect_dead_routines()` — active routine zonder runs in 14d → `executive_recommendations.action_kind='archive_dead_routine'`
  * `routines_detect_recovery_gaps()` — failed runs zonder retry binnen 24u → `executive_alerts.alert_kind='recovery_gap'`
  * `routines_intelligence_tick()` — dispatcher, logt naar `routine_audit_log` met `action='intelligence.tick'`
- ✅ pg_cron `routines_intelligence_tick` (*/15 * * * *) actief
- ✅ `/routines/intelligence` — Recommendations + Alerts lijst met ack-acties + Tick history tabel

**Fase 6 toegevoegd in deze sessie:**
- ✅ Migratie **091 `routines_analytics.sql`** applied — 3 SQL functies:
  * `routine_metrics_window(p_days)` → jsonb met total_runs, success_rate, failure_rate, avg_seconds, total_cost_cents, automation_ratio, human_intervention_ratio
  * `routine_metrics_by_day(p_days)` → per-dag breakdown (date, total_runs, completed, failed, avg_seconds)
  * `routine_top_runners(p_days, p_limit)` → top routines op runcount
- ✅ `/routines/analytics?days=7|14|30|90` — KpiStrip + Automation vs human-intervention block + per-day bar chart + Top runners tabel
- ✅ `/routines/workflows` — Grid van `kind='workflow'` routines per company met step/trigger counts + last-run-status

**Subnav layout**: alle 10 routes nu `status='live'` (geen greyed F-labels meer).

**3 pg_cron jobs actief**: `routines_dispatch_cron` (* * * * *), `routines_health_sweep` (*/5 * * * *), `routines_intelligence_tick` (*/15 * * * *)

**Open punten (pre-deploy)**:
1. `ROUTINES_TOKEN` env zetten op Vercel + local-agent `.env` (random 32-char hex)
2. Local-agent build + start: `cd local-agent && npm install && npm run build && pm2 start ecosystem.config.js --only routines-runner && pm2 save`
3. End-to-end test: maak routine via Builder → step action.http met url=https://httpbin.org/get → Run now → completed binnen 5s

**Verificatie commands:**
```bash
cd /Users/o.s.m.amatiskak/Github/orlando-core-os/frontend
npm run dev  # of nohup

# Browser:
#   /dashboard/build-tracker/routines           → KPI strip + routines lijst
#   /dashboard/build-tracker/routines/builder   → nieuw routine form
#   /dashboard/build-tracker/routines/<uuid>    → detail: steps + triggers + runs + Run now / Pause / Cancel knoppen
#   /dashboard/build-tracker/routines/live      → active + orchestrator queue + recente runs (24u)
#   /dashboard/build-tracker/routines/agents    → acq(9) + executive(6) + watchdog + orchestrator + routines
#   /dashboard/build-tracker/routines/logs      → immutable audit log met filter

# End-to-end test:
#   1. Open /builder → maak routine "Health Probe", kind=workflow, status=active
#   2. Detail-pagina: voeg step type=action met config: {"type": "http", "url": "https://httpbin.org/get"}
#   3. Klik "Run now" — routine_runs.status='queued' wordt geinsert
#   4. Local-agent draait via PM2: `pm2 start ecosystem.config.js --only routines-runner`
#   5. Within 5s: status='running' → completed met output in routine_run_steps

# Supabase MCP:
#   SELECT source, count(*) FROM v_system_health GROUP BY source;
#   SELECT jobname, schedule, active FROM cron.job WHERE jobname LIKE 'routines%';
#   SELECT status, count(*) FROM routine_runs GROUP BY status;

# API test (na ROUTINES_TOKEN gezet op Vercel + lokaal):
curl -X POST https://<vercel-url>/api/routines/heartbeat \
  -H "X-Routines-Token: $ROUTINES_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"run_id":"<uuid>","status":"heartbeat","service_id":"test-runner"}'
```

**Bekende kwesties:**
- pg_cron `routines_dispatch_cron` draait elke minuut maar doet niets tot een `routine_triggers` rij met `kind='cron'` + `next_run_at` aanwezig is (komt in Fase 2 builder).
- `oc_routines` + `oc_routine_runs` legacy tabellen onder `/dashboard/operations/routines/` blijven actief naast nieuwe tabellen — geen migratie naar nieuwe schema gepland.

---

## 🔵 Sessie 4 archief (2026-05-23) — Multi-entity dashboard refactor

> Sessie 4 was: dashboard UX-overhaul (cookie-synced per-entity landings, role-based nav, Build Tracker) + DB-swap. Migraties 086 + 087 + 088 applied (laatste twee zonder file). Volledige sessie-notities staan hieronder ongewijzigd.

## 🔴 HERSTEL HIER NA CRASH (vorige sessie)

**Sessie focus (2026-05-23, sessie 3)**: Aquier Checkout Auditor end-to-end LIVE op Render. 56-scenario matrix audit tegen aquier.com productie geleverd → 16 findings + 17 approvals in queue + €515K/mo revenue risk. ✅

**Wat is gedaan deze sessie:**
- Nieuwe Render service `orlando-checkout-auditor` (port 3008) — `checkout-auditor/` dir
- Migrations 082+083+084+085 applied (Aquier command center + checkout-audit schema + Storage bucket)
- Discovery werkt voor alle 14 landen — RSC JSON parser + tier-availability detector
- Playwright walkthrough (Chromium 148) klikt CTA, capture screenshots + HAR + network events
- Stripe restricted key + Anthropic key live op Render
- Claude Opus 4.7 auditor produceert findings + lenient Zod schema + literal JSON prompt template
- Approval bridge: HIGH/CRITICAL → automatisch `aquier_approvals` row met categorie 'storing'
- Telegram alerts + Storage bucket + Vercel cron forwarders (`/api/checkout-audit/cron/*`)
- Geo-pricing rules geïmporteerd uit `vastgoed_core.country_pricing_rules` in countries.json (PPF × MF per land)
- Pricing-finding logic vergelijkt tegen per-country expected, NIET tegen NL base

**56-scenario audit run (bd998193-7ea2-45eb-b9bb-456009fae895):**
- 56/56 scenarios passed; duration 17min; AI cost $0.29; health score 0/100
- 2 CRITICAL: anonymous checkout blocked alle landen (explorer + developer) — €185K + €180K/mo
- 8 HIGH (combined €120K/mo):
  * Developer toont €4.197 in ALLE landen+cycles (hardcoded, niet country-aware)
  * Explorer monthly €280 in 7 non-NL landen (geen match op country multipliers)
  * Locale `lang="nl"` voor alle non-NL landen
  * GB ontbreekt in `country_pricing_rules` (missing_country)
  * PT/dev/yearly: €4197 vs expected €1943 (×0.65 PPF) — +116% overcharge
  * US/dev/yearly: €4197 vs expected €3886 — +€311 overcharge
  * TH/dev/yearly: €4197 vs expected €1345 (×0.45) — **+312% overcharge**
  * VAT label "vat" (Engels) voor DE/ES/FR/IT/PT (moet MwSt/IVA/TVA)
- 4 MEDIUM/INFO: BE €199 vs €189 expected, currency labels (AED/CHF/THB/AUD/CAD) missing, US toont VAT label

**Smoking gun**: aquier.com checkout pricing logic gebruikt **NIET** de `vastgoed_core.country_pricing_rules` tabel die door PriceController/finance team wordt onderhouden. Er is een hardcoded 1.408x markup voor non-NL die ALLE per-country PPF/MF multipliers negeert.

**Recovery potentieel als alle CRITICAL+HIGH worden gefixt:** €515K/mo = **€6.2M/yr** — significant boven het Y1 €3M target.

**Phase 2 (auth flow) addendum 2026-05-23 EOD:**
- TEST_USER_EMAIL + TEST_USER_PASSWORD op Render gezet (Intelligence@aquier.com)
- STRIPE_RESTRICTED_KEY_LIVE op Render gezet (read-only, Customer/Session/Sub/Invoice/Event)
- Auth flow verified: login → /dashboard, Supabase tokens (sb-* cookies) captured, CTA → Stripe `cs_live_*`
- Safety guard verified: live mode detected → kaart NIET ingevuld (geen €199 charge)
- Stripe API observation verified: amount_total=€199 (DB exact match), mode=subscription, currency=eur
- Webhook capture verified: `checkout_session_created` ontvangen in 1097ms latency
- 4 nieuwe Phase 2 findings (1 HIGH = AI hallucination; 2 MEDIUM = REAL VAT/locale Stripe config issues; 1 LOW = 429 rate limit)
- 7 Phase 2 verification approvals geclosed als deferred (duplicaten/hallucinations)

---

## 🎯 OPEN ACTIONS (next sessions)

### Voor Orlando (besluitvorming + infra)
1. Volg de 11 approved fixes op aquier.com codebase (separate repo) — €515K/mo recovery scope:
   - Anonymous → Stripe checkout flow OF inline signup modal (€365K/mo)
   - Implement `country_pricing_rules` lookup in pricing component (€84K/mo)
   - i18n locale routing per country (€23K/mo)
   - GB row in country_pricing_rules + GBP Stripe prices (€12K/mo)
   - Per-locale VAT label (MwSt/IVA/TVA/BTW/VAT) + US no-VAT (€8K/mo)
2. Stripe configuratie (uit Phase 2 audit):
   - `automatic_tax=true` op Checkout Session create call
   - `tax_behavior='inclusive'` op explorer/developer/etc Price objects (NL B2C 21% BTW)
   - `locale='auto'` of country-derived in Checkout Session create
3. Backend: rate limit headroom op /membership pricing endpoint (429 errors detected)
4. (Optioneel later) Aquier.com test Stripe mode environment voor full pipeline validation incl. payment completion + subscription creation + invoice.paid + DB sync

### Voor toekomstige auditor sessies
1. **Daily cron monitor** — bekijk `/dashboard/aquier/audit` morgen 06:00 NL om te zien of 04:00 UTC cron run is geforceerd. Telegram alert bij findings.
2. **Multi-locale auth users** — maak DE-locale + FR-locale test accounts om geo-pricing logica per user te valideren (huidige test = NL-locale)
3. **Phase 3: WebKit/Safari support** — Docker custom image met Playwright deps preinstalled voor Safari testing
4. **Phase 3: test Stripe mode integration** — vereist aquier.com test environment OF env-toggle. Dan kan auditor full payment flow valideren (subscription created, user_memberships synced, invoice.paid event)
5. **Audit history retention** — verifieer dat de zondag 02:00 cleanup cron oude artifacts (>14 dagen) correct delete
6. **Tracking dashboard verbeteringen** — `/dashboard/aquier/audit` UI met multi-run comparison, drill-down per finding naar HAR/screenshots, fix-progress kanban per approved finding

### Voor aquier.com dev team (separate repo)
Concreet wat te coden — uit de 11 approved findings:
1. `/api/checkout/create-session` (of equivalent): allow anonymous OR pre-fill from inline modal
2. Membership page tier card component: lookup `country_pricing_rules` voor user-detected country (IP + Accept-Language), apply `purchasing_power_factor * market_factor` aan DB base price
3. `next.config.js` i18n localeDetection + `middleware.ts` voor 14 locale routes
4. SQL: `insert into vastgoed_core.country_pricing_rules ... where code = 'GB'` met PPF ~1.20
5. Pricing component: per-locale VAT label string + remove voor US
6. Stripe Checkout Session create: `automatic_tax: { enabled: true }`, `locale: <derived>`, ensure `tax_behavior` set op Price objects

---

**Recovery potentieel als alle 11 approved + 3 Stripe-config items worden gefixt:** ~€530K/mo = **€6.4M/yr** boven Y1 €3M target.

---

## 🔵 Sessie 4 update (Dashboard UX + Build Tracker + DB-swap)

**Sessie focus (2026-05-23, sessie 4)**: Dashboard UX-overhaul (cookie-synced per-entity landings, role-based nav, Build Tracker) + DB-swap fundatie. 🔄 Lokaal LIVE, Vercel + Render envs swap pending.

### Wat is gedaan deze sessie
- ✅ **DB swap diagnose**: frontend `.env.local` wees naar legacy `pmovazftwoxjopqkuuhp` (sterkbouww, dec 2025). Geswapt naar `shaunumewswpxhmgbtvv` (orlando-core-os) waar alle recente data zit. Anon + service_role keys ingevuld.
- ✅ **Migratie 086** `aquier_projects_timeline.sql` applied — 40 rijen: 26 doc-projecten (AQ-M00 t/m AQ-M25) retrospectief apr-jun 2026 + 14 execution-projecten (AQ-EX-M-1 t/m AQ-EX-M12) gefaseerd 2026-05-25 → 2027-06-30 obv `25_IMPLEMENTATION_ROADMAP/ROADMAP.md`. Phase/month_index/mrr_target/customers_target metadata per row.
- ✅ **Migratie 087** `per_entity_fundatie.sql` applied — `companies.slug` kolom (unique), 3 ontbrekende companies toegevoegd (osm/modiwe-media/modiwe-software) zodat alle 7 entities matchen. `companies.type` constraint uitgebreid met 'persoon'. `tasks.company_id` toegevoegd. `build_tracker` tabel met status enum + progress + owner + milestone + dates.
- ✅ **Migratie 088** `build_tracker_seed.sql` applied — 25 real-world builds verdeeld (osm 5, modiwerijo 2, modiwe-media 5, modiwe-software 6, strkbeheer 3, strkbouw 2, bouwproffs 2). Idempotent via unique index (company_id, name).
- ✅ **Nav-config cleanup** — `frontend/lib/nav-config.ts` 362 → 319 regels. Role-based: Juridisch/Operations Center/Mail Engine/AI&Workflow/Systeem alleen `osm`; Media Holding alleen `modiwe-media`; Aquier+Scrapers+SaaS alleen `modiwe-software`; Vastgoed deals alleen `strkbeheer`; Calculaties alleen `strkbouw`+`bouwproffs`. Sectie-counts 12-14 → 5-10 per entity.
- ✅ **FB scrapers verhuisd** — `fb_offmarket`+`fb_property` van "Scrapers & Data" naar "Aquier" sectie.
- ✅ **Verzamelaar externe link** — `aquier_verzamelaar` → `https://aquier.com/verzamelaar`. NavModuleDef heeft nu `external?: boolean` → Sidebar + EntityLanding renderen met `target="_blank"`.
- ✅ **Per-entity dashboard landings** — `lib/active-company-server.ts` (cookie reader), CompanyProvider schrijft cookie + `router.refresh()` na switch. `app/dashboard/page.tsx` is dispatcher: osm → `DashboardOsm`; andere 6 → `EntityLanding` met hero in company-kleur + quick-access tiles.
- ✅ **Build Tracker route** — `/dashboard/build-tracker/page.tsx` server-component met directe Postgres slug-filter via `companies!inner(slug)` join (geen JS-mapping). Module toegevoegd aan alle 7 COMPANY_NAV's onder "Operationeel".
- ✅ **Dashboard UX agent** — `~/.claude/agents/dashboard-ux-agent.md` geregistreerd met 3-fase werkwijze (audit → voorstel → refactor), hard regels uit CLAUDE.md.
- ✅ **Security fix** — `local-watchdog/.env` + `local-watchdog/Supabase*.txt` toegevoegd aan `.gitignore` (bevatten plain service_role keys).

### Open punten (vereisen Orlando-actie)

1. **Vercel envs swappen + redeploy** — `https://vercel.com/orlandos-projects-664da775/orlando-core-os/settings/environment-variables` → update `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` voor Production/Preview/Development. Daarna laatste prod deploy → Redeploy zonder cache.
2. **Render 7 services envs swappen** — `dashboard.render.com` → per service (orlando-youtube-engine, executor, mail-engine, executive-engine, acquisition-engine, watchdog, checkout-auditor) → Environment → update SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY → Manual Deploy. competitor-scanner overslaan (paused).
3. **CLI-R Mac local-watchdog deploy** — kopieer `local-watchdog/.env` naar CLI-R, wijzig `WATCHDOG_HOST_ID=cli-r`, plak Telegram bot token. Verifieer of PM2 daadwerkelijk op CLI-L draait (`which pm2` retournde "not found" deze sessie).

### Verificatie commands

```bash
cd /Users/o.s.m.amatiskak/Github/orlando-core-os/frontend
# Dev server draait via nohup:
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/dashboard
# Log: tail -f /tmp/orlando-dev.log

# Build_tracker counts per entity (switch via sidebar):
# osm:5, modiwerijo:2, modiwe-media:5, modiwe-software:6, strkbeheer:3, strkbouw:2, bouwproffs:2
```

### Bekende kwesties

- `PROJECT_STATUS.md` was UU merge — opgelost in sessie 4. `git add PROJECT_STATUS.md` om af te ronden.
- Module-level cache in `lib/scoped-queries.ts` vervangen door React `cache()` (dedup per-request).
- 30+ uncommitted bestanden (frontend, migraties, agents). Commit-bericht voorbereid in chat.

---

## 🚨 Sessie 3 archief (Media Holding OS Showcase UX + Algorithm Intelligence Center)

**Sessie focus (2026-05-23, sessie 3)**: Media Holding OS — Showcase-grade UX + Algorithm Intelligence Center 🔄 Code compleet, migratie 084 + Render deploy pending.

> **Migratie-collision opgelost:** Sessie 2 (Aquier) had al `082_aquier_command_center.sql` + `083_aquier_kickoff_seed.sql` applied. Mijn Media Holding targets migratie zit nu op **084_media_holding_targets.sql** om dubbele-nummering te voorkomen. Volgende vrij nummer = 086 (085_checkout_audit_artifacts_bucket bestaat al).

**Wat is gedaan deze sessie:**
- ✅ `frontend/components/executive/` uitgebreid met: KpiTileV2, Sparkline, MetricDelta, LiveBadge, SectionCard, ActionCTA, BreakoutCard, TrendHeatmap, AutopilotSwitch, ShowcaseProvider, ShowcaseToggle.
- ✅ `globals.css` accent-tokens + glow/shimmer keyframes + `html[data-showcase="on"]` mode (contrast +10%, glow +85%, animations 1.6× sneller).
- ✅ `framer-motion@^12.40.0` toegevoegd voor count-up + slide-in micro-interactions.
- ✅ Migratie **084_media_holding_targets.sql** — business-plan overlay tabel + seed van ecosystem-wide targets (views_24h 25k, retention 0.55, ctr 0.06, breakouts_7d 12, etc.) + `v_media_holding_kpi_targets` view.
- ✅ API routes nieuw:
  - `GET /api/algorithm/signals` — geaggregeerde feed (KPI's, gravity events verrijkt met channel/content, viral_opportunities top 50, trend signals top 200 → 36, autopilot config, latest strategy report).
  - `POST /api/algorithm/actions` — swarm/clone/push/expand CTA → schrijft naar `orchestrator_tasks` (executor=content_factory) + `executive_recommendations` (status=approved).
  - `PATCH /api/algorithm/autopilot` — toggle `autopilot_config.enabled` voor gravity_to_winner / gravity_to_language / viral_to_factory / upload_to_crossplatform.
  - `GET /api/algorithm/targets` — lichtgewicht read voor business-plan overlay (faalt zacht als migratie 084 nog niet applied).
- ✅ `frontend/lib/realtime.ts` — `useRealtimeChannel` Supabase realtime wrapper (postgres_changes); fallback silent als env mist.
- ✅ **`/dashboard/media-holding/executive/algorithm`** volledig herschreven van JSON-viewer naar Algorithm Intelligence Center: Signal Strip (5 KPI tiles met targets) + Breakout Feed (verrijkte gravity events + Swarm/Clone/Push/Expand CTA's) + Trend Heatmap + Algorithm Strategist Report (kaartweergave i.p.v. JSON) + Autopilot Switchboard + Top viral opportunities grid.
- ✅ **`/dashboard/media-holding/executive`** Overview pagina geupgrade naar KpiTileV2 met target-overlay + ATLAS commentary sectie + realtime alerts + CtaLink naar Algorithm Center.
- ✅ **`executive/layout.tsx`** wrapped in ShowcaseProvider met ShowcaseToggle in header (toggle `?showcase=1`).
- ✅ `executive-engine/src/agents/algorithm-strategist.ts` — fan-out hook: swarm_opportunities met variants_to_make≥3 worden auto-gedispatched als `orchestrator_tasks` met executor=content_factory; priority=2 (hoog) als er ook een breakout in 24h-window zat, anders 4.

**Open punten (vereisen Orlando-actie):**
1. **Migratie 084 applien** — Supabase MCP: `apply_migration` met inhoud van `supabase/migrations/084_media_holding_targets.sql`. Anders blijft `/api/algorithm/targets` leeg en valt KPI target-overlay terug op hardcoded defaults.
2. **Render Executive Engine deploy** — push naar GitHub → `orlando-executive-engine` Render service → ANTHROPIC_API_KEY env zetten in Render dashboard.
3. **Vercel env** — `EXECUTIVE_ENGINE_URL=https://orlando-executive-engine.onrender.com` zetten zodat `Run Strategist` knop kan POST'en naar Render.
4. **Autopilot activeren** — via nieuwe AutopilotSwitchboard in Algorithm Center, of SQL: `update autopilot_config set enabled=true where link_key in ('gravity_to_winner','gravity_to_language')`. Start met lage threshold om eerst gedrag te observeren.
5. **First-run test** — open `/dashboard/media-holding/executive/algorithm` → check dat Breakout Feed + Trend Heatmap data tonen (data komt uit bestaande viral-scan + trend-scan crons, dus actief).

**Verificatie commands:**
```bash
cd /Users/o.s.m.amatiskak/Github/orlando-core-os/frontend
npm run dev
# open http://localhost:3000/dashboard/media-holding/executive/algorithm
# toggle Showcase ON in header → animaties versnellen, body contrast verhoogt
# klik Swarm op een breakout → check orchestrator_tasks tabel voor nieuwe row

---

## 🚨 Sessie 2 archief (Aquier Command Center kickoff)

**Sessie focus (2026-05-23, sessie 2)**: Aquier Command Center toegevoegd aan Modiwe Software dashboard. AI Project Leider (CHRONOS-AQ) staat klaar voor maandag 2026-05-25 09:00 kickoff. ✅

**Wat is gedaan deze sessie:**
- Nav: 8 nieuwe modules in `lib/nav-config.ts` (aquier_hub, aquier_projecten, aquier_planning, aquier_agenda, aquier_ai_lead, aquier_monitor, aquier_approvals, aquier_forecast)
- Aquier sectie toegevoegd aan `modiwe-software` COMPANY_NAV (direct na Dashboard)
- 7 pages gebouwd in `app/dashboard/aquier/`: hub + projecten + planning + agenda + ai-lead + monitor + approvals
- Approvals page heeft Server Action `actions.ts` voor Approve/Decline/Defer met decision notes
- Supabase migration `082_aquier_command_center.sql` APPLIED via MCP — 8 tabellen (projects, sprints, tasks, agenda, ai_lead_state, ai_lead_briefs, monitor_events, approvals)
- Supabase migration `083_aquier_kickoff_seed.sql` APPLIED — sprint W22, 14 tasks, kickoff brief, 4 monitor events, 3 pending approvals
- AI Lead CHRONOS-AQ singleton in `aquier_ai_lead_state` is `ready`, gekoppeld aan sprint SP-2026-W22, met guardrails (auto-execute ≤€2K, approval >€25K, pause bij KPI miss >30%)
- Volledig masterplan blijft staan op `~/Desktop/AQUIER_GLOBAL_EXPANSION_MASTERPLAN/` (54 bestanden, 25 modules)

**Open punten voor maandag 2026-05-25:**
- Verifieer dat dashboard render werkt (vercel deploy van orlando-core-os of localhost test)
- Eerste daily brief (06:00) — vereist agent runner op Render of via Vercel cron
- LinkedIn DM lijst voor wave 1 design partner outreach (15 prospects)
- Notaris afspraak voor Aquier BV oprichting

---

**Sessie focus (2026-05-23, sessie 1)**: YouTube dashboard view_count discrepantie ✅

- ✅ Root cause: `/api/youtube/sync` gebruikte per-channel OAuth bearer tokens; bij `oauth_status='expired'` (BrickPulse Lab, LoopForge AI, SliceTheory, AquierTv, AquierTvEs) bleven `view_count`/`subscriber_count` stilstaan. Dashboard `4.3k` was som van stale waardes.
- ✅ Fix: route rewriten naar publieke `youtube/v3/channels?id=<csv>&key=YOUTUBE_DATA_API_KEY` — 1 quota-unit per 50 IDs, werkt ongeacht OAuth state. Commit `3f45110`.
- ✅ Schedule blijft `*/30 * * * *` (vercel.json `sync-stats`). Dashboard ververst zelf via RSC bij paginabezoek.
- ⏳ Na Vercel-deploy: klik `Sync` knop op `/dashboard/youtube` voor directe backfill, of wacht max 30 min op volgende cron tick. Daarna kan MA/Analyst aan de slag met scaling beslissingen.

---

**Vorige sessie focus (2026-05-22)**: Render + Lokaal (PM2) self-healing watchdogs ✅

**Local watchdog (CLI-L LIVE, CLI-R deploy pending):**
- `local-watchdog/` TS service; pollt `pm2 jlist` elke 30s, restart bij stopped/errored met cooldown, crash-loop detectie (>3 restarts/5min) → automatic stop + npm install + npm run build + restart; na 2 mislukte rebuilds escalatie naar `infra_watchdog_incidents` + critical Telegram
- Migration 081: `host_id` kolom op events/incidents tabellen (composite PK `host_id+deploy_id`)
- ecosystem.cli-{l,r}.config.js — `local-watchdog` PM2 app toegevoegd (WATCHDOG_HOST_ID=cli-{l,r})
- CLI-L LIVE: PID via `pm2 status`, health http://127.0.0.1:3007/health, host_id=cli-l, checking 2 apps
- `.env` op CLI-L: `~/Github/orlando-core-os/local-watchdog/.env` (perms 600)
- **CLI-R deploy stappen** (handmatig uitvoeren op CLI-R Mac):
  ```bash
  cd ~/Github/orlando-core-os && ./sync-pull.sh
  cd ~/Github/orlando-core-os/local-watchdog && npm install && npm run build
  # plaats .env identiek aan CLI-L (zelfde SUPABASE/TELEGRAM creds)
  pm2 start ~/Github/orlando-core-os/ecosystem.cli-r.config.js --only local-watchdog
  pm2 save
  ```

**Render watchdog (eerder vandaag):**

**Wat is gedaan:**
- Build error op commit 259d3de gefixt (`youtube-engine/src/marketing-orchestrator.ts` Recommendation interface miste `executed_at`). Fix in commit `b9dbec8`.
- Beide gefaalde services (`orlando-youtube-engine` + `orlando-competitor-scanner`) live op commit b9dbec8 ✅
- Nieuwe service `orlando-watchdog` (srv-d8831g3bc2fs73ehlujg) gebouwd in `watchdog-engine/`
  - Pollt Render API elke 60s, monitort alle non-suspended services (ondersteund door denylist env)
  - Bij failed deploy: restart → redeploy (clearCache op 2e poging) → na 2 mislukte pogingen escalatie naar `infra_watchdog_incidents` + critical Telegram alert
  - Skip-window: alleen acteren op deploys < 180 min geleden gefaald (`WATCHDOG_RECENT_FAILURE_MINUTES`)
  - Telegram bot YT_Agent_OS_Bot, chat 7583931210
- Migration `080_watchdog.sql` applied — `infra_watchdog_events` + `infra_watchdog_incidents` tabellen
- `WATCHDOG_DENYLIST` gevuld met 20 oude `ao-*` services (legacy bouw — niet auto-recoveren)
- Health: https://orlando-watchdog.onrender.com/health
- Render dashboard: https://dashboard.render.com/web/srv-d8831g3bc2fs73ehlujg

**Open punten:**
- Optioneel: verlaag of suspend de 20 oude ao-* services in Render dashboard om verwarring te voorkomen
- Optioneel: Vercel/Next.js dashboard page voor `infra_watchdog_events` + open incidents
- Optioneel: hook escalatie naar Claude Code agent invoke (nu: incident row + Telegram only)

**Sessie focus (2026-05-20, sessie 2)**: Executive Intelligence Layer (Fase 7) — AI C-suite bovenop Media Holding OS. ✅ Code compleet, deploy pending.

**Sessie focus (2026-05-20, sessie 3)**: Acquisition Intelligence Layer — VOLLEDIG LIVE ✅

**Wat is gedaan in deze sessie:**
- ✅ Migratie 076 applied — 14 acq_* tabellen (acq_deals, acq_deal_scores, acq_build_opps, acq_offmarket_leads, acq_permits, acq_municipalities, acq_investors, acq_investor_matches, acq_crm_contacts, acq_outreach_sequences, acq_outreach_messages, acq_settings, acq_agent_registry, acq_scan_jobs), indices, triggers, 8 agents geseed.
- ✅ Migratie 076 applied in Supabase via MCP.
- ✅ Migratie 075 (executive_agents + executive layer) ook applied — executive tabellen live.
- ✅ Render service `executive-engine/` gebouwd — 6 LLM agents (ATLAS opus, 5 specialisten sonnet), node-cron schedules, Express health/run endpoints, CLI runner.
- ✅ 3 Vercel crons toegevoegd: `/api/executive-layer/cron/{decision-engine,alert-engine,autonomous-scaling}`.
- ✅ Shared frontend lib `frontend/lib/executive-layer/` — types, decision-engine (rule-based), alert-detectors (7 detectors), autopilot-links (5 links).
- ✅ 12 API routes onder `/api/executive-layer/` (decisions, reports, recommendations, alerts, agents, fund, kpis).
- ✅ 5 shared executive components in `frontend/components/executive/`.
- ✅ Nieuwe top-tab `Executive` in media-holding layout + 7 sub-pages (Overview, Boardroom, Channels, Retention Lab, Algorithm, Compete, Fund).
- ✅ `vercel.json` + `render.yaml` ge-update voor `orlando-executive-engine` service.

**Sessie focus (2026-05-20, sessie 4)**: Alle 4 componenten gebouwd + deployed ✅

- ✅ `acquisition-engine/` gebouwd (8 agents, Express :3005, 8 cron schedules)
- ✅ `render.yaml` ge-update — `orlando-acquisition-engine` service klaar voor deploy
- ✅ 4 Vercel acquisition crons: deal-scan, permit-scan, offmarket-scan, director-briefing
- ✅ Content factory pipeline hersteld via `factory-feeder` cron (breekt de blokkade)
- ✅ Vercel deployment: `frontend-e36dglgqv-orlandos-projects-664da775.vercel.app`

**Render env vars nog te zetten (HANDMATIG):**
1. `orlando-executive-engine`: ANTHROPIC_API_KEY
2. `orlando-acquisition-engine`: ANTHROPIC_API_KEY + SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY

**Vercel env var nog te zetten:**
- ACQUISITION_ENGINE_URL=https://orlando-acquisition-engine.onrender.com

---

**Direct herstelbaar door:**
1. Render deploy: push de wijzigingen naar GitHub, Render auto-deploy pickt `orlando-executive-engine` op. ANTHROPIC_API_KEY env in Render dashboard zetten.
2. Vercel env `EXECUTIVE_ENGINE_URL=https://orlando-executive-engine.onrender.com` zetten.
3. Eerste manual trigger:
   ```bash
   # Trigger Decision Engine (geen LLM kosten)
   curl https://<vercel-url>/api/executive-layer/cron/decision-engine -H "Authorization: Bearer $CRON_SECRET"
   # Trigger Alert Engine
   curl https://<vercel-url>/api/executive-layer/cron/alert-engine -H "Authorization: Bearer $CRON_SECRET"
   # Trigger ATLAS (kost ~$0.30)
   curl -X POST https://<vercel-url>/api/executive-layer/agents/run/atlas
   ```
4. Open `/dashboard/media-holding/executive` om resultaten te zien.

---

**2026-05-20 sessie 1**: Viral Intelligence Engine van orchestrator_task-poller naar **directe Vercel cron routes**. ✅ AUTONOOM LIVE per 16:22 UTC — alle 3 endpoints succesvol manueel getriggerd, data binnen (viral 156→234, audio 77→83, trend 346→411).

- ✅ Media Holding inhaalsprong (Settings, Analytics, Compete, Archives modules + API routes + migraties 073-075)
- ✅ Competitor Surveillance scanner-worker (gebouwd, gedeployed, paused)
- ✅ 3 directe Vercel cron routes voor viral/audio/trend scan
- ✅ Shared helper `frontend/lib/youtube-public.ts`

**Direct herstelbaar door:**
1. Manueel triggeren ter validatie:
   ```bash
   curl -H "Authorization: Bearer $CRON_SECRET" https://<vercel-url>/api/youtube/cron/viral-scan
   curl -H "Authorization: Bearer $CRON_SECRET" https://<vercel-url>/api/youtube/cron/audio-scan
   curl -H "Authorization: Bearer $CRON_SECRET" https://<vercel-url>/api/youtube/cron/trend-scan
   ```
2. Vereist: `YOUTUBE_DATA_API_KEY` en `CRON_SECRET` in Vercel env (allebei al gezet).
3. Verifieer rij-aanwas:
   ```sql
   select 'viral' t, count(*), max(captured_at) from viral_opportunities
   union all select 'audio', count(*), max(captured_at) from audio_library
   union all select 'trend', count(*), max(captured_at) from trend_scanner_signals;
   ```

---

## 📊 Module status

### Media Holding OS (6/6 fases completed, 23/23 modules live + Fase 7 in build)

| Fase | Status | Voortgang |
|---|---|---|
| 1 — Cashflow First | ✅ Completed | 100% |
| 2 — Media Division Structuur | ✅ Completed | 100% |
| 3 — Dashboard & UX | ✅ Completed | 100% |
| 4 — AI System Behavior | ✅ Completed | 100% |
| 5 — Infrastructure Rules | ✅ Completed | 100% |
| 6 — Long Term Scale | ✅ Completed | 100% |
| 7 — Executive Intelligence Layer | 🔄 Building | 60% (code+DB live, Algorithm Intelligence Center UI live, Render deploy + migratie 083 pending) |
| 8 — Acquisition Intelligence Layer | ✅ Completed | 100% (DB+API+UI live, workers todo) |

### Render services (deploy status)

| Service | Status |
|---|---|
| `orlando-youtube-engine` | ✅ Live |
| `orlando-executor` (planning-engine) | ✅ Live |
| `orlando-mail-engine` | ✅ Live |
| `orlando-competitor-scanner` | 🔄 Live maar Orlando wil suspenden (DB workers op `paused`) |
| `orlando-redis` | ✅ Live |
| `orlando-executive-engine` | ⏳ Code klaar, render.yaml ge-update — ANTHROPIC_API_KEY zetten in Render |
| `orlando-acquisition-engine` | ⏳ Code klaar, render.yaml ge-update — env vars zetten in Render |

### Vercel crons (6 actief)

| Cron | Schedule | Doel |
|---|---|---|
| `refresh-tokens` | `0 5 * * *` | OAuth tokens vernieuwen |
| `sync-stats` | `0 8 * * *` | Channel/video stats syncen |
| `snapshot-daily-stats` | `55 23 * * *` | Dagelijkse snapshot |
| `run-pipeline` | `0 2 * * *` | Generatie/publish pipeline |
| `sync-video-analytics` | `0 10 * * *` | Analytics syncen |
| `viral-scan` | `0 */4 * * *` | Direct YT Data API → viral_opportunities |
| `audio-scan` | `15 */4 * * *` | Direct YT mostPopular cat=10 → audio_library |
| `trend-scan` | `30 */4 * * *` | Extract keywords uit viral_opportunities → trend_scanner_signals |
| `decision-engine` | `0 * * * *` | Rule-based channel classificatie → executive_decisions |
| `alert-engine` | `*/15 * * * *` | 7 detectors → executive_alerts |
| `autonomous-scaling` | `0 */2 * * *` | Autopilot links (default uit, threshold tunable) |
| `factory-feeder` | `20 */4 * * *` | viral_opportunities → orchestrator_tasks (pipeline fix) |
| `acquisition/deal-scan` | `0 */6 * * *` | DealHunter trigger → acq_scan_jobs |
| `acquisition/permit-scan` | `0 7 * * *` | PermitAI trigger → relevantie scores |
| `acquisition/offmarket-scan` | `0 8 * * *` | OffMarketAI trigger → dev_scenario generatie |
| `acquisition/director-briefing` | `30 7 * * *` | AcquisitionDirectorAI dagelijkse briefing |

---

## ⏳ Open / Aandachtspunten

1. **Executive Engine deploy** — Render service `orlando-executive-engine` in render.yaml, code in `executive-engine/`. Push naar GitHub triggert deploy. ANTHROPIC_API_KEY env in Render dashboard zetten. EXECUTIVE_ENGINE_URL env in Vercel zetten na deploy.
2. **Acquisition scraper workers** — `acq_agent_registry` bevat 8 agents (DealHunter, OffMarketAI, PermitAI, etc.) allemaal `idle`. Geen Render worker gebouwd voor acquisitie. Volgende grote bouwblok.
2a. **Acquisition Vercel crons** — Nog geen crons aangemaakt voor acquisition scans (bijv. `0 6 * * *` DealHunter scan).
2. **Eerste agent-runs** — Tot ATLAS gedraaid heeft: Boardroom pagina toont empty state. Trigger handmatig na Render deploy: `POST /api/executive-layer/agents/run/atlas` (kost ~$0.30).
3. **Autopilot links staan default uit** — `update autopilot_config set enabled=true where link_key in (...)` om autonome scaling te activeren. Begin met `breakout_to_clone` en `recommendation_to_task` als laagrisico.
4. **Render: orlando-competitor-scanner suspenden** — Orlando kiest expliciet voor Viral Intelligence ipv per-kanaal monitoring. Service nog niet gesuspend, kost ~$7/mo.
5. **Worker heartbeat bug** — `upload-engine-youtube.last_seen` wordt niet bijgewerkt terwijl worker wel actief is. Functioneel geen issue.
6. ~~Content factory pipeline stil~~ — **GEFIXED 2026-05-20 ~18:00 UTC**: vier Vercel crons toegevoegd (`content-factory`, `renderer-dispatch`, `renderer-poll`, `atlas-upload`) plus helpers `lib/youtube-public.ts` + `lib/replicate.ts`. Chain bewezen werkend t/m render: 1× DC's Lanterns MP4 (Replicate minimax). Hybride architectuur: premium (score≥95) via Replicate, lokale rail voor bulk (spec hieronder, niet gebouwd).
7. **BullMQ + Replicate URL als file_path** — `youtube-engine/src/workers/ffmpeg-normalizer-worker.ts` verwacht lokaal file_path (`fs.existsSync`). Wanneer atlas_upload Replicate URL als file_path zet, faalt ffmpeg-normalizer. Vereist code-change: bij URL prefix eerst downloaden naar /tmp dan normaliseren.
8. **YT Data API quota uitgeput** — 10k units/dag default. Vandaag al >198 verified_live + veel retries. Manual_review_required met "quota exceeded" om 19:02. Wacht tot 00:00 PT (~09:00 NL morgen) of verhoog quota via Google Cloud Console.
9. **Viral-scanner-tiktok** — status `offline`, nooit gebouwd. Out of scope.

## 🛠️ Spec — Lokale rail (volgende sessie)

**Doel:** Bulk content_factory render voor virality_score 50-94 zonder Replicate kosten. Premium rail (≥95) blijft Vercel + Replicate.

**Architectuur:**
- Reactivate `local-agent/` (Mac Mini) als orchestrator_tasks poller
- Pakt `executor='renderer'` tasks van content_items waar source_score < 95
- Render pipeline: Pexels stock + Edge TTS voice-over + FFmpeg compositie
- Output: Supabase Storage MP4 → content_item.output_url + status='ready' → trg_render_to_upload → atlas_upload (al gebouwd)

**Vereist op Mac Mini:** `PEXELS_API_KEY` (gratis), FFmpeg, Python3 + edge-tts. **Estimated:** 2-3 uur build.

## ✅ Upload engine fix (2026-05-20 17:20 UTC)

- 5 channels OAuth-reconnected (BrickPulse Lab, LoopForge AI, SliceTheory, AquierTv, AquierTvEs) — nieuwe tokens via env client.
- 15 `manual_review_required` items met unauthorized_client gereset naar queued → 2 verified_live + 13 file-not-found (verschoven probleem).
- Totaal 55 dode queue items opgeschoond (`cleanup-2026-05-20:` marker).
- 198 totale verified_live op YT (was 196).

---

## 📁 Code locaties (referentie)

- **Frontend (Next.js / Vercel)**: `frontend/`
- **YouTube engine + competitor scanner (Render)**: `youtube-engine/`
- **Orchestrator/executor (Render)**: `planning-engine/`
- **Mail engine (Render)**: `mail-engine/`
- **Database migraties (Supabase)**: `supabase/migrations/`
- **Deploy config**: `vercel.json`, `render.yaml`, `youtube-engine/docker-compose.yml`
- **Master plan**: `MASTER_BUILD_PLAN.md`

---

## 🗂️ Commit-stijl

`feat(scope): korte beschrijving` — body in NL, korte zinnen. Eindigt met `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>` voor Claude-bijdragen.
