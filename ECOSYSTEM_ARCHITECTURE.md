# ORLANDO ECOSYSTEEM — ARCHITECTUUR & STRUCTUUR
**Versie:** 1.0  
**Datum:** 2026-05-18  
**Status:** DEFINITIEF — single source of truth voor alle bouwsessies

---

## 0. REGEL: LEES DIT EERST

Elke bouwsessie begint met het lezen van dit document.  
Geen nieuwe module, route, worker of tabel zonder dit document te checken.

---

## 1. ECOSYSTEEM TOPOLOGY

```
┌─────────────────────────────────────────────────────────────────────┐
│                        ORLANDO ECOSYSTEEM                           │
│                                                                     │
│   ┌───────────────────────────────────────────────────────────┐    │
│   │              DATA LAYER (OS Vastgoed)                     │    │
│   │  Scraping · Intelligence · ROI · AI Scoring · Distress    │    │
│   │         vastgoed_core schema · Render executor            │    │
│   └────────────────────────────┬──────────────────────────────┘    │
│                                │ aquier_listings, scraper data      │
│   ┌────────────────────────────▼──────────────────────────────┐    │
│   │           COMMERCE LAYER (Aquier.com)                     │    │
│   │  Memberships · Deals · Checkout · Reports · Upsells       │    │
│   │     vastgoed_core schema · Vercel front · Stripe          │    │
│   └────────────────────────────┬──────────────────────────────┘    │
│                                │ events, finance, metrics           │
│   ┌────────────────────────────▼──────────────────────────────┐    │
│   │         AUTOMATION LAYER (Orlando Core OS)                │    │
│   │  Finance · Agents · Workflows · Mail · YouTube · OSIL     │    │
│   │        public schema · Vercel front · Render back         │    │
│   └────────────────────────────┬──────────────────────────────┘    │
│                                │                                    │
│   ┌────────────────────────────▼──────────────────────────────┐    │
│   │                 CAPITAL LAYER (toekomst)                  │    │
│   │         Investor Network · Deal Syndication               │    │
│   └───────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. DE 3 PLATFORMS

### 2.1 Orlando Core OS
**Rol:** Centrale AI operationele cockpit. Intern gebruik door Orlando.  
**Repo:** `orlando-core-os`  
**Frontend:** Vercel — `orlando-core-os/frontend/`  
**DB schema:** `public`  
**URL:** intern (geen publiek domein)

**Wat het doet:**
- AI agent orchestration (OSIL, CFO, Advocaat)
- Finance monitoring (Moneybird, Stripe sync, cashflow)
- Workflow & automation management
- Mail engine (IMAP, classificatie, AI drafts)
- YouTube netwerk beheer
- Operations center (queue monitoring, scheduler)
- Personeel & HR
- Bouwplaats management
- Personal finance (DYME, Tink banklink)

**Wat het NIET doet:**
- Geen vastgoed scraping
- Geen investor checkout of memberships
- Geen publieke pagina's
- Geen Stripe subscriptions

---

### 2.2 OS Vastgoed
**Rol:** Internationale vastgoed intelligence engine.  
**Repo:** `vastgoedscapler-saas`  
**Executor:** Render — `vastgoed-core-executor/`  
**Backend API:** Render — `vastgoed-core-back/`  
**DB schema:** `vastgoed_core`

**Wat het doet:**
- Vastgoed scraping (45 scrapers, 15 landen actief)
- Data normalisatie en opslag
- ROI berekening per deal
- AI deal scoring (claude-sonnet)
- Distress detectie
- CRE (commercieel vastgoed) analyse
- Off-market intelligence
- Country intelligence (per land marktanalyse)
- Scraper health monitoring & ban prevention
- Property enrichment

**Wat het NIET doet:**
- Geen investor-facing UI
- Geen Stripe of memberships
- Geen publieke marketplace
- Geen checkout

---

### 2.3 Aquier.com
**Rol:** Internationaal investor commerce platform.  
**Repo:** `vastgoedscapler-saas` (submap `vastgoed-core-front/`)  
**Frontend:** Vercel — `vastgoed-core-front/`  
**DB schema:** `vastgoed_core` (gedeeld met OS Vastgoed)  
**Domein:** aquier.com  
**Stripe:** acct_1TWvNg8CCmvrqg0b

**Wat het doet:**
- Publieke marketplace voor investeerders
- Membership subscriptions (Explorer/Developer/Black/Institutional)
- International checkout (per land: valuta, VAT, payment methods)
- Premium dealflow (tier-gated visibility)
- Investor reports (PDF/Excel)
- Deal alerts, watchlist, pipeline
- Referral systeem
- AI support drafting

**Wat het NIET doet:**
- Geen scraping
- Geen ruwe data processing
- Geen interne operations
- Geen Orlando-specifieke tooling

---

## 3. GEDEELDE INFRASTRUCTUUR

| Component | Eigenaar | Details |
|-----------|---------|---------|
| **Auth** | Supabase Auth | Gedeeld project — één login werkt op beide platforms |
| **DB** | Supabase Postgres | `public` schema = Orlando Core OS; `vastgoed_core` schema = OS Vastgoed + Aquier |
| **Storage** | Supabase Storage | Buckets: `reports`, `bewijs`, `documents`, `avatars` |
| **Frontend hosting** | Vercel | Aparte projecten per platform |
| **Backend/Workers** | Render | FastAPI services per platform |
| **Task queue** | Supabase | `vastgoed_core.task_queue` (OS Vastgoed/Aquier), `public.agent_tasks` (Orlando Core OS) |
| **Communicatie** | Telegram | Één bot, multi-channel routing per platform |
| **Versioning** | GitHub | `oamatiskak-star/orlando-core-os`, `oamatiskak-star/vastgoedscapler-saas` (=aquire) |
| **Email** | Resend | Transactioneel per platform |
| **Boekhouding** | Moneybird | Gekoppeld via Finance Agent (Orlando Core OS) |

---

## 4. LANDENSTRUCTUUR — DEFINITIEF

### Tier 1 (actief, volledig prioriteit)

| # | Land | Code | Valuta | VAT | Payment Methods | Scrapers |
|---|------|------|--------|-----|-----------------|---------|
| 1 | Nederland | NL | EUR | 21% | iDEAL, Klarna, SEPA, card | funda, jaap, pararius, makelaarsland, vbo, huislijn, veilingnotaris, rechtbank_nl, funda_business |
| 2 | België | BE | EUR | 21% | Bancontact, Klarna, SEPA, card | immoweb, logic_immo |
| 3 | Duitsland | DE | EUR | 19% | Klarna, SEPA, card | immoscout24, immowelt, wohnungsboerse, immoscout_gewerbe |
| 4 | Frankrijk | FR | EUR | 20% | Klarna, SEPA, card | seloger, leboncoin, pap, logic_immo |
| 5 | United Kingdom | UK | GBP | 20% | card | rightmove, zoopla, onthemarket, allsop |
| 6 | United States | US | USD | — | ACH, card | zillow, redfin, realtor_com, crexi, loopnet |
| 7 | Spanje | ES | EUR | 21% | Klarna, SEPA, card | idealista, fotocasa, habitaclia |
| 8 | Portugal | PT | EUR | 23% | MB WAY, SEPA, card | idealista, casa_sapo, imovirtual |
| 9 | United Arab Emirates | AE | AED | 5% | card | propertyfinder, bayut, dubizzle |
| 10 | Italië | IT | EUR | 22% | Klarna, SEPA, card | immobiliare |

### Tier 2 (actief, standaard prioriteit)

| # | Land | Code | Valuta | VAT | Payment Methods | Scrapers |
|---|------|------|--------|-----|-----------------|---------|
| 11 | Zwitserland | CH | CHF | 8.1% | card, SEPA | homegate, immoscout_ch |
| 12 | Australië | AU | AUD | 10% | card | domain, realestate_com_au, commercial_re_au |
| 13 | Canada | CA | CAD | 5% | card | realtor_ca, kijiji_ca |
| 14 | Singapore | SG | SGD | 9% | card | propertyguru, ninety_nine |
| 15 | Thailand | TH | THB | 7% | card | dotproperty, hipflat |

### Toekomst (niet bouwen vóór Q1 2027)

Mexico (MX), Brazilië (BR), Turkije (TR), India (IN), Indonesië (ID)

### Landen in frontend maar ZONDER scraper — actie vereist

Oostenrijk (AT), Zweden (SE), Noorwegen (NO), Denemarken (DK), Finland (FI)  
→ Verwijderen uit `/vastgoed/page.tsx` OF scrapers toevoegen. Keuze vastleggen.

---

## 5. ARCHITECTUURREGELS — VERPLICHT

### Anti-patterns (verboden)

```
❌  Nieuwe auth per product
❌  Supabase client rechtstreeks voor write-heavy ops vanuit frontend
❌  Workers die task_queue omzeilen
❌  Frontend die wacht op executor (sync pattern)
❌  Cross-product imports (geen `vastgoed_core` imports in Orlando Core OS frontend)
❌  Service-role key in frontend bundle
❌  Placeholders, mocks, testpagina's in main branch
❌  Snippets committen — altijd volledige bestanden
❌  Migraties vóór code — schema first, altijd
❌  `public` schema gebruiken voor vastgoed_core data of vice versa
```

### Verplichte patronen

```
✅  UI wacht nooit op executor — altijd async/optimistic
✅  Één knop = één taak
✅  project_id / organization_id altijd backend-bepaald
✅  Migration vóór API route vóór UI
✅  PORT-CANDIDATE comment bij code die later geport wordt
✅  Elke nieuwe module: migration → API route → dashboard page
✅  Auth-check op ELKE API route (service-role of session)
✅  Rol-check via vastgoed_core.organization_members (Aquier/OS Vastgoed)
✅  Rol-check via public.user_roles (Orlando Core OS)
```

---

## 6. QUEUE OWNERSHIP

| Queue | Tabel | Schrijft | Leest | Worker |
|-------|-------|---------|-------|--------|
| OS Vastgoed tasks | `vastgoed_core.task_queue` | Aquier crons + verzamelaar API | vastgoed-core-executor | `claim_task` RPC (FOR UPDATE SKIP LOCKED) |
| Orlando Core OS tasks | `public.agent_tasks` | Orlando Core OS API routes | orlando-core-os executor | polling 5s |
| Scraper health | `vastgoed_core.scraper_sources` | verzamelaar_scheduler | scraper-health-check cron | — |

---

## 7. FINANCIËLE FLOW

```
Klant betaalt op Aquier.com
         │
         ▼
    Stripe Checkout
         │
         ▼
  Stripe Webhook (/api/webhooks/stripe)
         │
    ┌────┴────────────────────────┐
    │                             │
    ▼                             ▼
Membership activeren       Moneybird factuur aanmaken
(Supabase user_memberships) (via Finance Agent / Moneybird API)
    │
    ▼
Report genereren (generate-reports cron)
    │
    ▼
PDF opslaan in Supabase Storage (bucket: reports)
    │
    ▼
Email via Resend (rapport gereed)
    │
    ▼
Upsell sequence starten (als applicable)
```

**Orlando Core OS Finance Agent doet:**
- Moneybird facturen sync (purchase → Moneybird contact + factuur)
- Cashflow monitoring over alle BV's
- Debiteuren opvolging
- BTW-aangifte voorbereiding

---

## 8. NAMING CONVENTIONS

### Database migraties

```
Orlando Core OS:   NNN_beschrijving.sql           (001_initial.sql, 034_advocaat_geheugen.sql)
OS Vastgoed:       NNN_beschrijving.sql           (010_verzamelaar_countries_sources.sql)
Dubbele nummers:   vermijden — check bestaande lijst
```

### API routes

```
/api/[module]/route.ts              (GET + POST)
/api/[module]/[id]/route.ts         (GET + PATCH + DELETE)
/api/admin/[module]/route.ts        (admin-only, check organization_members)
/api/cron/[naam]/route.ts           (Vercel cron, check CRON_SECRET header)
/api/webhooks/[service]/route.ts    (externe webhooks)
```

### Dashboard pagina's

```
/dashboard/[module]/page.tsx
/dashboard/[module]/[sub]/page.tsx
/admin/[module]/page.tsx            (Aquier admin)
```

### Executor workers (OS Vastgoed)

```
executor/scrapers/[bron].py         (één scraper per bestand, camelCase class naam)
executor/tasks/[task_type].py       (één task per bestand, class erft van Task)
executor/sources/[bron].py          (externe data bronnen, niet vastgoed scrapers)
```

### Executor workers (Orlando Core OS)

```
executor/workers/[naam]_worker.py   (funda_monitor.py, moneybird_sync.py)
```

### React componenten

```
components/[module]/ComponentName.tsx    (PascalCase, één component per bestand)
components/nav/Navbar.tsx
components/home/LeadCaptureSection.tsx
```

---

## 9. DEFINITION OF DONE — PER MODULE TYPE

### Nieuwe dashboard module

- [ ] Migration aangemaakt en applied (schema first)
- [ ] API route(s) aangemaakt met auth-check
- [ ] Dashboard page aangemaakt (geen mock data)
- [ ] Navigatie link toegevoegd aan sidebar
- [ ] TypeScript zonder errors
- [ ] Volledige bestanden gecommit (geen snippets)

### Nieuwe scraper (OS Vastgoed)

- [ ] Scraper class in `executor/scrapers/[naam].py` (erft van BaseScraper)
- [ ] Toegevoegd aan scraper_sources seed migration
- [ ] Land en tier correct in scrapers_per_country.csv
- [ ] Wired in verzamelaar_scrape task
- [ ] Country config toegevoegd aan `/vastgoed/[country]/page.tsx`
- [ ] Getest op 1 pagina zonder ban

### Nieuwe Aquier cron

- [ ] Route in `app/api/cron/[naam]/route.ts`
- [ ] CRON_SECRET header check aanwezig
- [ ] Entry in `vercel.json` crons array
- [ ] Telegram alert bij failure
- [ ] Gedocumenteerd in ARCHITECTURE.md cron tabel

### Nieuwe automation (Orlando Core OS)

- [ ] Trigger duidelijk (manual / cron / webhook)
- [ ] Worker in executor of API route
- [ ] Task queue entry als async werk nodig
- [ ] Telegram notificatie bij succes/failure

---

## 10. DYNAMISCHE LAGEN — STATUS OVERZICHT

| Laag | Status | Locatie |
|------|--------|---------|
| Dynamic checkout (payment methods per land) | ✅ Klaar | `api/checkout/route.ts` PM_MAP |
| Dynamic pricing (country_pricing_rules) | ✅ Schema klaar, seeden nodig | `vastgoed_core.country_pricing_rules` |
| Dynamic layout engine | ❌ Niet gebouwd | — |
| Dynamic SEO engine (per land pages/blogs) | ❌ Niet gebouwd | — |
| Dynamic trust engine (badges per land) | ❌ Niet gebouwd | — |
| AI behavioral engine | ❌ Niet gebouwd | — |
| Upsell intelligence engine | ❌ Niet gebouwd | — |
| Investor AI profiling | ❌ Niet gebouwd | — |

---

## 11. GIT BRANCHES & DEPLOYMENT

| Platform | Branch | Deploy target |
|---------|--------|--------------|
| Orlando Core OS | `main` | Vercel (auto) |
| OS Vastgoed executor | `main` | Render (auto via render.yaml) |
| Aquier.com frontend | `main` | Vercel (auto, root dir: vastgoed-core-front) |
| Aquier.com backend | `main` | Render (auto via render.yaml) |

**Supabase migraties:** handmatig via Supabase dashboard of CLI.  
**Nooit force push naar main.**

---

## 12. ENV VARS — VERANTWOORDELIJKHEDEN

### Orlando Core OS (Vercel)
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,  
`MONEYBIRD_API_KEY`, `MONEYBIRD_ADMINISTRATION_ID`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`,  
`TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `TINK_CLIENT_ID`, `TINK_CLIENT_SECRET`,  
`RESEND_API_KEY`, `YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET`

### Aquier.com (Vercel)
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,  
`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`,  
`RESEND_API_KEY`, `MONEYBIRD_API_KEY`, `MONEYBIRD_ADMINISTRATION_ID`, `MONEYBIRD_TAX_RATE_ID_NL`,  
`BACKEND_URL`, `CRON_SECRET`, `UNSUB_SECRET`, `NEXT_PUBLIC_SITE_URL`, `AUTH_INVITE_REDIRECT_URL`

### Vastgoed executor (Render)
`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`,  
`TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `BACKEND_URL`
