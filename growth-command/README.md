# Growth Command

Backend command-center voor **Aquier Growth OS** — twee launch-kritische tools, **read-only** tegen productie (geen DB-writes, geen prod-COMMIT).

## Tools

### 1. Would Buy Runner (`would-buy`)
Simuleert per product, per koperspersona of er gekocht zou worden. Levert per persona: **koopkans-score (0-100)**, **bezwaren**, **kooptriggers**, en geaggregeerd **verbeteradvies** per product.
- Met `ANTHROPIC_API_KEY` → echte LLM-simulatie (Claude).
- Zónder key → deterministische fallback (draait toch, gelabeld als schatting).

```bash
npm run would-buy                 # alle producten
npm run would-buy scout developer # specifieke producten
npm run would-buy -- --save       # schrijf JSON naar ./reports
```

### 2. Hermes Launch Command (`launch-tracker`)
Dagelijks launch-rapport (eerste 30 dagen): omzet, memberships, checkout-status, leads, affiliate, **First €10K sprint-voortgang** en **blockers** met `PASS/WARNING/FAIL`. Exit-code 2 bij FAIL (voor cron/alerting).

```bash
npm run launch-tracker            # print rapport
npm run launch-tracker -- --save  # schrijf markdown naar ./reports
```

## Setup
```bash
cp .env.example .env   # vul SUPABASE_SERVICE_ROLE_KEY (+ optioneel ANTHROPIC_API_KEY) in
npm install
npm run would-buy
npm run launch-tracker
```

## Veiligheid
- **Alleen `.select()` / count** — nergens insert/update/delete. Geen prod-COMMIT.
- Leest `vastgoed_core` (memberships/rapporten/checkout/leads) + `public` (affiliate) via de service-role key.
- Niet toegevoegd aan `ecosystem.config.js` → **start niet automatisch**. Optioneel handmatig of via cron:

```js
// OPTIONEEL — pas activeren na akkoord (geen auto-activatie nu)
{
  name: 'growth-launch-tracker',
  cwd: `${BASE}/growth-command`,
  script: 'npx',
  args: 'tsx src/cli.ts launch-tracker --save',
  interpreter: 'none',
  autorestart: false,
  cron_restart: '0 7 * * *', // dagelijks 07:00 — alleen toevoegen als je dit wilt
  env: { NODE_ENV: 'production' },
}
```

## Relatie
- Voedt de **Hermes CGO**-rol uit `AQUIER_REVENUE_ACTIVATION_AUDIT_V1.md` (§Fase 12) en de **First Revenue Tracker** uit `AQUIER_FIRST_EURO_RUNBOOK.md` (§8).
- Catalogus + readiness-labels komen uit `AQUIER_REVENUE_READINESS_AUDIT.md`.
