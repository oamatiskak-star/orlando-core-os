# S5 — Director Repair · oplevering

> Onderdeel van **AUTONOMOUS GROWTH PHASE 1** (P1). Status: **code-compleet in branch `feat/cf2-stronger-model-track`**, wacht op deploy + migratie 197.

## Probleem (live geverifieerd 12-06)
`director_cycles` = 2 rijen (2026-06-02). De **plan-fase faalde** met `llm_status='error'` → *"Claude 400: invalid_request_error"*. De LLM-plan-call is kapot (model/credits, vgl. C4). De verify-fase werkte wél (data-driven). Sinds 10 dagen geen director-cyclus.

## Oplossing
**Credit-vrije, data-gedreven director.** Beslissingen (meer/minder/stoppen/opschalen) worden afgeleid uit kanaal-ranking (echte analytics) i.p.v. een LLM. Schrijft een `director_cycles` plan-rij met `llm_status='skipped_data_driven'` — geen error meer.

## Wat S5 oplevert (deliverables 1-5)

| # | Deliverable | Hoe | Bestand |
|---|---|---|---|
| 1 | Director cycle herstellen | `generate_director_decisions()` schrijft credit-vrij een `director_cycles` plan-rij | migratie 197 |
| 2 | Weekly review | Vercel-cron `director-cycle?period=weekly` (ma 07:00) | cron + vercel.json |
| 3 | Monthly review | Vercel-cron `director-cycle?period=monthly` (1e 08:00) | cron + vercel.json |
| 4 | Kanaal-ranking | `v_channel_ranking` (views/revenue/CTR-percentielen + 7d/30d-trend uit youtube_video_analytics) | migratie 197 |
| 5 | Niche-ranking | `v_niche_ranking` (win-rate per niche) | migratie 197 |
| + | Beslissingen | tabel `director_decisions` + `v_director_decisions_current` | migratie 197 |
| + | Dashboard | API `metrics/director` + `DirectorDecisionsCard` | dashboard |

## Beslissingslogica (rank-gebaseerd, robuust)
Per kanaal, op basis van rang-percentiel (`pct`) + 7d/30d-trend:
- `datapoints < 3` → **hold** (te weinig data)
- bodemkwartiel + `<1500` views/30d + dalend → **stop**
- `trend < 0.30` (hard dalend) → **reduce**
- `trend ≥ 1.10` + bovenste helft → **scale_up**
- top-derde → **maintain**
- onderste 45% → **reduce**
- anders → **maintain**

Rang-gebaseerd zodat het robuust blijft zolang CTR/revenue (S1) nog 0 zijn; scherper zodra die data stroomt.

## Read-only gevalideerd op live data
Beslissingen kloppen en zijn eerlijk: **LoopForge AI** (rank 1, 42.553 views/30d, vlak) → *maintain*; **BrickPulse Lab** (rank 2 maar trend 0 — was groot, nu dood) → *reduce*; de dalende NL-kanalen (VastgoedTv/VermogenTv/CryptoVermogen) → *reduce*. Geen *scale_up* vandaag (correct: geen top-kanaal dat óók groeit).

## DoD
"Hermes kan zelfstandig bepalen: meer / minder / stoppen / opschalen" → ✅ via `director_decisions` (per kanaal een actie + onderbouwing), wekelijks + maandelijks ververst, zonder menselijke of LLM-tussenkomst.

## Verificatie na deploy
1. Migratie 197 toepassen.
2. Trigger: `GET /api/youtube/cron/director-cycle?period=weekly` met `Authorization: Bearer <CRON_SECRET>` → `result.decisions > 0`.
3. `select action, count(*) from director_decisions where generated_at::date=current_date group by action;`
4. `select * from director_cycles order by created_at desc limit 1;` → plan-rij, `llm_status='skipped_data_driven'` (geen error).
5. Dashboard `/dashboard/media-holding/monetization` → "Director — kanaalbeslissingen"-card.

## Niet in scope (volgt)
S6 Autonomous growth mode (P2): budget/resource-allocatie + groei-forecast + kanaal/niche-prioritering tot één instructie ("maak kanaal X €10k"). De LLM-narratie-laag bovenop de data-driven beslissingen is optioneel (zodra Anthropic-credits er zijn).
