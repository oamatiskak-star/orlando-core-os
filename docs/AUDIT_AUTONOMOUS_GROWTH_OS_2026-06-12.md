# AUDIT — Autonome €10.000+/maand Kanaalgroeimachine (ORLANDO CORE OS)

> **Auteur:** CLI L1 (`machine_id=cli_l`) · **Datum:** 2026-06-12 · **Modus:** AUDIT ONLY + bouwplan-per-gap (geen code/deploy/migratie).
> **Bewijsbron:** live Supabase `shaunumewswpxhmgbtvv` (orlando-core-os), repo `feat/cf2-stronger-model-track`, `BUILD_TRACKER.md` (recon 2026-06-08), 3 parallelle code-audits.
> **Belangrijk:** alle "0 rijen / draait niet"-claims zijn **live tegen de DB op 2026-06-12 hergeverifieerd**. Waar de
> 8-juni-reconciliatie achterliep op de werkelijkheid, staat de live-correctie hieronder expliciet.

---

## 0. Managementsamenvatting (de harde waarheid)

Het systeem is **productie-kwaliteit code** en de **productie+publicatie-helft draait écht autonoom**.
Maar de **"voel → leer → monetiseer"-helft ontbreekt of staat uit**. Concreet bewijs (live):

**WAT WÉL autonoom draait (live data):**
- **Publiceren:** `youtube_upload_queue` = 3650 rijen · **915 verified_live** · **397 uploads/7d · 56/24u** · laatste upload **2026-06-12 09:02 UTC**. 11/11 kanalen OAuth.
- **Produceren (CF2):** heeft gedraaid — `cf2_jobs` 29 (10 met output) · `cf2_job_steps` 261 · `cf2_visual_decisions` 226 · `cf2_winner_variants` 46. Laatste job **2026-06-12 08:25 UTC**.
- **Competitor-intelligentie:** échte data — `competitor_channels` 36 · `competitor_videos` 1071 · `competitor_signals` 212 · `viral_opportunities` 1841 · `viral_opportunity_snapshots` 13170.
- **Recovery:** watchdog ~60s, PM2-restart, alerts live (`hermes_alerts` 297).

**WAT NIET werkt — de 5 breuken naar €10k (live bevestigd):**
1. **Omzet is onzichtbaar.** `monetization_metrics` = **0** · `affiliate_conversions` = **0** · analytics `estimated_revenue>0` = **0** · `rpm>0` = **0**. Er wordt **geen enkele euro** ergens geregistreerd. Het systeem kan omzet niet zien, laat staan sturen.
2. **CTR onbekend.** `youtube_video_analytics` 943 rijen, retention wél (745), maar **`ctr>0` = 0**. Thumbnail/titel-optimalisatie is blind.
3. **Learning produceert niets.** `video_performance_checkpoints` = **0** · `video_learning_summary` = **0** · `viral_patterns` = **0**. De leerlus is leeg.
4. **Intelligentie-loops staan UIT.** `engine_schedule`: `content:cf2-video-projects-runner=false` · `content:winner-detector=false` · `content:horizon-planner=false`. Winner-DNA → brief-lus draait niet.
5. **Director kapot.** `media:director-plan/verify` staan `enabled` maar `director_cycles` = **2 rijen, beide 2026-06-02**, plan-fase `llm_status=error`. Sinds 10 dagen niet gedraaid.

**Eindoordeel (Fase 7):** ruwe autonomie richting €10k ≈ **30/100**. Het systeem kan vandaag **blind massaproduceren en publiceren**, maar kan een kanaal **niet** naar €10k/maand sturen omdat de hele meet-, leer- en geldketen ontbreekt. De productie-helft bestaat; de commerciële brein-helft niet.

---

## FASE 1 — INVENTARISATIE (19 componenten)

Score: **0**=ontbreekt · **1**=concept · **2**=gedeeltelijk · **3**=werkend · **4**=productie · **5**=autonoom.
Tag: **BESTAAT AL** / **GEDEELTELIJK** / **ONTBREEKT** / **KRITISCH BLOKKEREND**.

| # | Component | Aanw. | Prod-klaar | Live | Echte data | Feedback-loop | Schaalb. | Score | Tag |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Media Factory | ja | deels | observatie | ja (views) | nee | ja | **2** | GEDEELTELIJK |
| 2 | Producer Graph | ja | deels | semi (gated) | ja | deels | matig | **2** | GEDEELTELIJK |
| 3 | Content Factory (CF2) | ja | deels | semi | ja | deels | ja | **3** | GEDEELTELIJK |
| 4 | Winner Engine | ja | deels | **uit** | ja (46 var.) | nee | ja | **2** | KRITISCH BLOKKEREND |
| 5 | Director Cycles | ja | deels | **kapot** | deels | nee | ja | **1** | KRITISCH BLOKKEREND |
| 6 | Analytics (CTR/RPM/retentie) | ja | deels | deels | deels | nee | ja | **2** | KRITISCH BLOKKEREND |
| 7 | Upload Pipelines | ja | ja | **ja** | ja | deels | ja | **4** | BESTAAT AL |
| 8 | Publicatie Pipelines | ja | ja | **ja** | ja | nee | ja | **4** | BESTAAT AL |
| 9 | Competitor Scanners | ja | ja | **ja** | ja | deels | ja | **4** | BESTAAT AL |
| 10 | Trend Detection | ja | deels | semi | ja | nee | ja | **2** | GEDEELTELIJK |
| 11 | Learning Systems | ja | deels | **leeg** | nee | nee | ja | **1** | KRITISCH BLOKKEREND |
| 12 | Strategy Systems | ja | ja | ja (view) | deels | nee | ja | **3** | BESTAAT AL |
| 13 | Autonomous Recovery | ja | ja | **ja** | ja | ja | ja | **4** | BESTAAT AL |
| 14 | Hermes | ja | deels | deels | deels | nee | ja | **3** | GEDEELTELIJK |
| 15 | Build Tracker | ja | ja | **ja** | ja | ja | ja | **4** | BESTAAT AL |
| 16 | Aquier | ja | ja | ja | ja | — | ja | **n.v.t.** | APART (vastgoed) |
| 17 | Funnel Systemen | ja | nee | nee | nee | nee | ja | **1** | KRITISCH BLOKKEREND |
| 18 | Lead Generation | ja | deels | ja (intake) | deels | nee | ja | **2** | GEDEELTELIJK |
| 19 | Revenue Engines | ja | nee | nee | **nee (0)** | nee | ja | **1** | KRITISCH BLOKKEREND |

**Per-component bewijs (kort):**

1. **Media Factory** — `frontend/app/dashboard/media-factory/`, views `v_mf_*` (mig 191). Leest live upload/kanaal/health; **stuurt niets aan** (geen orkestrator emit). → observatorium.
2. **Producer Graph** — `local-agent/src/cf2-producer.ts` gated op `CF2_PRODUCER_RUN/MODE`; schema mig 171 (`cf2_jobs`/`cf2_job_steps`). Heeft output geproduceerd (10 jobs) maar niet op schema.
3. **Content Factory (CF2)** — Vercel-crons `content-factory`/`factory-feeder`/`renderer-dispatch`/`renderer-poll`/`atlas-upload`. **Live bewijs: 29 jobs, 261 steps, 226 visual-decisions, laatste job vandaag.** Maar 10/29 failed, 19 planned-blijven-staan; officiële runner `enabled=false`.
4. **Winner Engine** — mig 167 `winner_detector` + `local-agent/src/winner-replication.ts`. **`cf2_winner_variants`=46** bestaan, maar **`winner_extraction_jobs`=0** en `content:winner-detector=false` → geen lopende DNA-lus.
5. **Director Cycles** — `supabase/functions/director-cycle/`. Schedule `media:director-plan/verify=true`, **maar `director_cycles`=2 (beide 2026-06-02), `llm_status=error`** → kapot/stil.
6. **Analytics** — `youtube_video_analytics` **943 rijen**, retention 745, **CTR 0, RPM 0, est_revenue 0**; `analytics-feedback-worker.ts` schrijft geen CTR/geld. Half-blind.
7. **Upload Pipelines** — `youtube-engine` BullMQ/PM2. **397 uploads/7d**; storage-handoff CF2-pad fragiel (render→/tmp) maar legacy-pad robuust.
8. **Publicatie Pipelines** — `youtube_upload_queue` 915 verified_live, scheduled-publish kolommen actief. Legacy publiceert autonoom; geen performance-feedback terug.
9. **Competitor Scanners** — `youtube-engine/src/competitor-scanner/*`. **Live data: 36 kanalen, 1071 videos, 1841 viral-opps, 13170 snapshots.** Bridge naar `viral_opportunities` werkt.
10. **Trend Detection** — `content_horizon` 29, `content_radar_queue` 160 (gevuld). Maar `viral_patterns`=0 → trends worden niet uit winnaars geleerd; `horizon-planner=false`.
11. **Learning Systems** — `learning-loop-worker.ts` + mig 156/173/175. **Output volledig leeg** (checkpoints/summary/patterns = 0). Lus nooit gesloten.
12. **Strategy Systems** — mig 165 `channel_strategy` **11 rijen**, `v_channel_strategy` live (mode groei/authority/revenue). Producer past rules niet auto-aan.
13. **Autonomous Recovery** — `youtube-engine/src/watchdog.ts`, `OSM_STATE/logs/watchdog.log` live; PM2-restart + alerts. Heartbeat-tuning nodig.
14. **Hermes** — mig 104-150 (core/routing/cutover), 6-laags routing (PR #145-147 merged), `hermes_alerts` 297 actief, `hermes_projects` 3. Routing-brain niet live verwerkend; services niet gedeployed.
15. **Build Tracker** — `BUILD_TRACKER.md` + mig 067/155/181-183, `build_tracker` 75 / `build_tracker_items` 52, dashboard/war-room live. Sync handmatig.
16. **Aquier** — apart vastgoedproduct; deelt alleen Supabase-DB/Auth. Heeft als enige **échte** betaalstroom (membership/report-purchases in `vastgoed_core`). Buiten kanaalgroei-scope.
17. **Funnel Systemen** — `affiliate_programs` **34 geregistreerd**, `affiliate_channel_mappings` 25 — maar **`affiliate_links`=0, `affiliate_clicks`=0, `affiliate_conversions`=0**. Registry zonder executie.
18. **Lead Generation** — `frontend/app/api/leads/route.ts` live intake; geen scoring/nurture/closed-loop.
19. **Revenue Engines** — mig 061/066/100/102 schema's compleet; **`monetization_metrics`=0, `monetization_streams`=0, alle affiliate-conversies/payouts=0**. Containers zonder lading.

---

## FASE 2 — IS HET EINDDOEL HAALBAAR? (14× JA/NEE)

> Vraag: kan het huidige systeem _"maak van kanaal X een €10.000/maand-kanaal"_?

| # | Capability | Oordeel | Onderbouwing (live bewijs) |
|---|---|---|---|
| 1 | Winnaar-kanaal kiezen | **DEELS** | `v_channel_strategy` (11 kanalen, mode-berekening) bestaat, maar zonder CTR/RPM/omzet is "winnaar" alleen op views — geen geld-signaal. |
| 2 | Winnaar-niche kiezen | **DEELS** | `competitor_signals`/`viral_opportunities` leveren niche-signalen; geen omzet-per-niche → keuze niet revenue-gestuurd. |
| 3 | Niches uitbreiden | **DEELS** | `content_horizon`/`content_radar_queue` gevuld; maar `horizon-planner=false` → niet autonoom. |
| 4 | Concurrenten volgen | **JA** | Scanner live: 36 kanalen, 1071 videos, 13170 snapshots. |
| 5 | Winner-DNA herkennen | **NEE** | `winner-detector=false`, `winner_extraction_jobs=0`. 46 variants bestaan maar lus draait niet. |
| 6 | Automatisch A/B-testen | **NEE** | Geen CTR-feedback (`ctr>0`=0) → geen thumbnail/titel-A/B mogelijk. |
| 7 | Budget verschuiven | **NEE** | Geen budget/spend-laag; geen ROI-per-kanaal omdat omzet=0. |
| 8 | Productie opschalen | **JA(volume)** | 56 uploads/24u bewijst volume-capaciteit; maar blind (geen kwaliteitssturing). |
| 9 | Slechte niches stoppen | **NEE** | Geen performance→stop-regel; `viral_patterns`/checkpoints leeg. |
| 10 | Nieuwe niches starten | **DEELS** | Kan kanaal/niche-rijen seeden; niet autonoom getriggerd. |
| 11 | Trends voorspellen | **NEE** | `viral_patterns=0`; geen predictie-model, alleen detectie. |
| 12 | Verkoop genereren | **NEE** | `affiliate_links/clicks/conversions=0`; geen CTA→klik→verkoop-pad live. |
| 13 | Funnel optimaliseren | **NEE** | Geen funnel-events; registry leeg van klikken. |
| 14 | Omzet maximaliseren | **NEE** | `monetization_metrics=0`, `estimated_revenue=0` overal. Omzet onmeetbaar. |

**Score Fase 2: 1× JA(vol), 3× JA, 4× DEELS, 9× NEE.** De productie-as is groen; de **commerciële as is vrijwel volledig rood**. Einddoel **nu niet haalbaar**; wel haalbaar ná het sluiten van de meet→leer→geld-keten (Fase 3-6).

---

## FASE 3 — ONTBREKENDE BOUWBLOKKEN

### 🔴 KRITIEK ONTBREEKT (blokkeert €10k direct)
1. **Revenue-ingestie (YouTube + affiliate).** YouTube Analytics `estimatedRevenue/RPM` → `monetization_metrics`; affiliate-netwerk-webhooks → `affiliate_conversions`. Zonder dit is omzet onzichtbaar.
2. **CTR-ingestie.** YouTube Analytics `cardClickRate`/`impressions+CTR` → `youtube_video_analytics.ctr`. Voorwaarde voor elke optimalisatie.
3. **Learning-loop activeren (output).** `learning-loop-worker` schedulen → `video_performance_checkpoints` (1/6/24/72u) → `viral_patterns` vullen. Nu 0.
4. **Winner-DNA-lus sluiten.** `winner-detector=true` + `winner_extraction_jobs` vullen + auto-seed `cf2_jobs` met `source_winner_video_id`.
5. **Monetisatie-executielaag.** Affiliate-link-injectie in beschrijvingen + klik-pixel + conversie-webhook + payout-drempel.

### 🟠 BELANGRIJK ONTBREEKT (nodig voor autonomie/schaal)
6. **CF2-runner autonoom maken.** `content:cf2-video-projects-runner=true`, faalpercentage (10/29) diagnosticeren, storage-handoff hardenen.
7. **Director repareren.** `llm_status=error` oplossen; plan→dispatch→verify-lus echt laten lopen (nu 2 cycli, stil sinds 06-02).
8. **Horizon-planner autonoom.** `content:horizon-planner=true` + trends uit `viral_patterns` voeden.
9. **Strategy closed-loop.** mode-shift (`v_channel_strategy`) → automatisch `channel_strategy.content_rules` aanpassen → producer leest.
10. **Hermes routing live.** Routing-requests echt verwerken (nu 0 live), zodat "maak kanaal €10k" als 1 instructie kan binnenkomen.

### 🟢 LATER TOEVOEGEN
11. Predictie-engine (trend-forecast i.p.v. -detectie). 12. Budget/spend-allocator (betaalde promo). 13. Lead-scoring/nurture closed-loop. 14. Multi-platform distributie (TikTok/Shorts cross-post als groeihefboom).

---

## FASE 4 — AUTONOMOUS GROWTH ARCHITECTURE (bestaand vs gat)

| Engine | Status | Hergebruik / wat ontbreekt |
|---|---|---|
| 1. Channel Selection Engine | **GEDEELTELIJK** | `v_channel_strategy` bestaat → uitbreiden met omzet-signaal (na revenue-ingestie). |
| 2. Niche Discovery Engine | **BESTAAT AL** | Competitor-scanner + `viral_opportunities` live. Alleen revenue-weging toevoegen. |
| 3. Competitor Intelligence Engine | **BESTAAT AL** | 36 kanalen/1071 videos live. Geen herbouw. |
| 4. Winner DNA Engine | **GEDEELTELIJK** | Schema + 46 variants bestaan; detector/extractie aanzetten + lus sluiten. |
| 5. A/B Testing Engine | **ONTBREEKT** | Vereist CTR-data (nu 0). Bouw thumbnail/titel-variant-test bovenop `cf2_winner_variants`. |
| 6. Growth Director | **GEDEELTELIJK(kapot)** | `director-cycle` bestaat maar errort. Repareren, niet herbouwen. |
| 7. Monetization Engine | **ONTBREEKT(exec)** | Schema mig 061/066/100/102 bestaat; executie (ingestie+payout) bouwen. |
| 8. Funnel Engine | **ONTBREEKT(exec)** | `affiliate_programs` registry bestaat; klik→conversie→funnel-events bouwen. |
| 9. Revenue Optimizer | **ONTBREEKT** | Kan pas ná revenue-ingestie: RPM×views → niche/kanaal-herallocatie. |
| 10. Scaling Engine | **GEDEELTELIJK** | Productie-volume bewezen (56/24u); kwaliteits-gated opschalen ontbreekt. |
| 11. Prediction Engine | **ONTBREEKT** | Later; bouw op gevulde `viral_patterns`. |
| 12. Autonomous CEO Layer (Hermes) | **GEDEELTELIJK** | Routing-brain gebouwd; live verwerking + director-koppeling ontbreekt. |

**Principe:** 3 engines BESTAAN AL of zijn herbruikbaar (2,3 + recovery/tracker). **Niet dupliceren.** De waarde zit in **5 ontbrekende executie-lagen** (5,7,8,9,11) en **3 reparaties/activaties** (4,6,10/12).

---

## FASE 5 — TOP-20 BOTTLENECKS (gesorteerd op OMZET-impact)

| # | Bottleneck | Omzet-impact | Bewijs |
|---|---|---|---|
| 1 | Geen revenue-ingestie (RPM/omzet=0) | ⛔ blokkeert alles | `monetization_metrics`=0 |
| 2 | Geen affiliate-executie (klik/conversie=0) | ⛔ blokkeert | `affiliate_conversions`=0 |
| 3 | CTR onbekend (=0) | 🔴 zeer hoog | `ctr>0`=0 op 943 rijen |
| 4 | Learning-output leeg | 🔴 zeer hoog | checkpoints/summary/patterns=0 |
| 5 | Winner-DNA-lus uit | 🔴 hoog | `winner-detector=false`, extractie=0 |
| 6 | Director kapot (LLM-error) | 🔴 hoog | 2 cycli, stil sinds 06-02 |
| 7 | CF2-runner niet gescheduled | 🟠 midden-hoog | `cf2-runner=false`, 19 jobs blijven planned |
| 8 | CF2-faalpercentage ~34% | 🟠 midden | 10/29 failed |
| 9 | Geen A/B-testen | 🟠 midden | volgt uit #3 |
| 10 | Geen budget/ROI-allocatie | 🟠 midden | geen spend-laag |
| 11 | Strategy niet closed-loop | 🟠 midden | producer past rules niet aan |
| 12 | Horizon-planner uit | 🟠 midden | `horizon-planner=false` |
| 13 | Geen omzet-per-niche/kanaal | 🟠 midden | volgt uit #1 |
| 14 | Hermes routing niet live | 🟡 midden-laag | 0 live requests |
| 15 | CF2 storage-handoff fragiel | 🟡 laag-midden | render→/tmp |
| 16 | Lead-nurture ontbreekt | 🟡 laag | intake-only |
| 17 | Geen predictie (alleen detectie) | 🟡 laag | `viral_patterns`=0 |
| 18 | Geen cross-platform groeihefboom | 🟡 laag | YouTube-only |
| 19 | Analytics-ingestie niet gescheduled | 🟡 laag | worker inert |
| 20 | Heartbeat false-positives watchdog | ⚪ zeer laag | log 06-12 |

---

## FASE 6 — EXECUTIEVOLGORDE (Impact / Bouwtijd)

| Stap | Actie | Impact | Complex. | Afhankelijk van | Winstbijdrage |
|---|---|---|---|---|---|
| **S1** | YouTube Analytics-ingestie: CTR + RPM + estimatedRevenue → `youtube_video_analytics`/`monetization_metrics` | ⛔→🔓 hoogste | Laag-mid | YouTube Analytics-scope/credits | Maakt geld+CTR zichtbaar — randvoorwaarde voor alles |
| **S2** | Learning-loop schedulen → checkpoints + `viral_patterns` vullen | 🔴 | Laag | S1 | Sluit voel→leer; voedt producer & winner |
| **S3** | Winner-DNA-lus aan: `winner-detector=true` + extractie + auto-seed `cf2_jobs` | 🔴 | Mid | S2 | Repliceert bewezen winners → hogere views/€ |
| **S4** | Affiliate-executie: link-injectie + klik-pixel + conversie-webhook + payout-drempel | 🔴 | Mid-hoog | S1 | **Eerste echte euro's** |
| **S5** | CF2-runner autonoom + faal-diagnose + storage-harden | 🟠 | Mid | — | Stabiele autonome productie |
| **S6** | Director repareren (LLM-error) + plan→verify-lus live | 🟠 | Mid | S2 | Dagelijkse autonome sturing |
| **S7** | Strategy closed-loop + horizon-planner aan | 🟠 | Mid | S2 | Niche/kanaal-herallocatie op data |
| **S8** | Hermes routing live (1 request e2e) + "maak kanaal €10k"-intent | 🟡 | Mid-hoog | S3,S6 | Autonomous CEO-laag operationeel |
| **S9** | Revenue Optimizer + budget-allocatie | 🟡 | Hoog | S1,S4 | Omzet maximaliseren/schalen |
| **S10** | Predictie + cross-platform distributie | 🟢 | Hoog | S2 | Groei-hefboom lange termijn |

**Hoogste ROI eerst:** S1 → S2 → S4 → S3. Met S1+S2+S4 gaat het systeem van "blind publiceren" naar "meet omzet en verdient de eerste euro's"; dat is de kortste weg richting een meetbaar €-kanaal.

---

## FASE 7 — DEFINITIEF OORDEEL (0-100)

| Domein | Score | Onderbouwing |
|---|---|---|
| Content Factory | **55** | Draait & produceert, maar 34% faal + runner-schedule uit |
| Monitoring | **45** | Watchdog sterk; analytics half-blind (geen CTR/RPM) |
| Autonomie | **35** | Productie+publicatie autonoom; brein-loops uit/kapot |
| Learning | **10** | Output volledig leeg (0 checkpoints/patterns) |
| Competitor Intelligence | **65** | Live met échte data, sterkste component na recovery |
| Growth | **40** | Volume-groei live; geen optimalisatie-loop |
| Monetisatie | **5** | Geen euro gemeten of verdiend |
| Funnels | **15** | Registry bestaat, 0 executie |
| Revenue Engine | **5** | Schema compleet, 0 lading |
| Autonomous CEO (Hermes/Director) | **25** | Gebouwd, director kapot, routing niet live |

### Het ene antwoord
> **"Hoe dicht staan we bij een systeem dat zelfstandig één kanaal naar €10.000+/maand kan sturen?"**

**≈ 30/100. Niet dichtbij — maar niet vanaf nul.** De **productiemachine bestaat en draait** (produceren + publiceren + concurrentie-intel zijn live met echte data). Wat volledig ontbreekt is de **commerciële regelkring**: het systeem **meet geen CTR, geen RPM, geen omzet**, **leert niets** (lege checkpoints/patterns), en heeft **geen geldstroom** (0 conversies/payouts). Daardoor kan het vandaag alleen **blind volume** draaien, niet *sturen op €*. De afstand is niet "alles bouwen" maar **vier executie-lagen sluiten** (revenue-ingestie, learning-output, winner-lus, affiliate-executie) plus **twee reparaties** (CF2-runner, director). Dat is de helft van het werk — de moeilijkste helft commercieel, maar technisch goed afgebakend omdat de schema's en de productiekant al staan.

---

## Bewijs-appendix (live queries, 2026-06-12)

- **Upload/publicatie:** `youtube_upload_queue` 3650 (verified_live 915, planned 1327, queued 1027, failed 33, manual_review 77); uploads_finished 7d=397, 24u=56; laatste 2026-06-12T09:02Z.
- **Analytics:** `youtube_video_analytics` 943; retention(avg_view_pct>0)=745; **ctr>0=0; rpm>0=0; est_revenue>0=0**; max date 2026-06-11.
- **CF2:** `cf2_jobs` 29 (planned 19, failed 10; 10 met output); `cf2_job_steps` 261; `cf2_visual_decisions` 226; `cf2_winner_variants` 46; laatste job 2026-06-12T08:25Z.
- **Competitor:** channels 36, videos 1071, signals 212, viral_opportunities 1841, snapshots 13170.
- **Learning/winner:** `video_performance_checkpoints`=0, `video_learning_summary`=0, `viral_patterns`=0, `winner_extraction_jobs`=0.
- **Revenue:** `monetization_metrics`=0, `monetization_streams`=0, `affiliate_conversions`=0, `affiliate_clicks`=0, `affiliate_links`=0.
- **Schedule:** enabled 84 / disabled 14; uit: `content:cf2-video-projects-runner`, `content:winner-detector`, `content:horizon-planner`; aan: `media:director-plan`, `media:director-verify`.
- **Director:** `director_cycles` 2 rijen (2026-06-02), plan `llm_status=error`.
- **Hermes/recovery:** `hermes_alerts` 297, `hermes_projects` 3; watchdog live (`OSM_STATE/logs/watchdog.log`).

> _Methodenoot:_ Dit rapport corrigeert expliciet de 8-juni-reconciliatie waar die "0 rijen / niet gedraaid" stelde voor CF2, competitor en analytics — de live DB op 12 juni toont dat die wél data hebben. De resterende nul-claims (learning, winner-extractie, revenue) zijn op 12 juni bevestigd.
