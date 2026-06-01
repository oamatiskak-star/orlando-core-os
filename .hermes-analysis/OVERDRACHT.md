# Hermes — Fase 2 Draft (na review-fixes #1–#8)

Stand: 2026-05-28. Niet gecommit. Review-fixes #1–#8 toegepast.
Klaar voor overdracht naar `bouwproffsnederlandbv`-checkout van orlando-core-os.

## Inhoud

```
draft/
├── README.md                          dit bestand
├── migrations/                        Supabase migrations (apply via supabase db push)
│   ├── 105_hermes_init.sql            schema + 8 foundation tables + pg_cron partitions
│   ├── 106_hermes_workflows.sql       workflows + workflow_runs + learning_events
│   └── 107_hermes_whatsapp.sql        escalations + recipients + inbox + project_sections (UNION view)
└── services/hermes/                   Node 20 + TS + ESM service
    ├── Dockerfile                     multi-stage, non-root, healthcheck
    ├── .dockerignore
    ├── package.json                   @orlando-core-os/hermes
    ├── tsconfig.json                  NodeNext module + resolution
    ├── README.md
    └── src/
        ├── index.ts                   entry + crash-handlers
        ├── core/
        │   ├── config.ts              Zod env validatie + whatsappEnabled() guard
        │   ├── logger.ts              Pino + redact paths
        │   └── boot.ts                HTTP server (healthz + Meta webhook)
        ├── connectors/
        │   ├── supabase.ts            schema=hermes default + public-helper
        │   └── whatsapp-cloud-api.ts  send + HMAC verify (timingSafeEqual)
        └── agents/
            ├── base.ts                BaseSubagent (register, heartbeat, structured logs)
            └── whatsapp-bridge.ts     subagent #16 met claim + reap + reply-target
```

## DB-objecten overzicht

### Schema `hermes` (mig 104 + 105)
| Tabel | Doel | Mig |
|---|---|---|
| subagents | Registry van subagents (uniek op name) | 104 |
| agent_state | Per-subagent runtime status + heartbeat | 104 |
| memory | key/value met scope + importance + ttl | 104 |
| skills | versioned + checksummed actie-modules | 104 |
| sessions | LLM-token/cost tracking per subagent+company | 104 |
| decisions | Audit-log met reden + alternatieven | 104 |
| logs | Maandelijks gepartitioneerd (12 mnd + default + pg_cron sliding) | 104 |
| system_health | 1-min snapshots (CLI-L/R load, queue depths, escalations open) | 104 |
| workflows | XState definities, versioned | 105 |
| workflow_runs | Run-history met generated duration_ms | 105 |
| learning_events | Failure-patterns + fix success-rate | 105 |
| escalations | WhatsApp escalation brain (dedup + correlation) | 106 |
| whatsapp_recipients | Allowlist (default active=false) + tz + quiet hours | 106 |
| whatsapp_inbox | Webhook idempotency + processing_error trail | 106 |

### Schema `public` (mig 106 alleen — Build Tracker)
| Tabel | Doel |
|---|---|
| hermes_projects | Project-level container (FK doel voor sections) |
| hermes_project_sections | Kolom-compatible met aquier_project_sections (mig 086) |
| project_sections (VIEW) | UNION ALL over aquier_project_sections + hermes_project_sections |

### Functies
| Functie | Schema | Doel |
|---|---|---|
| touch_updated_at() | hermes | Trigger helper |
| touch_updated_at_public() | public | Trigger helper (public-side) |
| is_within_quiet_hours(uuid, timestamptz) | hermes | Timezone-aware (Europe/Amsterdam default) |
| ensure_logs_partitions() | hermes | SECURITY DEFINER, 6 mnd vooruit, idempotent |

### pg_cron
| Job | Schedule | Functie |
|---|---|---|
| hermes_ensure_logs_partitions | `5 0 1 * *` | `hermes.ensure_logs_partitions()` |

## Status-enum voor escalations

```
pending  → sending  → sent     → answered → actioned
                  ↘ (release)             ↘ timed_out
              (reaper >2 min)             ↘ cancelled
```

Race-veilig: claim via conditional update, reaper voor stale 'sending', dedup-unique-index over `(company_slug, alert_kind, resource_id)` waar status in `('pending','sending','sent','answered')`.

## Beslissingen + review-fixes verwerkt

### Architecturale beslissingen (uit risk register)
| Risk | Beslissing | Vindbaar in |
|---|---|---|
| R02 (Executor observer-only) | Subagent #4 observer via youtube_upload_queue row-state | volgende iteratie |
| R04 (project_sections naming) | hermes_project_sections kolom-compatible met aquier_project_sections (mig 086 regel 54-73 geverifieerd) | mig 106 sectie 4 |
| R06+R09 (key rotation + RLS) | Header-waarschuwing mig 104 + RLS deny-by-default per tabel | mig 104 header |
| R08 (Allowlist default off) | `whatsapp_recipients.active default false` | mig 106 sectie 2 |
| R11 (Dedup null resource_id) | Rendering verplicht resource_id, fallback `source_alert_id::text` | mig 106 + bridge |
| R13 (24u window) | Logged + fallback Telegram (volgende iteratie) | bridge comment |
| R14 (Timezone quiet hours) | `timezone text` + `is_within_quiet_hours()` plpgsql functie | mig 106 sectie 2 |
| R17 (Cross-org correlation) | Tweede unique-index op `correlation_id` | mig 106 sectie 1 |

### Review-fixes (applied 2026-05-28)
| # | Fix | Locatie |
|---|---|---|
| 1 | logs PK `(id, created_at)` + 12 mnd partities + default partition | mig 104 sectie 7 |
| 2 | Reply match via `m.context.id` → `whatsapp_message_id` + `processing_error` trail | boot.ts handleWhatsappWebhook |
| 3 | tsconfig `module + moduleResolution = NodeNext` | tsconfig.json |
| 4 | `hermes_project_sections` Aquier-mirror + UNION view in mig 106 | mig 106 sectie 4 |
| 5 | Claim mechanisme (atomic update pending→sending) + reaper >2 min + release-on-fail | whatsapp-bridge.ts |
| 6 | Idempotent policies via `if not exists` lookup tegen `pg_policies` | mig 104 sectie 10, mig 105 sectie 4 |
| 7 | `ensure_logs_partitions()` SECURITY DEFINER + pg_cron monthly | mig 104 sectie 7 |
| 8 | `reply_from_phone` doorgegeven van inbox → bridge → confirmation message | boot.ts + whatsapp-bridge.ts |

### Niet (nog) gefixed — bewust voor latere iteratie
| # | Issue | Reden uitstel |
|---|---|---|
| 9 | `duration_ms` overflow risk bij runs >24 dagen | Cosmetic |
| 10 | Geen SIGTERM graceful shutdown | Mid-tick state-loss is acceptabel met reaper |
| 11 | Dockerfile zonder `--frozen-lockfile` | Lockfile genereert pas na eerste install |
| 12 | Quiet-hours DB roundtrip per recipient×escalation | Performance is OK met 1 recipient |
| 13 | Telegram fallback bij Meta `whatsapp_not_configured` | Vereist nieuwe Telegram-connector |
| 14 | pnpm-workspaces aanname in package.json | Verifieer in repo-root vóór commit |

## Overdrachts-stappen naar `bouwproffsnederlandbv`-checkout

1. Open Claude Code als macOS-user `bouwproffsnederlandbv`.
2. Trek main: `git pull origin main` in `~/Documents/orlando-core-os`.
3. **Verifieer pnpm-workspaces setup** (issue #14): `cat ~/Documents/orlando-core-os/pnpm-workspace.yaml`. Als geen workspace: package.json scripts moeten lokaal in `services/hermes/` draaien, niet via `pnpm --filter`.
4. **Coördineer Supabase service_role key-rotation** (memory: `project_supabase_key_rotation_pending`).
   - Genereer nieuwe service_role JWT in Supabase project `shaunumewswpxhmgbtvv`
   - Update keychain CLI-L + CLI-R
   - Update Render service envs
   - Update Vercel project envs
   - Revoke oude key pas na bevestigde deploy
5. Kopieer bestanden:
   ```bash
   cp draft/migrations/105_hermes_init.sql      ~/Documents/orlando-core-os/supabase/migrations/
   cp draft/migrations/106_hermes_workflows.sql ~/Documents/orlando-core-os/supabase/migrations/
   cp draft/migrations/107_hermes_whatsapp.sql  ~/Documents/orlando-core-os/supabase/migrations/
   cp -r draft/services/hermes/                 ~/Documents/orlando-core-os/services/
   ```
6. Apply tegen staging-branch eerst:
   ```bash
   cd ~/Documents/orlando-core-os
   pnpm supabase db push --linked   # staging
   ```
   RLS-test (insert/select als service_role + anon → anon faalt) groen.
7. Service build + smoketest:
   ```bash
   cd services/hermes
   pnpm install                      # genereert pnpm-lock.yaml
   pnpm typecheck
   pnpm build
   docker build -t hermes:test .
   docker run --rm -p 8787:8787 --env-file ../../.env.hermes hermes:test
   curl localhost:8787/healthz
   ```
   Verwacht: `{status:"ok", agents:["whatsapp-bridge"], whatsapp:"disabled"}` (whatsapp pas na Meta nummer-verificatie).
8. Build Tracker UI verifieren: `/dashboard/build-tracker` toont 11 Hermes-secties via `public.project_sections` view.
9. Commit lockfile + push, merge naar main na review. Render auto-deployt `services/hermes` (registreer eerst Render service: command `pnpm start`, env vars zoals in services/hermes/README.md).
10. **Meta WhatsApp setup (parallel)**: telefoonnummer koppelen aan Business account, webhook URL `https://[render-domain]/hermes/whatsapp/webhook`, verify token gelijk aan `WHATSAPP_VERIFY_TOKEN` env. Pas dan `whatsapp_recipients.active=true` zetten.

## Bestandsgroottes (na alle fixes)

```
mig 104 hermes_init        331 regels
mig 105 hermes_workflows   124 regels
mig 106 hermes_whatsapp    300 regels
                         ──────
SQL totaal                 755 regels

services/hermes/src/
  agents/base.ts           108 regels
  agents/whatsapp-bridge   315 regels
  connectors/supabase       23 regels
  connectors/whatsapp-...  130 regels
  core/boot.ts             223 regels
  core/config.ts            41 regels
  core/logger.ts            26 regels
  index.ts                  16 regels
                         ──────
TS totaal                  882 regels
```

## Niet in deze draft (Fase 3+)

- Frontend `/dashboard/hermes/*` route (Fase 5 hoofdplan)
- Subagents #1 t/m #15 — alleen #16 (WhatsApp) draait
- Escalation-router dispatch naar youtube/advocaat/aquier/stripe/executor subagents (nu stub in `hermes.decisions`)
- Real-time channel `hermes:events` (komt met dashboard)
- Telegram-fallback connector
- Meta template-messages voor 24u-window-verlopen

## Open punten vóór productie

1. Meta Business **telefoonnummer-verificatie** (DoD-blocker voor end-to-end test, parallel uit te voeren)
2. Render service aanmaken + env vars + auto-deploy linken aan `services/hermes/` pad
3. Eerste `pnpm install` op `bouwproffsnederlandbv`-checkout om `pnpm-lock.yaml` te genereren + committen
4. Verifieer `pnpm-workspaces.yaml` of plak service als standalone (#14)
5. Approval op fixes #1–#8 + acceptatie open items #9–#14 als "later" — anders rollback-pad in elke migratie inschakelen
