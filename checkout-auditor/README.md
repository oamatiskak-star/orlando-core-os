# checkout-auditor

End-to-end audit van Aquier.com checkout-flows via Playwright + Stripe API observatie + Supabase verificatie + Claude AI analyse.

## Scope

- 5 tiers × 2-3 billing cycles × 14 landen × 4 devices = ~370 scenario combinaties
- Per scenario: membership page → Stripe Checkout → webhook → DB sync verificatie
- Claude Opus produceert findings met severity/category/revenue impact
- Critical/high findings → automatisch `aquier_approvals` rows voor Orlando

## Architectuur

```
checkout-auditor/
├── src/
│   ├── index.ts                 Express + node-cron entry
│   ├── routes/                  /health, POST /run, POST /discover, POST /cleanup
│   ├── lib/                     supabase, anthropic, telegram, stripe, storage, logger, secrets (zod env)
│   ├── specs/                   tiers.json, countries.json, devices.json, checks.json, negative-scenarios.json, stripe-test-cards.json
│   ├── matrix.ts                bouwt scenario combinaties uit specs
│   ├── discovery/               route prober + tier availability detector
│   ├── playwright/              browser pool, walkthrough, stripe driver, network recorder, locale asserts
│   ├── verification/            stripe observer, webhook observer (vastgoed_core.checkout_events), database observer (vastgoed_core.user_memberships)
│   ├── ai/                      Claude system prompt + auditor + Zod output schema
│   ├── reports/                 CHECKOUT_AUDIT_REPORT.md + PRIORITY_FIX_QUEUE.md renderers
│   ├── approvals/               critical/high finding → aquier_approvals row
│   ├── runner/                  audit-runner (orchestrator) + scenario-runner
│   └── cli/                     run-once.ts voor lokaal debuggen
└── tests/
    └── run-tests.ts             unit tests (matrix, specs, locale asserts, priority ranking)
```

## Setup

```bash
cd checkout-auditor
npm install
npx playwright install chromium webkit
cp .env.example .env  # vul SUPABASE_*, ANTHROPIC_API_KEY, STRIPE_RESTRICTED_KEY_TEST, TELEGRAM_*
```

**Supabase Storage:** maak bucket `checkout-audit-artifacts` aan in Supabase dashboard, privé, RLS `service_role` only.

**Stripe key:** maak een **restricted** key in Stripe Dashboard met alleen `Read` permissies op Customer, Checkout Session, Subscription, Invoice, Event. Test-mode key (`rk_test_...`).

## Run

```bash
# Lokale unit tests
npm test

# Discovery alleen — NL
npm run cli:discover -- --country=NL

# Eén scenario live
npm run cli:scenario -- --tier=explorer --country=NL --device=desktop_chrome --cycle=monthly

# Volledige audit (cap op 20 scenarios per default)
npm run cli:audit -- --max=20

# Server start
npm run dev
```

## Productie deploy

`render.yaml` definieert `orlando-checkout-auditor` (port 3008). `playwright install chromium webkit` zit in buildCommand.

Vercel cron forwarders in `frontend/app/api/checkout-audit/cron/*/route.ts`:
- 03:00 NL — discovery
- 04:00 NL — daily audit
- Zondag 02:00 — artifact cleanup

## Schema (Supabase migration 084)

- `aquier_audit_runs` — per audit run
- `aquier_audit_discovery_snapshots` — wat aquier.com per land aanbiedt
- `aquier_audit_scenarios` — per scenario observations
- `aquier_audit_artifacts` — screenshots/HAR/videos in Supabase Storage
- `aquier_audit_findings` — Claude output
- `aquier_audit_priority_queue` — top-N findings gesorteerd op severity × revenue impact

## Guarantees

- **Geen mock data.** Alle Playwright runs draaien tegen live aquier.com.
- **Test-mode only voor Stripe.** Cards uit `stripe-test-cards.json` zijn allemaal test-mode cards (4242…, 4000…). Nooit production payments.
- **Read-only Stripe key vereist.** `STRIPE_RESTRICTED_KEY_TEST` mag geen Write permissions hebben.
- **Geen wijziging aan aquier.com.** Auditor is uitsluitend observerend.
