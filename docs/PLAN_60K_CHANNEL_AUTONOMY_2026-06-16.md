# MASTER BUILD PLAN — Autonome "€60k/maand-kanaal"-machine

> **Auteur:** CLI (Claude Code) · **Datum:** 2026-06-16 · **Opdrachtgever:** Orlando
> **Opdracht:** "Pak alles op wat mist of niet werkt, zodat bij oplevering de instructie *maak een €60k/maand-kanaal* autonoom beantwoord kan worden."
> **Bewijsbron:** live Supabase `shaunumewswpxhmgbtvv` (16-6), audit `AUDIT_AUTONOMOUS_GROWTH_OS_2026-06-12.md`.

## Scope-akkoord (Orlando, 16-6)
1. **Definitie "klaar" = de autonome machine die €60k najaagt.** Het systeem accepteert de instructie, plant, produceert, publiceert, **meet, leert, monetiseert en stuurt** er dagelijks op + rapporteert. €60k = het gevolgde doel van de machine, **geen gegarandeerde euro's bij overdracht** (markt-/YPP-/tijdsafhankelijk).
2. **Prod-gates: stage alles, Orlando keurt per gate.** Bouw op branches → PR → gate-lijst. Geen prod-migratie/deploy/publish/merge zonder expliciete OK.
3. **Distributie: organisch + Shorts-blitz, €0 budget.** Geen betaalde promo. Hefbomen: Shorts-first, CTR/retentie-optimalisatie, cross-post.
4. **Content-kwaliteit zit in scope.**

---

## FASE A — DIAGNOSE (KLAAR, 16-6): waarom 1.142 video's ~0 views krijgen

**Verdict: de bindende constraint is TRACTIE/CONTENT-KWALITEIT, niet de ontbrekende meet-/geldplumbing.**

Live bewijs (16-6):
- **Onze content ooit:** 1.045 analytics-rijen, **SUM views = 60.914** (≈ 58 views/video gemiddeld), **best-ooit = 2.422 views**, slechts **109 van 1.142 video's haalden ooit >100 views**. `views_30d` per kanaal = **0** → recente output vlakt af naar nul.
- **Kanalen:** hoogste = LoopForge AI **11 subs**; rest 0–4. **YPP-waardig (≥1.000 subs + 4.000 wu): 0 kanalen.**
- **Concurrenten (zelfde niches, in onze DB):** 32 video's >100k views, **max 714.004**, mediaan 2.033. → **Ons béste resultaat ooit ≈ concurrent-mediaan.**
- **Patroon:** 56 near-duplicate AI-Shorts/dag (satisfying/LEGO/ASMR) met dubbele generieke titels in 0-sub-kanalen → algoritme onderdrukt naar ~0 reach.

**Gevolg:** revenue=€0 en CTR=0 zijn *symptomen*, geen losse bugs. De meet→leer→winner→geld-lus moet bestaan, maar levert pas waarde zodra er kijkers zijn om van te leren. **Daarom: tractie-first.**

**Rekenrealiteit €60k/maand:** puur YouTube-ads ≈ 12–60M views/maand (NL/EU RPM €1–5). Huidige nieuwe-views-runrate ≈ 0. Eerste haalbare euro's komen via **affiliate** (YPP nog onbereikbaar). €60k is een meermaands-uitkomst van een werkende tractie- + monetisatie-machine.

---

## RE-GESEQUENCED MASTER PLAN (traction-first)

Elke fase: eigen branch → PR → verificatie → **gate** (Orlando's OK) vóór prod.

| Fase | Levert | Hard gate | Hangt af van |
|---|---|---|---|
| **1. Meetlus (CTR/retentie/views)** | `analytics-feedback-worker` vult écht `ctr`/`retention`/`views`; Engine-Planner-rij; werkt ook op lage aantallen | schedule-activatie | — |
| **2. Content-kwaliteit-engine** | CQI-gate vóór publicatie: hook/retentie/thumbnail-score vs concurrent-winnaars; blokkeert duplicaten & zwakke output | CF2-gate-config | 1 |
| **3. Learning-lus output** | `learning-loop-worker` → `video_performance_checkpoints` + `viral_patterns` gevuld | schedule-activatie | 1 |
| **4. Winner-DNA-lus** | fix waarom winner/growth-jobs in `failed` landen; auto-seed `cf2_jobs` uit échte concurrent-winnaars | schedule-activatie | 3 |
| **5. Tractie/distributie (organisch)** | Shorts-first, CTR/titel/thumbnail-A/B, cross-post TikTok/Reels/IG | deploy | 1,2 |
| **6. Monetisatie-executie (affiliate)** | link-injectie + klik-pixel + conversie-webhook + payout-drempel | prod-migratie + deploy | 1 |
| **7. Director + strategy closed-loop** | director-plan→verify live; `v_channel_strategy`→`content_rules`; horizon-planner aan | schedule-activatie | 3 |
| **8. Hermes-intent "maak €60k-kanaal"** | 1 instructie → objective-tracking + dagelijkse sturing + rapportage | prod-migratie + deploy | 4,7 |

**Hoogste ROI eerst:** 1 → 2 → 5 (meten + kwaliteit + distributie = views), dan 3 → 4 (leren + winners), dan 6 (eerste euro's), dan 7 → 8 (autonome CEO-laag).

---

## GATE-LIJST (wacht op Orlando)
- [ ] (bestaand) Migratie **185** op prod + `mf_classify_dead_queue(true)` — Media Factory Command Center
- [ ] (bestaand) `CF2_PUBLISH=1` — Fase 2 publiek
- [ ] Fase 1: Engine-Planner-rij activeren voor analytics-feedback
- [ ] Fase 2: CQI-gate aanzetten als publicatie-poortwachter
- [ ] Fase 6: affiliate-migratie op prod + deploy
- [ ] Fase 8: Hermes-intent-migratie op prod + deploy

---

## DEFINITIEF CONTENT-VERDICT (Fase 2 diagnose, 16-6) — waarom 0 views

Visual-keys (Pexels+Pixabay) **zijn gezet**; 1.059/1.248 scenes (85%) hébben een asset. Het probleem is dus NIET "geen beeld", maar:
1. **Belofte ≠ payoff:** clickbait-titel ("satisfying LEGO machine") + generieke stockclips → kijker voelt bait → swipe <2s → retentie stort → algoritme onderdrukt.
2. **Geen retentie-pacing:** statische scenes 5–10s, géén cuts/zoom; werkende Shorts cutten elke 0,8–1,5s → retentie-cliff bij 3s.
3. **Thumbnail = blinde frame-grab op 4s** (niet de gescoorde variant) → lage CTR.
4. **Duplicaten gaan live** (dedup draait pas ná publicatie, handmatig) → spam-signaal.
5. **Format structureel onmaakbaar uit stock:** een viraal satisfying/LEGO/ASMR-kanaal vereist authentieke, specifieke beelden — stock kan dat niet leveren.
→ Kern: de content-machine produceert **kijk-onwaardige** video's en publiceert ze blind + dubbel. Tractie begint bij kijkbare content.

## FASE 1 BEVINDING (gecorrigeerd) — meetlus draait, maar one-shot
- `analytics-feedback-worker` is WEL gestart (`youtube-engine/src/index.ts:36`, in PM2) en wordt na elke upload ge-enqueued (`upload-orchestrator.ts:260`).
- **Gat:** analytics worden één keer ~direct na upload opgehaald (views=0) en **nooit opnieuw** → 1.045 rijen vol nullen. Ontbreekt: **dagelijkse her-poll (analytics-sweep)** van alle `verified_live` video's, gated op `engine_window_open('content:analytics-feedback')`.
- `learning-loop-worker` (`local-agent/`) is CLI-only, nergens gescheduled.

## CONCRETE BUILD-BACKLOG (evidence-based, geprioriteerd op views→€)
**A. Tractie/content (de echte hefboom — Fase 2/5):**
- A1. Pre-publish dedup-gate (nu pas ná publicatie) — stopt spam-signaal. *Goedkoop, hoge impact.*
- A2. Retentie-pacing in render (cuts/zoom/punch-in, hook-cut 0–1s, captions-burst). *Hoge impact.*
- A3. Thumbnail: gescoorde variant afdwingen i.p.v. blinde frame-grab.
- A4. **STRATEGISCHE FORK (Orlando):** stock-Shorts-format vs. authentiek format. Bepaalt of A2/A3 voldoende zijn of dat het contentmodel om moet.

**B. Meetlus (Fase 1 — branch `feat/measurement-loop`):**
- B1. ✅ Migratie `215_measurement_loop_schedule.sql` — engine_schedule-rijen (janitor-blok).
- B2. Dagelijkse analytics-sweep enqueuer (her-poll verified_live, window-gated).
- B3. learning-loop schedulen (window-gated) + PM2-entry.

---

## FORMAT-BEWIJS (concurrent-analyse 16-6) — wat wint ÉCHT in jouw niches

Bron: `competitor_videos` × `competitor_channels` (36 gevolgde concurrenten, jouw eigen niches).

| Niche | vids | avg views | max | mediaan | gem. duur | shorts | longform |
|---|---|---|---|---|---|---|---|
| **vermogen** | 223 | 47.181 | **714.004** | **22.373** | ~25min | 36 | **187** |
| **beleggen** | 267 | 10.700 | 187.920 | 4.373 | ~23min | 29 | **238** |
| sparen | 25 | 7.481 | 82.270 | 633 | ~6min | 9 | 16 |
| vastgoed | 203 | 908 | 23.437 | 408 | ~4min | 78 | 125 |
| crypto | 387 | 2.459 | 21.004 | 987 | ~12min | 80 | 307 |

**Top-winnaars vermogen (titels):** "Kun Je Rijk Worden Als Nep Dakloze?" (615k), "Ik Leefde In M'n Auto Tot Ik Een Rolex Kon Kopen" (47min, 307k), "Ik Testte ILLEGALE Manieren Van Geld Verdienen" (254k), "72 Uur Overleven Op Vliegvelden Zonder Geld" (22min, 189k). Beleggen-top: "Willem Middelkoop: Monetaire Reset" (58min interview, 187k).

### Conclusies (hard, op data):
1. **Winnend format = NIET faceless stock.** Het is óf (a) **MrBeast-stijl menselijke challenge/experiment/story** met geld-hook, óf (b) **expert long-form/interview**. Beide: echt persoon, gefilmd, verteld, ~12–58 min.
2. **De Fabriek (faceless 50s AI-stock-Shorts) matcht GEEN enkel winnend format.** Dit is de bewezen grondoorzaak van 0 views — verkeerd format, verkeerde lengte, geen geloofwaardige stem.
3. **vermogen = beste niche** (mediaan 22k, max 714k, hoge NL-finance-RPM). crypto/vastgoed = laag (mediaan 408–987), verzadigd.
4. **Machine-maakbare sub-segment:** faceless **long-form data/analyse-explainers** (echte cijfers/grafieken via je FMP-data, AI-stem) — lager plafond dan menselijke challenge-content, maar **wél autonoom haalbaar** en het sluit aan bij de serieuze-finance-winnaars.

### Aanbeveling (machine-realistisch pad naar €):
Stop de stock-Shorts-spam. Kantel naar **faceless NL-finance long-form data-explainers in vermogen/beleggen** op één pilotkanaal (VermogenTv): echte data + grafieken + sterke hook + retentie-pacing. €60k blijft een meermaands-uitkomst (schaal + affiliate + uiteindelijk YPP); de absolute topformats vereisen een mens op beeld — dat is de eerlijke grens van een faceless machine.

## Voortgang
- **2026-06-16:** Fase A + Fase 2-diagnose + concurrent-format-analyse klaar. Branch `feat/measurement-loop`, migratie 215. **Bewijs op tafel → wacht op Orlando's format-besluit** (faceless long-form data-explainer pivot vs. menselijke productie).
