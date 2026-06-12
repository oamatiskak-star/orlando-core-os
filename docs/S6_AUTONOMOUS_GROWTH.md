# S6 — Autonomous Growth Mode · oplevering (capstone)

> Onderdeel van **AUTONOMOUS GROWTH PHASE 1** (P2). Status: **code-compleet in branch `feat/cf2-stronger-model-track`**, wacht op deploy + migratie 198.

## Doel
Van contentmachine naar groeimachine: brengt S1-S5 samen tot **autonome prioritering + allocatie**. Hermes kiest zelfstandig welk kanaal prioriteit krijgt, welke niche wordt uitgebreid en welke wordt beëindigd.

## Eerlijke kadering
Kanalen zijn niet gemonetiseerd → er is **geen geldbudget**. "Budget/resource allocation" = **productiecapaciteit** (video's/dag) verdelen naar groeiscore — de autonome "waar-investeer-ik-effort"-beslissing. De monetaire budget-laag (ad-spend/affiliate-budget) activeert zodra die bestaat.

## Wat S6 oplevert (deliverables 1-5)

| # | Deliverable | Hoe | Bestand |
|---|---|---|---|
| 1 | Kanaal-scoring | `v_channel_growth_score` = ranking × trend-modifier × director-actie-modifier | migratie 198 |
| 2 | Niche-scoring | `v_niche_scoring` (expand/maintain/reduce/terminate op win-rate) | migratie 198 |
| 3 | Budget/capaciteit-allocatie | `growth_allocations` + `generate_growth_plan()` (video's/dag ∝ groeiscore) | migratie 198 |
| 4 | Resource-allocatie | idem — productiecapaciteit per kanaal | migratie 198 |
| 5 | Growth forecasting | `v_growth_forecast` (30d-views-projectie + afstand tot YPP-drempel) | migratie 198 |
| + | Autonoom | Vercel-cron `growth-plan` (ma 07:30) | cron + vercel.json |
| + | Dashboard | API `metrics/growth` + `GrowthPlanCard` (prioriteitskanaal + allocatie-balken + expand/terminate) | dashboard |

## Hoe het de keten sluit
S1 (meten) → S2 (leren) → S3 (winners repliceren) → S4 (monetiseren/attributie) → S5 (director-beslissingen per kanaal) → **S6 (prioritering + capaciteitsallocatie + forecast)**. De groeiscore neemt de director-actie mee (`scale_up`×1.3, `reduce`×0.6, `stop`×0). Het groeiplan zegt: **dit kanaal eerst, zóveel video's/dag, déze niches uitbreiden, déze beëindigen.**

## Read-only gevalideerd op live data
Capaciteitsallocatie (50 video's/dag): **LoopForge AI** → prio 1, 23,7% capaciteit, **12/dag**; *BrickPulse* (trend 0) gedempt → 7/dag; aflopend tot **AquierTvEs** (bijna dood) → **0/dag**. Reëel en gedoseerd; de winner krijgt de capaciteit, de dode kanalen niets.

## DoD
"Hermes kiest zelfstandig: welk kanaal prioriteit / welke niche uitbreiden / welke beëindigen" → ✅ via `growth_allocations` (prioriteitsrang + video's/dag per kanaal) + `v_niche_scoring` (expand/terminate). Wekelijks autonoom ververst.

## Verificatie na deploy
1. Migratie 198 toepassen (ná 197).
2. Trigger: `GET /api/youtube/cron/growth-plan?capacity=50` met `Authorization: Bearer <CRON_SECRET>` → `result.priority_channel` gezet, `allocations > 0`.
3. `select channel_name, priority_rank, videos_per_day from v_growth_plan_current order by priority_rank;`
4. `select niche, niche_action from v_niche_scoring where niche_action in ('expand','terminate');`
5. Dashboard `/dashboard/media-holding/monetization` → "Autonomous Growth Plan"-card.

## Naar de eindtest
Met S1-S6 staat de volledige commerciële feedbackloop **in code**. De eindtest ("Hermes, maak van kanaal X een €10k/maand-kanaal") wordt uitvoerbaar zodra: (a) migraties 193-198 toegepast + branch gedeployd, (b) de externe activatie rond is — **YPP-monetisatie** (S1-revenue), **AFFILIATE_WEBHOOK_SECRET + affiliate-links** (S4), en de **CF2-producer enabled** (zodat S3/S6-allocaties echt geproduceerd worden). De LLM-narratielaag bovenop de data-driven beslissingen is optioneel (zodra Anthropic-credits er zijn).
