# Hermes Integration — Risk Register (Fase 1)

Datum: 2026-05-28
Scoring:
- **Severity** (impact bij optreden): L=low, M=medium, H=high, C=critical
- **Likelihood**: L=onwaarschijnlijk, M=mogelijk, H=waarschijnlijk
- **Risk-score** = combinatie (informatief, niet sortering)

18 risico's onderverdeeld in 4 categorieën: integriteit, security, operationeel, ecosysteem.

---

## A. Integriteit / breaking-change risico's

### R01 — pg_cron-conflict tussen Hermes en routines_dispatch_cron
**Severity:** H | **Likelihood:** M
Hermes Scheduler Supervisor (subagent #1) draait elke minuut tegelijk met `routines_dispatch_cron`. Als beide dezelfde `routine_runs`-rij claimen ontstaat double-execution.
**Mitigatie:** Hermes claimt UITSLUITEND met `FOR UPDATE SKIP LOCKED` op een nieuwe `hermes.supervisor_claims`-tabel; nooit direct op `routine_runs`. Observer-only op routines-tabel.

### R02 — AO Executor subprocess-pattern zonder heartbeat
**Severity:** H | **Likelihood:** H
`/executor/nl_produce_and_upload.py` draait als subprocess zonder heartbeat. Hermes Executor Supervisor kan crash niet realtime detecteren — alleen post-hoc via `youtube_upload_queue` row-state.
**Mitigatie:** Subagent #4 leest queue + youtube_uploads, definieert stuck als `state in ('uploading','preparing') AND updated_at < now() - 30 min`. Geen poging tot live proces-inspectie.

### R03 — Trigger-chain mig 094 misst nieuwe hermes-write-pad
**Severity:** H | **Likelihood:** M
`trg_executive_alerts_autopilot` triggert al op insert. Als Hermes parallel insert in `executive_alerts` doet (vanuit eigen detectie), ontstaat dubbele autopilot_event en mogelijk dubbele Telegram-send.
**Mitigatie:** Hermes inserteert NOOIT in `executive_alerts`. Alleen lezen + eigen `hermes.escalations` schrijven. Detectie-pad blijft canonical.

### R04 — Build Tracker naming-mismatch (aquier_project_sections voor Hermes)
**Severity:** M | **Likelihood:** H
Plan suggereert sectie `hermes-integration` in `public.aquier_project_sections`. Tabelnaam is Aquier-specifiek, semantisch fout voor cross-org project.
**Mitigatie:** Migratie 104 introduceert generieke `public.project_sections` view met `UNION ALL` over `aquier_project_sections` + nieuwe `hermes_project_sections`. Frontend leest view, schrijven blijft per-project tabel.

### R05 — Routines Control Center supervist niets (memory 2026-05-27)
**Severity:** M | **Likelihood:** H
RCC infra+crons live maar 0 routines/0 runs. Hermes Scheduler Supervisor heeft niets om te supervisen tot RCC echt routines uitvoert.
**Mitigatie:** Subagent #1 markeert zichzelf `degraded` tot er ≥1 routine_runs/uur is. Geen false alerts in tussentijd. Documenteer dat RCC-supervist een vooruitgeschoven post is.

---

## B. Security / data-risico's

### R06 — Supabase service_role JWT leaked, rotation PENDING (memory)
**Severity:** C | **Likelihood:** M
Service_role JWT staat in chat-log. Hermes inherit deze key voor DB-writes. Rotation is uitgesteld.
**Mitigatie:** Migratie 104 (Hermes start) IS de eerstvolgende gelegenheid — koppel rotation aan deploy: nieuwe key vóór hermes-deploy, oude key revoke. Update keychain CLI-L + CLI-R + Render-envs in dezelfde change.

### R07 — Meta WhatsApp webhook HMAC-verificatie verkeerd geïmplementeerd
**Severity:** C | **Likelihood:** M
Onjuiste `x-hub-signature-256` verify → arbitrary payload injection in `hermes.whatsapp_inbox` → dispatch verkeerde actie.
**Mitigatie:** Gebruik `crypto.timingSafeEqual` (timing-attack safe). Test met 3 scenario's: geldig, ongeldig, vervalst-met-header. Reject-by-default in route-handler. RLS denied voor anon.

### R08 — Allowlist phone_e164 hard-coded met fout nummer
**Severity:** H | **Likelihood:** M
WhatsApp-nummer staat nog niet vast (Orlando: "geen goed telefoonnummer gekoppeld"). Risico: testdata blijft in allowlist → escalaties naar verkeerd nummer of silent-drop bij Orlando.
**Mitigatie:** Migratie 104 seed-rij heeft `active=false`. UI in `/dashboard/hermes/settings` om actief recipient toe te voegen. Healthcheck faalt als 0 active recipients en escalation_pending > 0 → fallback naar Telegram met "WhatsApp niet geconfigureerd"-prefix.

### R09 — RLS-policies op hermes-schema vergeten service-role
**Severity:** H | **Likelihood:** M
`alter table hermes.* enable rls` zonder explicit service-role policy = volledige lockout, Hermes kan niet schrijven.
**Mitigatie:** Migratie 104 bevat per tabel zowel `enable row level security` als `create policy "service_role_full" ... to service_role using (true) with check (true)`. RLS-test in CI: insert + select + update + delete als service_role én anon (anon moet falen).

### R10 — Meta Business account zonder verified phone number
**Severity:** M | **Likelihood:** H (al gerealiseerd, status open)
Orlando heeft Business account maar geen nummer. DoD-stap 5-6 (end-to-end WhatsApp-test) blokkeert.
**Mitigatie:** Splits werk: migratie 104 + service skeleton + Telegram-fallback eerst (testbaar zonder Meta). Meta-verificatie loopt parallel. Pas activeren van WhatsApp-bridge na nummer-verificatie.

---

## C. Operationele risico's (runtime)

### R11 — Dedup-index faalt voor null resource_id
**Severity:** M | **Likelihood:** M
`unique index ... (company_slug, alert_kind, coalesce(resource_id, ''))` faalt als twee escalaties dezelfde `(slug, kind)` met `resource_id=null` hebben — wordt 1 rij ipv 2.
**Mitigatie:** Voor alert_kinds zónder resource_id verplicht `resource_id = source_alert_id::text`. Plan opnemen in escalation-render: nooit null laten.

### R12 — Race: 2 watchdog-instances escaleren dezelfde incident
**Severity:** H | **Likelihood:** M
local-watchdog + youtube-engine watchdog kunnen beide dezelfde upload-fail detecteren. Zonder coordinatie → 2 WhatsApp-berichten.
**Mitigatie:** Unique-index (R11) op `(company_slug, alert_kind, resource_id)` blokkeert tweede insert in `hermes.escalations`. Tweede watchdog krijgt `unique_violation`, logt en stopt. Test in chaos-scenario.

### R13 — WhatsApp 24-uur customer-service window
**Severity:** M | **Likelihood:** H
Meta Cloud API laat na 24u user-silence alleen nog template-messages toe. Hermes follow-ups ("✓ Klaar") na lange stilte falen.
**Mitigatie:** Subagent #16 detecteert window-status; bij verlopen window → fallback Telegram + log in `hermes.decisions`. Approved template-set indienen bij Meta voor minimaal 3 events: incident_card, action_confirmed, action_completed.

### R14 — Quiet-hours timezone-ambiguïteit
**Severity:** L | **Likelihood:** H
`quiet_hours_start/end` als `time` zonder timezone. Server in UTC, Orlando in Europe/Amsterdam → 23:00 lokaal = 22:00 UTC zomertijd, 21:00 winter.
**Mitigatie:** Migratie 104 voegt `timezone text default 'Europe/Amsterdam'` toe aan `whatsapp_recipients`. Subagent #16 evalueert in lokale tz.

### R15 — In-memory dedup-Map gaat verloren bij restart (bestaand probleem, blokkeert Hermes niet)
**Severity:** L | **Likelihood:** H
Bestaande Telegram-services dedup via Map<key, ts>. Restart = dedup-reset. Niet Hermes' probleem maar context: Hermes' DB-dedup (R11) lost dit alleen op voor WhatsApp, niet voor Telegram.
**Mitigatie:** Géén Hermes-actie. Documenteer als toekomstig refactor (Fase 9+).

### R16 — Mac Mini (CLI-L/CLI-R) OOM bij alle Hermes-subagenten lokaal
**Severity:** H | **Likelihood:** M
15+1 subagenten in één Node-proces of meerdere PM2-procs op CLI-L → memory-druk.
**Mitigatie:** Subagent #14 (Local Worker Dispatcher) routeert per workload: orchestratie/dashboard naar CLI-L, scraping/OCR/LLM naar CLI-R. Hard cap per subagent: 512 MB. PM2 `max_memory_restart`. Healthcheck schrijft naar `hermes.system_health.cli_l_load`.

---

## D. Ecosysteem-risico's (cross-org)

### R17 — Cross-org incident raakt meerdere companies (geen multi-slug in dedup)
**Severity:** M | **Likelihood:** L
Bv. Stripe-key-rotation raakt Aquier (modiwe-software) én SterkCalc (strkbouw) tegelijk. Dedup op single `company_slug` = 2 aparte escalaties met dezelfde root-cause.
**Mitigatie:** Voeg optionele `correlation_id` toe aan `hermes.escalations`. Als ingesteld, dedup op `(correlation_id, alert_kind)`. Gebruik bij infra-brede events.

### R18 — Marketing Agent autonomie vs Hermes audit (memory regel)
**Severity:** L | **Likelihood:** M
Memory: MA mag autonoom committen bij "MA beslist"-delegatie. Hermes Aquier Marketing subagent (#8) zou MA-decisions kunnen blokkeren of vertragen door audit-overhead.
**Mitigatie:** Subagent #8 is uitsluitend audit-observer (`hermes.decisions` row na de feit). Geen pre-flight check, geen sync-blockade. MA-flow blijft non-blocking.

---

## Top-3 actie-items vóór Fase 2 starten

1. **R06 + R09**: combineer Supabase key-rotation met migratie 104. Niet apart inplannen.
2. **R02 + R12**: bevestig dat AO Executor subprocess-flow uitsluitend via queue-state geobserveerd wordt (geen proces-injection). Beschrijf in subagent #4 contract.
3. **R04**: kies vóór migratie 104 of we `public.project_sections` view introduceren of een Aquier-naming behouden. Beslissing nodig van Orlando.
