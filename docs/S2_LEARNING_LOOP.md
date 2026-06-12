# S2 — Learning Loop · oplevering

> Onderdeel van **AUTONOMOUS GROWTH PHASE 1** (P0). Status: **code-compleet in branch `feat/cf2-stronger-model-track`**, wacht op deploy (CI) + toepassen migratie 194.

## Uitgangspunt (live geverifieerd 12-06)
De winner/loser/pattern-analyse **bestond al** als live views over álle videos — niet gedupliceerd:
- `v_hook_classified` = **5492** geclassificeerde videos (niche, hook-categorie, winner_status, hook_score)
- `v_winner_patterns` (21) · `v_loser_patterns` (26) · `v_hook_patterns` (win-rate per niche×categorie) · `v_winner_intelligence` (63)

Wat ontbrak: (a) een **expliciet per-video leerrecord** en (b) een **persistente, consumeerbare strategy-recommendations-laag** (deliverable 5). Dat levert S2.

## Wat S2 oplevert (deliverables 1-5)

| # | Deliverable | Hoe | Bestand |
|---|---|---|---|
| 1 | Learning checkpoints / leerrecord | `v_video_learning` — per video een `leerpunt` (winner/loser/neutraal). "Iedere video levert leerpunten op." | migratie 194 |
| 2 | Pattern extraction | Bestaande `v_hook_patterns`/`v_*_patterns` (hergebruikt) | — |
| 3 | Winner analysis | Bestaande `v_winner_patterns` / `v_winner_intelligence` | — |
| 4 | Loser analysis | Bestaande `v_loser_patterns` | — |
| 5 | Strategy recommendations | **Nieuw**: tabel `content_strategy_recommendations` + `generate_content_strategy_recommendations()` + view `v_content_recommendations_current` | migratie 194 |
| + | Autonome run | Vercel-cron `learning-recommendations` (10:50, na analytics) roept de generator-RPC aan | `api/youtube/cron/learning-recommendations/route.ts`, `vercel.json` |
| + | Engine Planner | `content:learning-loop` + `content:strategy-recommendations` | migratie 194 |
| + | Dashboard | API + `LearningRecommendationsCard` (winners/losers + aanbevelingen) | `api/media-holding/metrics/learning`, monetization-view |

## Aanbevelings-logica (read-only gevalideerd op live data)
Win-rate = **winners/(winners+losers)** over de duidelijk geclassificeerde videos (niet winners/total — dat verwatert met neutrale videos). Bij `decided ≥ 4`:
- `win ≥ 55%` → **increase** ("produceer meer")
- `win ≤ 15%` + `losers ≥ 3` → **stop**
- `win < 35%` → **reduce**
- anders → **test** (A/B)

Live-uitkomst nu: **3 increase, 5 test, 2 reduce, 1 stop** — bv. *vastgoed_education_nl × money 67% → increase*; *vastgoed_education_nl × authority 0% (4 losers) → stop*; *finance_education_nl × money 32% → reduce*.

## Hoe de loop sluit
`youtube_video_analytics` (S1: views/retention/CTR) → `v_hook_classified` (classificatie) → `v_hook_patterns` (win-rate) → **generator** → `content_strategy_recommendations` → consumeerbaar via `v_content_recommendations_current` door producer/director/dashboard. Hoe meer CTR-data binnenkomt (S1), hoe scherper de aanbevelingen.

## DoD-interpretatie
"Geen publicatie zonder leerresultaat" is geïmplementeerd als **enrollment, niet als blokkade**: elke geclassificeerde video heeft een rij in `v_video_learning` met een `leerpunt`. Een harde publish-gate is bewust vermeden — die zou de werkende publicatie-pijplijn (927 verified_live) breken, en bij organische YouTube leer je ná publicatie.

## Verificatie na deploy
1. Pas migratie 194 toe (CI/pipeline).
2. Trigger cron: `GET /api/youtube/cron/learning-recommendations` met `Authorization: Bearer <CRON_SECRET>` → `recommendations_generated > 0`.
3. `select action, count(*) from content_strategy_recommendations where status='active' group by action;`
4. Dashboard `/dashboard/media-holding/monetization` → card "Learnings & aanbevelingen".
5. Per-video: `select * from v_video_learning limit 20;`

## Niet in scope (volgt)
S3 Winner replication (P1) — bouwt op deze aanbevelingen + bestaande `winner-replication.ts`. S4 Revenue engine, S5 Director repair, S6 Autonomous growth mode.
