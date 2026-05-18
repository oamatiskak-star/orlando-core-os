# ORLANDO CORE OS — MASTER BUILD PLAN
**Author:** Orlando + Claude (Chief Architect role)
**Date:** 2026-05-11
**Status:** ACTIVE — single source of truth for all ecosystem build sessions
**Rule:** No build session starts without reading sections 0, 5, 6, 7, 18 of this document.

---

## 0. STATUS SNAPSHOT (verified 2026-05-11)

### What exists in `/Code/orlando-core-os/`
- Next.js frontend with 18 routed modules: `aanbod, admin, agents, api, calculaties, companies, dashboard, deals, finance, intelligence, legal, login, media, pitv, projects, properties, research`
- Supabase: 8 migrations applied (`001_initial` → `008_helper_fns_and_deal_province`)
- Python executor (FastAPI) with 15 workers: `ai_analyse, deal_report_generator, facebook_deal_poster, funda_monitor, ig_playwright_poster, instagram_poster, intelligence_scan, moneybird_sync, roi_worker, stabu_worker, youtube_manager, youtube_sync, yt_content_strategist, yt_script_writer, yt_seo_optimizer, yt_thumbnail_brief, yt_video_producer`
- Render + Vercel + Telegram bot infrastructure live

### What exists in `/Code/vastgoedscapler-saas/`
- Monorepo split: `vastgoed-core-front`, `vastgoed-core-back`, `vastgoed-core-executor`
- Shared Supabase schema `vastgoed_core`
- Status per memory: A1.1/A1.2/A1.3 complete; 16 PORT-CANDIDATE features mid-port

### Critical reality
- The ecosystem is **NOT greenfield**. It is **fragmented and partially duplicated**.
- Risk #1 is architectural drift between `orlando-core-os` and `vastgoedscapler-saas`.
- Foundation (auth, DB, deploy) is done. **The next phase is revenue activation, not infrastructure building.**

---

## 1. ECOSYSTEM TOPOLOGY

### 1.1 Product portfolio (10 systems)
| # | System | Status | Revenue role |
|---|--------|--------|--------------|
| 1 | Orlando Core OS | 60% built | Internal operating system |
| 2 | Vastgoed Core OS | 30% built | B2B SaaS for vastgoed pros |
| 3 | SterkCalc / SterkBouw SaaS | 20% built | Premium SaaS — STABU calc |
| 4 | Investor Network | 0% | Capital aggregation |
| 5 | AI Automation Agency | 0% | Services revenue, fast cash |
| 6 | Workflow Engine | partial in executor | Internal + white-label |
| 7 | Media Engine (YT network) | 70% built | Ad + affiliate revenue |
| 8 | White-label Infrastructure | 0% | Enterprise upsell |
| 9 | International Expansion | 0% | Q4 2026+ |
| 10 | Data Intelligence Systems | 40% (intelligence/) | Internal moat + premium tier |

### 1.2 Shared infrastructure stack (DO NOT DUPLICATE)
- **Auth:** Supabase Auth — single project, multi-schema
- **DB:** Supabase Postgres — schemas: `public`, `vastgoed_core`, future `sterkcalc`, `media`, `investor`
- **Storage:** Supabase Storage — buckets per domain
- **Frontend:** Next.js on Vercel — one repo per product
- **Backend/API:** Next.js API routes for thin layer; Render FastAPI for heavy work
- **Executor:** Render — Python workers, Supabase task queues
- **Comms:** Telegram bot — single bot, multi-channel routing
- **Versioning:** GitHub — `orlando-*` and `sterk-*` and `vastgoed-*` naming

### 1.3 Anti-patterns to forbid
- ❌ New auth system per product
- ❌ Duplicating Supabase clients per repo without shared lib
- ❌ Workers that bypass the task queue
- ❌ Frontend hitting Supabase directly for write-heavy ops (must go via API)
- ❌ Cross-product imports — share via npm package or copy contract

---

## 2. NORTH STAR & GUARDRAILS

### 2.1 North Star (12 months)
- **€20k+ MRR recurring** across SterkCalc + Vastgoed Core OS + Agency retainers
- **YouTube monetization unlocked** on minimum 3 of 5 channels
- **1 enterprise white-label deal** signed
- **Investor pipeline:** €1M+ committed capital tracked in system

### 2.2 Non-negotiable guardrails
1. **Production-ready only** — no test pages, no placeholders, no mock data in main branches
2. **Frontend never blocks executor** — async-first, optimistic UI
3. **One button = one task** — no multi-action triggers
4. **`project_id` from backend only** — never client-generated
5. **Full file replacements** — no snippets in commits
6. **Migration before code** — schema first, then API, then UI

### 2.3 Velocity guardrails
- Max 1 architectural change per week
- Max 3 modules in active dev simultaneously
- Every module hits "Definition of Done" before next starts (see §17)

---

## 3. THE 5 PHASES + GATES

Each phase has an **entry gate** (must be true to start) and **exit gate** (must be true to advance).

### PHASE 1 — FOUNDATION HARDENING (Weeks 1-2)
**Status:** 80% complete. Closing gaps, not rebuilding.

Entry: ✅ (already in)
Exit gate:
- [ ] All 8 migrations idempotent and documented
- [ ] Single shared Supabase client lib across all repos
- [ ] Telegram bot routes by `channel` env var
- [ ] CI: GitHub Actions for type-check + build on PR
- [ ] `.env.example` complete for every repo
- [ ] One-pager: how to spin up a new module (template)

### PHASE 2 — CORE REVENUE SYSTEMS (Weeks 3-10)
Entry: Phase 1 exit gate green.
Exit gate:
- [ ] SterkCalc MVP: STABU calc + PDF export + Stripe checkout
- [ ] Vastgoed Core OS: deals + properties + investor lead capture
- [ ] CRM module live (shared between Orlando + Vastgoed)
- [ ] First €1k MRR signed

### PHASE 3 — AUTOMATION (Weeks 11-16)
Entry: Phase 2 has 3+ paying customers.
Exit gate:
- [ ] Mail automation: Apple Mail + Gmail + Office365 routed via `email-operations-agent`
- [ ] Invoice OCR → Moneybird flow live
- [ ] AI agents (architect/builder/executor) operating on real task queue
- [ ] Scheduling: cron-driven daily ops (06:00 / 08:00 / 14:00 / 20:00 cycle)

### PHASE 4 — MONETIZATION DEEPENING (Weeks 17-24)
Entry: €5k+ MRR.
Exit gate:
- [ ] Tiered subs live (Free / Pro / Enterprise) on SterkCalc + Vastgoed
- [ ] Affiliate program with tracked links
- [ ] White-label config layer (theme + domain + auth tenant)
- [ ] 1 enterprise pilot signed

### PHASE 5 — SCALE (Weeks 25+)
Entry: White-label pilot in production.
Exit gate:
- [ ] i18n (NL/EN/DE) on Vastgoed Core OS
- [ ] Multi-currency on Stripe + accounting
- [ ] Public API + dev portal
- [ ] EU expansion plan executed (DE/BE first)

---

## 4. MODULE DECOMPOSITION (per phase)

Every module is its **own isolated Claude session unit**. One module = one session = one PR.

### Phase 1 modules (M1.x)
- **M1.1** Shared `@orlando/db` client lib (Supabase wrapper)
- **M1.2** Shared `@orlando/auth` middleware
- **M1.3** Migration audit + idempotency rewrite
- **M1.4** CI pipeline (lint + type + build) on all 3 repos
- **M1.5** Repo template generator (`pnpm create-orlando-module`)
- **M1.6** Telegram router consolidation (single bot, channel routing)
- **M1.7** `.env.example` + secret rotation doc

### Phase 2 modules (M2.x)
- **M2.1** SterkCalc — STABU schema + calc engine
- **M2.2** SterkCalc — PDF offerte generator
- **M2.3** SterkCalc — Stripe checkout + entitlements
- **M2.4** SterkCalc — Drawing upload + AI hoeveelheden detect (Claude vision)
- **M2.5** Vastgoed Core OS — deal pipeline (Funda scraper → scoring → Telegram alert)
- **M2.6** Vastgoed Core OS — property portfolio (WOZ, energielabel, huur)
- **M2.7** Vastgoed Core OS — investor lead capture funnel
- **M2.8** Shared CRM — contacts, deals, activities
- **M2.9** Finance dashboard — Moneybird sync + cashflow chart
- **M2.10** Pricing pages + checkout for each product

### Phase 3 modules (M3.x)
- **M3.1** Email operations agent (IMAP + Gmail + O365 unified inbox)
- **M3.2** Invoice OCR pipeline (PDF → Moneybird)
- **M3.3** AI agent orchestrator (task queue + worker dispatch)
- **M3.4** Daily ops cron (06/08/14/20 cycle)
- **M3.5** Legal mail recognition + escalation
- **M3.6** Sales CRM follow-up automation
- **M3.7** Construction project monitoring agent
- **M3.8** YouTube CEO cycle (full integration of 7 YT subagents)

### Phase 4 modules (M4.x)
- **M4.1** Stripe subscription tiers + customer portal
- **M4.2** Entitlement engine (feature flags per plan)
- **M4.3** White-label tenant config (theme + domain + auth)
- **M4.4** Affiliate tracking (referral codes + payout schedule)
- **M4.5** Enterprise admin panel
- **M4.6** Billing dashboard for end-users
- **M4.7** Upgrade/downgrade flows + dunning

### Phase 5 modules (M5.x)
- **M5.1** i18n infrastructure (next-intl)
- **M5.2** Multi-currency pricing + Stripe regional
- **M5.3** Public REST API + OpenAPI spec
- **M5.4** Developer portal (API keys, docs, usage)
- **M5.5** EU compliance (GDPR data residency)
- **M5.6** German/Belgian market data adapters (substitute for Funda/Kadaster)

---

## 5. DEPENDENCY GRAPH

```
M1.1 (db lib) ──┬─► M1.2 (auth)
                ├─► M2.* (all revenue modules)
                └─► M3.* (all automation)

M1.3 (migration audit) ──► M2.1, M2.5, M2.6 (need clean schemas)
M1.4 (CI) ──► everything (gate for PR merge)
M1.5 (template) ──► M2.* (each new product spins from template)
M1.6 (telegram router) ──► M3.* (all alerts route through it)

M2.1 (STABU schema) ──► M2.2 (PDF) ──► M2.3 (Stripe) ──► M4.1
M2.4 (AI drawing) ──► depends on M2.1 done
M2.5 (deal pipe) ──► M2.7 (investor capture) ──► M2.8 (CRM)
M2.8 (CRM) ──► M3.6 (sales automation)
M2.9 (finance) ──► M3.2 (invoice OCR) ──► M3.4 (cron)

M3.3 (orchestrator) ──► gates M3.1, M3.5, M3.7, M3.8 production-readiness
M3.8 (YT cycle) ──► requires media engine 70% (already done)

M4.1 (subs) ──► M4.2 (entitlements) ──► M4.3 (white-label)
M4.3 ──► gates Phase 5 entry

M5.1 (i18n) ──► M5.6 (regional adapters)
M5.3 (API) ──► M5.4 (dev portal)
```

**Critical path:** M1.1 → M1.2 → M2.1 → M2.3 → M4.1 → M4.3 → M5.x
**Parallelizable swimlanes:**
- Lane A (Revenue): M2.1 → M2.2 → M2.3 → M2.4
- Lane B (Vastgoed): M2.5 → M2.6 → M2.7
- Lane C (Shared): M2.8 → M2.9 → M2.10
- Lane D (Automation, after Phase 2): M3.1, M3.2, M3.8 can run in parallel

---

## 6. TOKEN-SAFE DEVELOPMENT STRATEGY

This is the **most important section**. Following it prevents Claude session collapse, weekly limit hits, and architectural drift.

### 6.1 The 10 token-safety laws
1. **One module per session.** Never mix M2.1 and M2.5 in the same Claude conversation.
2. **One layer per session.** Schema session ≠ API session ≠ UI session ≠ test session.
3. **External memory > context memory.** All long-lived context lives in `.md` files inside the repo, NOT in Claude's window.
4. **Pre-flight read budget: max 3 files + this plan.** If a session needs more, split it.
5. **Output budget: max ~600 lines of new code per session.** If more, plan part 2.
6. **No "explain everything" prompts.** Use targeted prompts referencing file paths + line numbers.
7. **Subagents for parallel research, never for builds.** Spawning a build agent doubles cost and loses context.
8. **Session handover doc mandatory.** Every session ends with `SESSION_LOG_YYYYMMDD_<module>.md` (8-20 lines, what changed + what's next).
9. **Plan mode for any new module.** Use the Plan tool / ExitPlanMode flow before writing code.
10. **Reset triggers.** New session when: context > 50% used, new module, new layer, new day.

### 6.2 External memory files (canonical)
| File | Purpose | Owner |
|------|---------|-------|
| `MASTER_BUILD_PLAN.md` | This doc — never delete | Orlando |
| `ARCHITECTURE.md` | System contracts, schemas, API shapes | Auto-updated per module |
| `SESSION_LOGS/` | One file per session — chronological | Each session writes its own |
| `~/.claude/projects/.../memory/` | Cross-conversation memory | Auto-memory system |
| `CLAUDE.md` (per repo) | Repo-specific rules | Manually maintained |
| `docs/decisions/ADR-NNN.md` | Architectural Decision Records | Created on architectural changes |

### 6.3 Prompt templates (use these verbatim per session type)

**Build session opener:**
```
Read: MASTER_BUILD_PLAN.md §0, §6, §7, §18; ARCHITECTURE.md §<relevant>; [max 3 code files].
Module: M<X.Y>
Layer: <schema|api|ui|worker|test>
Goal: <single sentence>
Constraints: production-ready only, no placeholders, full file replacements.
Output: code + SESSION_LOG entry. Stop at exit gate.
```

**Architecture session opener:**
```
Read: MASTER_BUILD_PLAN.md §1, §2, §5; ARCHITECTURE.md (full).
Decision needed: <question>
Output: ADR-NNN.md draft, no code.
```

---

## 7. CLAUDE SESSION TYPES (10 isolated contexts)

Each type has a fixed scope, max context, and forbidden actions. Switching type = new session.

| # | Session type | Max files read | Max output | Forbidden |
|---|--------------|---------------|------------|-----------|
| 1 | **Architecture** | plan + ADRs | 1 ADR doc | writing code |
| 2 | **Schema/Migration** | plan + 1 migration | 1 migration file | UI work |
| 3 | **Backend API** | plan + schema + 2 route files | 1-2 routes | UI work, schema changes |
| 4 | **Frontend UI** | plan + 3 UI files | 1-3 components/pages | schema changes, API logic |
| 5 | **Executor/Worker** | plan + 1 worker | 1 worker file | UI work |
| 6 | **AI Workflow** | plan + agent defs | 1 agent + queue config | code that doesn't go through queue |
| 7 | **Database query/admin** | plan + schema | SQL output only | code |
| 8 | **Infrastructure** | plan + render.yaml + vercel.json | config only | code |
| 9 | **Automation/Cron** | plan + 1 scheduler | 1 cron job | new modules |
| 10 | **Media/Content** | plan + 1 YT subagent | 1 workflow | code outside media domain |

### Session rotation rule
On a single workday, Orlando alternates **at most 3 session types**. More = context corruption.

---

## 8. PER-SESSION TEMPLATE

Every Claude session follows this 4-step protocol:

### Step 1 — PRE-FLIGHT (max 5 min)
- Read §0, §6, §7, §18 of `MASTER_BUILD_PLAN.md`
- Read last `SESSION_LOGS/SESSION_LOG_*` for the module
- Confirm session type from §7
- Write 1-line goal in Plan mode

### Step 2 — EXECUTE (max 90 min)
- Stay in one layer
- Stay in one module
- No exploration beyond declared file list
- Stop at 600 LOC output OR module Definition of Done

### Step 3 — VERIFY (max 15 min)
- Type-check / build / migration apply (whichever applies)
- Manual smoke test if UI
- Commit with conventional commit message

### Step 4 — HANDOVER (max 5 min)
- Write `SESSION_LOGS/SESSION_LOG_YYYYMMDD_<module>.md`:
  ```
  Module: M<X.Y>
  Layer: <layer>
  Changed: <files>
  Status: <DoD met? Y/N>
  Next: <next session prompt>
  Blockers: <if any>
  ```
- Update `MASTER_BUILD_PLAN.md` checkbox if module done
- Telegram ping to Orlando

---

## 9. DAILY EXECUTION MODEL

### 9.1 Standard build day (4 sessions, ~6 hours active Claude work)
| Time | Session type | Duration | Purpose |
|------|--------------|----------|---------|
| 08:00–08:15 | Orientation (no Claude) | 15 min | Read overnight Telegram digest, pick today's module |
| 08:15–09:45 | Schema OR Backend session | 90 min | One layer of one module |
| 10:00–11:30 | Frontend OR Worker session | 90 min | Different layer, same OR next module |
| 13:00–14:30 | Automation OR Media session | 90 min | Phase 3+ work |
| 15:00–16:00 | Architecture / planning | 60 min | ADRs, plan updates, week review |
| 16:00 | Daily wrap | — | Commit + push + plan update + Telegram ping |

### 9.2 Autonomous cron cycle (no Claude needed)
- **06:00** — Email ops agent runs (inbox triage, invoice routing)
- **08:00** — YouTube analytics morning report
- **10:00** — Content research agent dumps 10 video ideas
- **14:00** — Thumbnail review trigger
- **16:00** — Publication window
- **20:00** — Evening performance review + next-day prep
- **22:00** — Finance controller daily check + Telegram digest

### 9.3 Weekly cadence
- **Mon** — Phase 1/2 modules (schema + API focus)
- **Tue** — Frontend day (UI modules only)
- **Wed** — Automation + executor work
- **Thu** — Media engine + investor work
- **Fri** — Architecture, ADRs, ClickUp grooming, week recap
- **Sat** — Buffer / catch-up (optional)
- **Sun** — OFF (mandatory — prevents burnout-driven decisions)

---

## 10. WEEKLY / MONTHLY / QUARTERLY MILESTONES

### Month 1 (May 11 → Jun 11, 2026) — Phase 1 close + Phase 2 start
- W1: M1.1–M1.4 (shared libs + CI)
- W2: M1.5–M1.7 (template + telegram + envs)
- W3: M2.1 (STABU schema) + M2.5 (Funda deal pipe)
- W4: M2.2 (PDF) + M2.6 (property portfolio)
- **Milestone:** SterkCalc demo-able internally

### Month 2 (Jun 11 → Jul 11) — Revenue activation
- W5: M2.3 (Stripe checkout) + M2.7 (investor capture)
- W6: M2.8 (CRM) + M2.9 (Moneybird sync)
- W7: M2.10 (pricing pages) + first paid signup
- W8: M2.4 (AI drawing) — premium feature
- **Milestone:** €1k MRR signed, 3+ paying customers

### Month 3 (Jul 11 → Aug 11) — Automation
- W9-10: M3.1, M3.2 (email + invoice OCR)
- W11: M3.3, M3.4 (orchestrator + cron)
- W12: M3.5, M3.6, M3.7 (legal, sales, construction agents)
- **Milestone:** Full daily ops cycle autonomous

### Q2 (Aug-Oct) — Phase 4 monetization deepening
- Subscriptions, white-label, affiliate
- **Milestone:** €5k+ MRR, 1 enterprise pilot

### Q3-Q4 (Nov-Jan) — Phase 5 scale
- i18n, multi-currency, public API, EU expansion
- **Milestone:** €20k MRR, German pilot signed

---

## 11. BUILD TIME ESTIMATES

### Per-module estimates (realistic vs aggressive)
| Module | Realistic | Aggressive | Sessions |
|--------|-----------|------------|----------|
| M1.x average | 4 hours | 2 hours | 1-2 |
| M2.1 STABU schema | 12 hours | 6 hours | 3 |
| M2.2 PDF generator | 16 hours | 8 hours | 4 |
| M2.3 Stripe checkout | 8 hours | 4 hours | 2 |
| M2.4 AI drawing | 24 hours | 12 hours | 6 |
| M2.5 Funda deal pipe | 12 hours | 6 hours | 3 |
| M2.6 Property portfolio | 10 hours | 5 hours | 2-3 |
| M2.7 Investor capture | 6 hours | 3 hours | 2 |
| M2.8 CRM | 16 hours | 8 hours | 4 |
| M2.9 Finance + Moneybird | 12 hours | 6 hours | 3 |
| M2.10 Pricing pages | 4 hours | 2 hours | 1 |
| M3.x average | 8 hours | 4 hours | 2 |
| M4.x average | 10 hours | 5 hours | 2-3 |
| M5.x average | 12 hours | 6 hours | 3 |

### Total project envelope
- **Realistic:** ~480 hours of Claude session time across 6-7 months
- **Aggressive:** ~240 hours across 4 months (requires no detours)
- **At 6 hours/day, 5 days/week:** realistic = 16 weeks active work

---

## 12. AGENT / SUBAGENT DISTRIBUTION

Map specialized subagents (already configured in `~/.claude/`) to build & operate roles. **Build agents are RARELY spawned during code work** (cost). **Operate agents run autonomously via cron.**

### 12.1 BUILD roles (use sparingly, only for research/parallel discovery)
| Role | Subagent | When to spawn |
|------|----------|---------------|
| System Architect | `Plan`, `ai-architect-orlando` | New ADR, ecosystem-wide question |
| Codebase Explorer | `Explore` | Locating code in unfamiliar repo zone |
| Comprehensive Researcher | `comprehensive-researcher` | External API research, library evaluation |
| AI Engineer | `ai-engineer` | Model selection, RAG architecture |
| Data Engineer | `data-engineer` | New ETL pipeline design |
| Workflow Orchestrator | `workflow-orchestrator` | Task queue / saga design |
| Prompt Engineer | `prompt-engineer` | Production prompt optimization |

### 12.2 OPERATE roles (run autonomously, daily/hourly)
| Domain | Agents | Cadence |
|--------|--------|---------|
| Email ops | `email-operations-agent` | 06:00 daily |
| Finance | `finance-controller-agent` | hourly |
| Legal | `legal-risk-agent` | on email trigger |
| Sales CRM | `sales-crm-agent` | continuous |
| Construction PM | `construction-project-manager` | daily 08:00 |
| Vastgoed scouting | `real-estate-dealscanner`, `auction-foreclosure-agent`, `leegstand-detectie-agent`, `transformation-scout-agent`, `owner-distress-agent` | 24/7 |
| Vastgoed analytics | `gis-map-intelligence-agent`, `municipality-zoning-agent`, `permit-probability-agent`, `rental-yield-agent`, `split-conversion-agent`, `industrial-conversion-agent` | on-demand per deal |
| YouTube CEO cycle | `youtube-ceo-agent` orchestrates: `content-research-agent`, `script-agent`, `thumbnail-agent`, `seo-upload-agent`, `video-editor-agent`, `youtube-analytics-agent`, `youtube-community-agent`, `youtube-shorts-agent`, `youtube-cross-channel-agent`, `youtube-growth-hacker`, `social-media-distribution-agent` | daily cycle 06→20 |
| Document handling | `document-agent`, `calculation-qa-agent` | on upload |
| HR / workforce | `hr-workforce-agent` | weekly |
| Procurement | `procurement-agent` | weekly |
| Executive overview | `executive-dashboard-agent` | real-time |
| Telegram comms | `telegram-communication-agent` | continuous |

### 12.3 Hard rule
**Never spawn an operate-agent inside a build session.** They are wired into the cron / executor system. Calling them from a build session pollutes context.

---

## 13. CLICKUP STRUCTURE

### 13.1 Spaces (5)
1. **Foundation** — Phase 1 modules
2. **Revenue Systems** — Phase 2 modules
3. **Automation** — Phase 3 modules
4. **Monetization** — Phase 4 modules
5. **Scale & International** — Phase 5 modules

### 13.2 Lists (per space)
- `Backlog` — not yet scheduled
- `This Sprint` — current week
- `In Progress` — actively building (max 3 tasks per Orlando)
- `Review` — awaiting QA / Orlando approval
- `Blocked` — has unmet dependency
- `Done` — DoD met + merged

### 13.3 Task template (every M<X.Y> = one parent task)
```
Title: M<X.Y> — <module name>
Custom fields:
  - Phase: 1-5
  - Layer: schema | api | ui | worker | mixed
  - Realistic hours: <int>
  - Aggressive hours: <int>
  - Sessions estimated: <int>
  - Depends on: <task IDs>
  - DoD: <checklist>
Subtasks (one per Claude session):
  - S1: <layer> session
  - S2: <layer> session
  ...
Links:
  - Repo branch
  - PR
  - SESSION_LOG file(s)
  - ADR (if any)
```

### 13.4 Sprint cadence
- Sprint length: **1 week** (Mon-Fri)
- Sprint planning: **Fri 15:00** (architecture session slot)
- Sprint review: **Mon 08:00** (orientation slot)
- Max WIP per sprint: 5 modules

---

## 14. RISK REGISTER

| # | Risk | Severity | Likelihood | Mitigation |
|---|------|----------|------------|------------|
| R1 | Claude weekly token limit blocks build for days | HIGH | HIGH | §6 token-safe protocol; external memory; one module per session |
| R2 | Architectural drift between `orlando-core-os` and `vastgoedscapler-saas` | HIGH | HIGH | Shared `@orlando/*` libs (M1.1, M1.2) before any new module |
| R3 | Phase 2 paid features ship without entitlement layer | MED | MED | Block M2.3 (Stripe) until entitlement skeleton from M4.2 stubbed |
| R4 | Funda / Kadaster scraping breaks (legal / TOS) | HIGH | MED | API fallbacks; document scraper policy; throttle hard |
| R5 | YouTube channel demonetized | MED | LOW | Compliance review on each script; no copyrighted audio |
| R6 | Moneybird / Stripe webhook drift | MED | MED | Idempotency keys + reconciliation cron + Telegram alerts |
| R7 | Single Supabase project hits row/storage limits | LOW | MED | Schema separation now (`public`, `vastgoed_core`, …); upgrade plan ready |
| R8 | Solo founder burnout | HIGH | MED | §9.3 Sunday OFF rule; autonomous cron does the boring work |
| R9 | Premature optimization on i18n / multi-currency | LOW | HIGH | Locked behind Phase 5 gate; no exceptions |
| R10 | "New shiny module" detours | MED | HIGH | Plan changes require ADR; no module starts outside the current phase |
| R11 | Schema migration breaks production | HIGH | LOW | Idempotent migrations; staging branch on Supabase; rollback SQL written FIRST |
| R12 | Telegram bot becomes noise (alert fatigue) | MED | HIGH | Severity tiers: ERROR pages, WARNING groups, INFO daily digest only |
| R13 | Investor data leak (KYC PII) | CRITICAL | LOW | Encrypt at rest; RLS on all investor tables; access log |
| R14 | Subagent overuse balloons API cost | MED | MED | §12.3 rule; subagent calls require justification in SESSION_LOG |
| R15 | Documentation rot — plan & code drift | HIGH | HIGH | This doc updated at every phase exit; ADRs immutable; SESSION_LOGs append-only |

---

## 15. SCALING STRATEGY

### 15.1 Customer scale
- **0-10 customers:** manual onboarding, white-glove
- **10-50:** self-serve checkout, support via Telegram
- **50-200:** dedicated support email, FAQ, in-app docs
- **200+:** community (Discord), tiered support, CSM for enterprise

### 15.2 Technical scale
- **Single-tenant phase (now):** one Supabase, one Vercel, one Render
- **Multi-tenant phase (Phase 4):** schema-per-tenant for enterprise, shared schema with `tenant_id` for SMB
- **Edge phase (Phase 5):** Supabase read replicas; Vercel edge runtime; CDN for assets
- **Compute scaling:** Render auto-scaling on executor; separate worker pools per workload type

### 15.3 Team scale (when to hire)
| Trigger | Hire |
|---------|------|
| €5k MRR | 1 VA for customer support (4h/day) |
| €10k MRR | 1 part-time content editor (YouTube) |
| €20k MRR | 1 full-time developer |
| €30k MRR | 1 sales/ops person |
| €50k MRR | Replace Orlando in operations role |

### 15.4 Revenue scale levers
1. **Price:** raise SterkCalc Pro 20% every 6 months until churn signal
2. **Tier:** add Enterprise tier at 10x Pro price with white-label
3. **Geo:** Belgium (NL-speaking) first international (low translation cost)
4. **Adjacent:** sell investor leads to brokers (Phase 4)
5. **API:** monetize STABU data API to bouw-software vendors (Phase 5)

---

## 16. INFRASTRUCTURE PRIORITIES

### 16.1 Pre-Phase 2 hardening (must complete in W1-2)
- [ ] Supabase: enable point-in-time recovery
- [ ] Supabase: RLS on all production tables (audit current 8 migrations)
- [ ] Vercel: production branch protection
- [ ] Render: separate staging environment
- [ ] GitHub: branch protection on `main` (PR required, CI green)
- [ ] Secrets: rotate any committed keys; move to Vercel/Render env

### 16.2 Pre-Phase 3 (automation infrastructure)
- [ ] Supabase task queue table + worker dispatch contract
- [ ] Redis (Render or Upstash) for short-lived state
- [ ] Sentry on frontend + backend
- [ ] PostHog or Plausible for product analytics
- [ ] Stripe webhook handler with replay protection

### 16.3 Pre-Phase 4 (monetization infrastructure)
- [ ] Stripe Tax configured (Dutch BTW)
- [ ] Moneybird ↔ Stripe reconciliation worker
- [ ] Customer portal (Stripe-hosted is fine for MVP)
- [ ] Entitlement check middleware in `@orlando/auth`
- [ ] White-label domain provisioning (Vercel domains API)

### 16.4 Pre-Phase 5 (scale infrastructure)
- [ ] CDN strategy for assets (Vercel default OK)
- [ ] DB read replica decision
- [ ] Public API rate limiting (Upstash / Redis)
- [ ] OpenAPI spec generation in CI

---

## 17. KPI / GO-NO-GO CHECKPOINTS

### 17.1 Module Definition of Done (DoD)
A module is **DONE** only when ALL of:
- [ ] Schema migration applied + idempotent
- [ ] API endpoints documented in `ARCHITECTURE.md`
- [ ] UI passes manual smoke test
- [ ] No TypeScript errors
- [ ] No `console.log` left in code
- [ ] PR merged to `main` with CI green
- [ ] SESSION_LOG written
- [ ] Telegram notification: `MODULE M<X.Y> DONE`
- [ ] Plan checkbox flipped

### 17.2 Phase gate KPIs
| Phase | Pass KPI |
|-------|----------|
| 1 → 2 | All Phase 1 modules DoD; CI green on 3 repos; template generator works |
| 2 → 3 | 3+ paying customers; €1k MRR; SterkCalc + Vastgoed live |
| 3 → 4 | Daily ops cycle runs 7 days unattended; <5% manual interventions |
| 4 → 5 | €5k MRR; 1 enterprise pilot; white-label demo works |
| 5 → maturity | €20k MRR; non-NL revenue >10% |

### 17.3 Continuous health KPIs (Telegram daily digest)
- Active deals in pipeline
- MRR and trailing-7d change
- Active customers
- Open Stripe disputes
- Telegram alert volume (target: <50/day)
- Executor task queue depth (target: <100)
- Failed cron jobs in last 24h (target: 0)
- Cash position across all BVs

---

## 18. NEXT 14 DAYS — CONCRETE

This section is **rewritten every 14 days** at the Fri architecture session.

### Week of 2026-05-11 (THIS WEEK)
**Goal:** Close Phase 1 hardening — make the foundation un-fuckable-with.

- **Mon 05-11** — Plan freeze + ADR-001 (mono-vs-split repos decision)
- **Tue 05-12** — M1.1 shared `@orlando/db` lib (Schema/API session)
- **Wed 05-13** — M1.2 shared `@orlando/auth` middleware (Backend session)
- **Thu 05-14** — M1.3 migration audit + idempotency (DB admin session)
- **Fri 05-15** — M1.4 CI pipelines (Infrastructure session) + week recap

### Week of 2026-05-18
**Goal:** Close Phase 1 + start M2.1.

- **Mon 05-18** — M1.5 module template generator
- **Tue 05-19** — M1.6 Telegram router consolidation
- **Wed 05-20** — M1.7 envs + secret rotation
- **Thu 05-21** — **PHASE 1 EXIT GATE REVIEW** (architecture session)
- **Fri 05-22** — M2.1 STABU schema design — session 1 of 3

### What this week is NOT
- ❌ No new YouTube channels
- ❌ No Phase 4 thinking
- ❌ No "let me just add..." detours
- ❌ No vastgoedscapler-saas work until M1.1 lib exists

---

## APPENDIX A — Resume protocol

If you (Claude) are resumed in a fresh session:
1. Read sections **§0, §6, §7, §18** of this file
2. Read latest 3 `SESSION_LOGS/*` files
3. Read `ARCHITECTURE.md` (if exists)
4. Ask Orlando: "Welk module + welke laag voor deze sessie?"
5. Confirm session type from §7
6. Follow §8 template

## APPENDIX B — Update protocol

This document is updated:
- **§0** — at every phase gate review
- **§4** — when modules complete (checkbox)
- **§14** — when new risks materialize
- **§18** — every other Friday (architecture session)

Other sections frozen unless ADR justifies a change.

---

**END OF MASTER PLAN.**






