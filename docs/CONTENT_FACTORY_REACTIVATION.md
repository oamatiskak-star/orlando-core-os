# Content Factory — Reactivatie-voorstel (RAPPORT, geen actie uitgevoerd)

> Status: **voorstel**. Er is **geen worker aangezet**, geen migratie toegepast, geen spend gestart.
> Besluit ligt bij Orlando. Onderdeel van de CF2/Media-pipeline root-cause audit (2026-06-10).

## 1. Bewijs — wat draait wél en wat niet (prod shaunum)

| Pipeline | Bewijs | Status |
|---|---|---|
| Viral scraper | `viral_opportunities` 1686, laatste 2026-06-10 12:00 | ✅ draait |
| Trend scanner | `trend_scanner_signals` 4378 | ✅ draait |
| Hook extraction | `hook_library` 67 | ✅ draait (maar War Room-view negeert het, leest `content_items.hook`) |
| **Content Factory (media_holding)** | `media_holding_content_items` 72, **laatste created_at 2026-05-20**; 71 `ready` / 1 `published`; uploads 5 (2026-05-20) | ⛔ **bevroren ~3 weken** |
| **CF2 (Revenue Video Engine)** | `video_projects/video_scenes/visual_assets/audio_assets/thumbnail_variants` = 0/0/0/0/0; `engine_schedule.content:cf2-video-projects-runner` **enabled=false** ("shadow, handmatig tot bewijs") | ⛔ **uit (gated)** |
| YouTube-engine (levend) | `youtube_videos` 5380 (1145 youtube_video_id, 1676 published), `youtube_video_analytics` 911 (laatste 2026-06-10 10:00) | ✅ draait |

**Conclusie:** de scraper/hooks draaien; de Content Factory die ad-creatives produceert is gestopt en de CF2-revenue-engine staat bewust uit. De levende content komt uit de YouTube-engine (nu zichtbaar gemaakt via migratie 164).

## 2. Optie A — Content Factory (media_holding) heractiveren

**Doel:** opnieuw ad-style creatives produceren (content_items → render → upload).

- **Worker:** `content-worker` (`engine_schedule.content:aquier-shorts`, nu `enabled=false`) en/of `executor/nl_produce_and_upload.py`.
- **Stappen (na go):**
  1. Controleer waarom de worker stopte op 2026-05-20 (laatste run-logs / PM2 op de productie-host; geen scheduler-rij actief).
  2. Engine Planner: kies/maak een niet-overlappend tijdblok in `engine_schedule_blocks`; zet `content:aquier-shorts` (of de juiste content-engine) op `enabled=true`.
  3. Verifieer eerste output: nieuwe rijen in `media_holding_content_items` met `status` voortgang ready→uploaded, en `media_holding_uploads`.
- **Risk/spend:** render-/LLM-kosten per video; begin met kleine batch (`content-worker/scripts/start-test-batch.mjs`) en meet vóór opschalen.
- **Impact:** vult de media_holding-tak van de War Room met nieuwe creatives (naast de YouTube-tak).

## 3. Optie B — CF2 Revenue Video Engine activeren (gated)

**Doel:** volledige CF2-pijplijn (video_projects → scenes → visual/audio assets → thumbnail_variants → render → upload) met omzet-attributie.

- **Gated bron:** branch `feat/content-factory-2-revenue-engine`, migratie **153** (niet toegepast op prod).
- **Stappen (na expliciete go — spend):**
  1. Migratie 153 (+ vervolg) los toepassen op shaunum.
  2. `engine_schedule.content:cf2-video-projects-runner` → `enabled=true`, koppel aan een eigen zwaar tijdblok (batch-render).
  3. Verifieer: `video_projects` > 0, `thumbnail_variants` > 0, dan stromen thumbnails ook via de CF2-bron.
- **Risk/spend:** hoogste (render-fleet + asset-generatie). Bewust "handmatig tot bewijs" gemarkeerd; pas aanzetten na ROI-bewijs.
- **Impact:** eigen gegenereerde thumbnails/assets i.p.v. YouTube-CDN; vult `thumbnail_variants`/`visual_assets` die de Workspace later kan tonen.

## 4. Aanbeveling

1. **Nu live:** migratie 164 toepassen → War Room toont direct de levende YouTube-content met echte thumbnails (geen spend).
2. **Daarna meten:** als je nieuwe ad-creatives wilt, start **Optie A** met een kleine test-batch en meet kosten/output.
3. **CF2 (Optie B)** pas aanzetten als Optie A bewijst dat de keten end-to-end levert en de ROI het render-budget rechtvaardigt.

## 5. CF2 Producer-worker (gebouwd, PREPARED — niet gestart)

`local-agent/src/cf2-producer.ts` — orchestrator over de `cf2_jobs`-queue (Review Intelligence + Producer Graph). Default **CF2_PRODUCER_MODE=prepared** → valideert alleen (lokale-model-health + pending jobs), produceert/uploadt/spendt NIETS. Wordt niet vanzelf gestart (geen import in index.ts/scheduler, geen cron).

Queue is geseed: `select public.cf2_seed_jobs_from_horizon();` → 22 cf2_jobs met volledige provenance + 9-stap audittrail (viral/hook/winner/horizon = done, creative→attribution = pending).

**Activatie (aparte go, spend — Mac Mini host, lokaal-first):**
1. Koppel de live-generators in `runLiveStep()` aan de bestaande libs: `lib/ai.ts` (creative), `lib/thumbnail-intelligence.ts` (thumbnail — VERPLICHT), `lib/visual-intelligence.ts`+`tts.ts`+`audio.ts`+`render.ts`+`video.ts` (video), youtube_upload_queue (upload).
2. Start lokale modellen (Ollama `:11434` / LM Studio `:1234`).
3. `CF2_PRODUCER_MODE=live CF2_PRODUCER_RUN=1 node dist/cf2-producer.js` (of via scheduler), kleine batch eerst.
4. Engine `content:cf2-video-projects-runner` → enabled=true + tijdblok.
> Lokaal-first: 80–90% via Ollama/LM Studio; cloud alleen uitzondering. Pas hier ontstaat spend.

> Geen van bovenstaande is uitgevoerd. Workers blijven uit tot jouw aparte go per optie.
