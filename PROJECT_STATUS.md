# Orlando Core OS — PROJECT_STATUS

> **Sessie protocol** (CLAUDE.md): Lees dit bestand bij elke nieuwe Claude Code sessie. Update na elke voltooide taak. Houd het herstel-blok actueel.

**Laatste update:** 2026-05-20 — Acquisition Intelligence Layer LIVE (deployed Vercel)

---

## 🔴 HERSTEL HIER NA CRASH

**Sessie focus (2026-05-20, sessie 2)**: Executive Intelligence Layer (Fase 7) — AI C-suite bovenop Media Holding OS. ✅ Code compleet, deploy pending.

**Sessie focus (2026-05-20, sessie 3)**: Acquisition Intelligence Layer — VOLLEDIG LIVE ✅

**Wat is gedaan in deze sessie:**
- ✅ Migratie 076 applied — 14 acq_* tabellen (acq_deals, acq_deal_scores, acq_build_opps, acq_offmarket_leads, acq_permits, acq_municipalities, acq_investors, acq_investor_matches, acq_crm_contacts, acq_outreach_sequences, acq_outreach_messages, acq_settings, acq_agent_registry, acq_scan_jobs), indices, triggers, 8 agents geseed.
- ✅ Migratie 076 applied in Supabase via MCP.
- ✅ Migratie 075 (executive_agents + executive layer) ook applied — executive tabellen live.
- ✅ Render service `executive-engine/` gebouwd — 6 LLM agents (ATLAS opus, 5 specialisten sonnet), node-cron schedules, Express health/run endpoints, CLI runner.
- ✅ 3 Vercel crons toegevoegd: `/api/executive-layer/cron/{decision-engine,alert-engine,autonomous-scaling}`.
- ✅ Shared frontend lib `frontend/lib/executive-layer/` — types, decision-engine (rule-based), alert-detectors (7 detectors), autopilot-links (5 links).
- ✅ 12 API routes onder `/api/executive-layer/` (decisions, reports, recommendations, alerts, agents, fund, kpis).
- ✅ 5 shared executive components in `frontend/components/executive/`.
- ✅ Nieuwe top-tab `Executive` in media-holding layout + 7 sub-pages (Overview, Boardroom, Channels, Retention Lab, Algorithm, Compete, Fund).
- ✅ `vercel.json` + `render.yaml` ge-update voor `orlando-executive-engine` service.

**Sessie focus (2026-05-20, sessie 4)**: Volgende stap — bepalen door Orlando.

Opties:
- A) **Acquisition scraper engine** op Render (DealHunter/OffMarketAI/PermitAI workers)
- B) **Executive Engine deploy** activeren (ANTHROPIC_API_KEY in Render zetten)
- C) **Aquier.com** integratie koppelen aan acquisitie module
- D) **Content factory pipeline** herstellen (downstream chain na viral scan)

---

**Direct herstelbaar door:**
1. Render deploy: push de wijzigingen naar GitHub, Render auto-deploy pickt `orlando-executive-engine` op. ANTHROPIC_API_KEY env in Render dashboard zetten.
2. Vercel env `EXECUTIVE_ENGINE_URL=https://orlando-executive-engine.onrender.com` zetten.
3. Eerste manual trigger:
   ```bash
   # Trigger Decision Engine (geen LLM kosten)
   curl https://<vercel-url>/api/executive-layer/cron/decision-engine -H "Authorization: Bearer $CRON_SECRET"
   # Trigger Alert Engine
   curl https://<vercel-url>/api/executive-layer/cron/alert-engine -H "Authorization: Bearer $CRON_SECRET"
   # Trigger ATLAS (kost ~$0.30)
   curl -X POST https://<vercel-url>/api/executive-layer/agents/run/atlas
   ```
4. Open `/dashboard/media-holding/executive` om resultaten te zien.

---

## 🚨 Vorige sessie focus (gearchiveerd)

**2026-05-20 sessie 1**: Viral Intelligence Engine van orchestrator_task-poller naar **directe Vercel cron routes**. ✅ AUTONOOM LIVE per 16:22 UTC — alle 3 endpoints succesvol manueel getriggerd, data binnen (viral 156→234, audio 77→83, trend 346→411).

- ✅ Media Holding inhaalsprong (Settings, Analytics, Compete, Archives modules + API routes + migraties 073-075)
- ✅ Competitor Surveillance scanner-worker (gebouwd, gedeployed, paused)
- ✅ 3 directe Vercel cron routes voor viral/audio/trend scan
- ✅ Shared helper `frontend/lib/youtube-public.ts`

**Direct herstelbaar door:**
1. Manueel triggeren ter validatie:
   ```bash
   curl -H "Authorization: Bearer $CRON_SECRET" https://<vercel-url>/api/youtube/cron/viral-scan
   curl -H "Authorization: Bearer $CRON_SECRET" https://<vercel-url>/api/youtube/cron/audio-scan
   curl -H "Authorization: Bearer $CRON_SECRET" https://<vercel-url>/api/youtube/cron/trend-scan
   ```
2. Vereist: `YOUTUBE_DATA_API_KEY` en `CRON_SECRET` in Vercel env (allebei al gezet).
3. Verifieer rij-aanwas:
   ```sql
   select 'viral' t, count(*), max(captured_at) from viral_opportunities
   union all select 'audio', count(*), max(captured_at) from audio_library
   union all select 'trend', count(*), max(captured_at) from trend_scanner_signals;
   ```

---

## 📊 Module status

### Media Holding OS (6/6 fases completed, 23/23 modules live + Fase 7 in build)

| Fase | Status | Voortgang |
|---|---|---|
| 1 — Cashflow First | ✅ Completed | 100% |
| 2 — Media Division Structuur | ✅ Completed | 100% |
| 3 — Dashboard & UX | ✅ Completed | 100% |
| 4 — AI System Behavior | ✅ Completed | 100% |
| 5 — Infrastructure Rules | ✅ Completed | 100% |
| 6 — Long Term Scale | ✅ Completed | 100% |
| 7 — Executive Intelligence Layer | 🔄 Building | 40% (code+DB live, Render deploy pending) |
| 8 — Acquisition Intelligence Layer | ✅ Completed | 100% (DB+API+UI live, workers todo) |

### Render services (deploy status)

| Service | Status |
|---|---|
| `orlando-youtube-engine` | ✅ Live |
| `orlando-executor` (planning-engine) | ✅ Live |
| `orlando-mail-engine` | ✅ Live |
| `orlando-competitor-scanner` | 🔄 Live maar Orlando wil suspenden (DB workers op `paused`) |
| `orlando-redis` | ✅ Live |
| `orlando-executive-engine` | ⏳ Code klaar, render.yaml ge-update — eerste deploy pending |

### Vercel crons (6 actief)

| Cron | Schedule | Doel |
|---|---|---|
| `refresh-tokens` | `0 5 * * *` | OAuth tokens vernieuwen |
| `sync-stats` | `0 8 * * *` | Channel/video stats syncen |
| `snapshot-daily-stats` | `55 23 * * *` | Dagelijkse snapshot |
| `run-pipeline` | `0 2 * * *` | Generatie/publish pipeline |
| `sync-video-analytics` | `0 10 * * *` | Analytics syncen |
| `viral-scan` | `0 */4 * * *` | Direct YT Data API → viral_opportunities |
| `audio-scan` | `15 */4 * * *` | Direct YT mostPopular cat=10 → audio_library |
| `trend-scan` | `30 */4 * * *` | Extract keywords uit viral_opportunities → trend_scanner_signals |
| `decision-engine` | `0 * * * *` | Rule-based channel classificatie → executive_decisions |
| `alert-engine` | `*/15 * * * *` | 7 detectors → executive_alerts |
| `autonomous-scaling` | `0 */2 * * *` | Autopilot links (default uit, threshold tunable) |

---

## ⏳ Open / Aandachtspunten

1. **Executive Engine deploy** — Render service `orlando-executive-engine` in render.yaml, code in `executive-engine/`. Push naar GitHub triggert deploy. ANTHROPIC_API_KEY env in Render dashboard zetten. EXECUTIVE_ENGINE_URL env in Vercel zetten na deploy.
2. **Acquisition scraper workers** — `acq_agent_registry` bevat 8 agents (DealHunter, OffMarketAI, PermitAI, etc.) allemaal `idle`. Geen Render worker gebouwd voor acquisitie. Volgende grote bouwblok.
2a. **Acquisition Vercel crons** — Nog geen crons aangemaakt voor acquisition scans (bijv. `0 6 * * *` DealHunter scan).
2. **Eerste agent-runs** — Tot ATLAS gedraaid heeft: Boardroom pagina toont empty state. Trigger handmatig na Render deploy: `POST /api/executive-layer/agents/run/atlas` (kost ~$0.30).
3. **Autopilot links staan default uit** — `update autopilot_config set enabled=true where link_key in (...)` om autonome scaling te activeren. Begin met `breakout_to_clone` en `recommendation_to_task` als laagrisico.
4. **Render: orlando-competitor-scanner suspenden** — Orlando kiest expliciet voor Viral Intelligence ipv per-kanaal monitoring. Service nog niet gesuspend, kost ~$7/mo.
5. **Worker heartbeat bug** — `upload-engine-youtube.last_seen` wordt niet bijgewerkt terwijl worker wel actief is. Functioneel geen issue.
6. ~~Content factory pipeline stil~~ — **GEFIXED 2026-05-20 ~18:00 UTC**: vier Vercel crons toegevoegd (`content-factory`, `renderer-dispatch`, `renderer-poll`, `atlas-upload`) plus helpers `lib/youtube-public.ts` + `lib/replicate.ts`. Chain bewezen werkend t/m render: 1× DC's Lanterns MP4 (Replicate minimax). Hybride architectuur: premium (score≥95) via Replicate, lokale rail voor bulk (spec hieronder, niet gebouwd).
7. **BullMQ + Replicate URL als file_path** — `youtube-engine/src/workers/ffmpeg-normalizer-worker.ts` verwacht lokaal file_path (`fs.existsSync`). Wanneer atlas_upload Replicate URL als file_path zet, faalt ffmpeg-normalizer. Vereist code-change: bij URL prefix eerst downloaden naar /tmp dan normaliseren.
8. **Viral-scanner-tiktok** — status `offline`, nooit gebouwd. Out of scope.

## 🛠️ Spec — Lokale rail (volgende sessie)

**Doel:** Bulk content_factory render voor virality_score 50-94 zonder Replicate kosten. Premium rail (≥95) blijft Vercel + Replicate.

**Architectuur:**
- Reactivate `local-agent/` (Mac Mini) als orchestrator_tasks poller
- Pakt `executor='renderer'` tasks van content_items waar source_score < 95
- Render pipeline: Pexels stock + Edge TTS voice-over + FFmpeg compositie
- Output: Supabase Storage MP4 → content_item.output_url + status='ready' → trg_render_to_upload → atlas_upload (al gebouwd)

**Vereist op Mac Mini:** `PEXELS_API_KEY` (gratis), FFmpeg, Python3 + edge-tts. **Estimated:** 2-3 uur build.

## ✅ Upload engine fix (2026-05-20 17:20 UTC)

- 5 channels OAuth-reconnected (BrickPulse Lab, LoopForge AI, SliceTheory, AquierTv, AquierTvEs) — nieuwe tokens via env client.
- 15 `manual_review_required` items met unauthorized_client gereset naar queued → 2 verified_live + 13 file-not-found (verschoven probleem).
- Totaal 55 dode queue items opgeschoond (`cleanup-2026-05-20:` marker).
- 198 totale verified_live op YT (was 196).

---

## 📁 Code locaties (referentie)

- **Frontend (Next.js / Vercel)**: `frontend/`
- **YouTube engine + competitor scanner (Render)**: `youtube-engine/`
- **Orchestrator/executor (Render)**: `planning-engine/`
- **Mail engine (Render)**: `mail-engine/`
- **Database migraties (Supabase)**: `supabase/migrations/`
- **Deploy config**: `vercel.json`, `render.yaml`, `youtube-engine/docker-compose.yml`
- **Master plan**: `MASTER_BUILD_PLAN.md`

---

## 🗂️ Commit-stijl

`feat(scope): korte beschrijving` — body in NL, korte zinnen. Eindigt met `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>` voor Claude-bijdragen.
