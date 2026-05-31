# Render Cost Audit (P7)

Classificatie van alle Render-services + advies om kosten te drukken door
workloads naar CLI-L/CLI-R te verschuiven vóór nieuwe cloud-capaciteit.

**Bron:** `render.yaml` (9 services + redis). **Caveat (no-mock):** exacte kosten +
duty-cycle/CPU vereisen de Render API/dashboard (`RENDER_API_KEY`). Bedragen hieronder
zijn **plan-schattingen** (starter ≈ $7/mnd, standard ≈ $25/mnd), te verifiëren.

## Classificatie

| Service | Type / plan | Klasse | Reden |
|---|---|---|---|
| `orlando-hermes` | web / starter | **A — kritisch** | Orchestration-brein + escalatie-webhook (Telegram). Moet 24/7 cloud. |
| `orlando-redis` | redis / starter | **A — kritisch** | Queue-backbone (BullMQ). Cloud houden. |
| `orlando-watchdog` | web / starter | **A — kritisch** | Bewaakt alle services + auto-recovery. Cloud houden. |
| `orlando-youtube-engine` | worker / starter | **A — kritisch** | Revenue (YPP uploads/verificatie), continu. Cloud. |
| `orlando-executor` (planning-engine) | worker / starter | **A — kritisch** | Task-executor / AO-flow. Cloud. |
| `orlando-mail-engine` | web / starter | **B — samenvoegbaar** | Mail-intake; lage duty-cycle. Kandidaat om met executor te bundelen of cron-gedreven te maken. |
| `orlando-executive-engine` | web / starter | **B — samenvoegbaar** | Cron-gedreven Anthropic-agents (ATLAS e.a.), lage duty-cycle. |
| `orlando-acquisition-engine` | web / starter | **B — samenvoegbaar** | Idem cron-gedreven. **Advies: merge executive+acquisition → 1 "intelligence-engine"** (−$7/mnd). |
| `orlando-checkout-auditor` | web / **standard** | **C — lokaal (CLI-R)** | Playwright/Chromium, draait op schema (niet 24/7). Zwaarste plan. **Verplaats naar CLI-R** → −$25/mnd. |
| `orlando-competitor-scanner` | worker / starter | **D — uitschakelen** | Per geheugen al `paused` + overlapt met `competitor-intel-engine` (draait lokaal op CLI-L PM2). **Suspend** → −$7/mnd. |

## Besparingsadvies (geschat)
1. **`orlando-checkout-auditor` → CLI-R** (PM2 + `npx playwright install chromium`). Standard-plan vrij → **≈ −$25/mnd**. Cron blijft via Vercel forwarders.
2. **`orlando-competitor-scanner` suspenden** (overlapt lokaal) → **≈ −$7/mnd**.
3. **`executive-engine` + `acquisition-engine` mergen** tot één cron-gedreven intelligence-service → **≈ −$7/mnd**.
4. (Optioneel) **`mail-engine`** cron-gedreven of bundelen → **≈ −$7/mnd**.

**Geschatte besparing: ~$39–46/mnd** (≈40–50% van de huidige Render-rekening) zonder verlies van functionaliteit, door zware/periodieke workloads naar CLI-L/CLI-R te verschuiven.

## Lokale-eerst regel (CLI-L/CLI-R)
Draai vóór nieuwe cloud-services lokaal: **scraping, OCR, AI-analyse, rendering, bulk-processing**. CLI-R (heavy workers) is hiervoor bedoeld; de Hermes-dispatcher (`hermes.dispatch_queue`) routeert het werk.

## Klasse A blijft cloud
hermes · redis · watchdog · youtube-engine · executor — 24/7 kritisch, niet lokaal verplaatsen.

## Verificatie (vereist Render API/dashboard)
```
GET https://api.render.com/v1/services        # exacte plan + status per service
GET https://api.render.com/v1/services/{id}/metrics   # CPU/mem duty-cycle → bevestig B/C-kandidaten
```
Met `RENDER_API_KEY` kan een vervolgstap (P7.1) de exacte kosten + werkelijke duty-cycle ophalen en deze klasse-indeling hard maken, plus de suspends/merges via de API uitvoeren.
