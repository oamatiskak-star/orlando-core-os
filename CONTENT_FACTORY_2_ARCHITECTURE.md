# CONTENT FACTORY 2.0 — AUTOMATED VISUAL PRODUCTION ENGINE
## FASE 1 — ARCHITECTUURPLAN (CLI-L, 2026-06-08)

**Repo:** orlando-core-os · **Doel:** 74 video's/dag, volledig autonoom (geen handmatige link-/scene-/upload-input), premium kwaliteit, harde QC + menselijke approval vóór upload. Ssemble = referentie-functionaliteit, niet bediend.

> **Geen migraties/builds uitgevoerd.** Dit is uitsluitend het plan ter goedkeuring.

---

## 1. INVENTARIS — wat bestaat al (geverifieerd, hergebruiken)

### Tools / engines
| Onderdeel | Bestaand | Locatie |
|---|---|---|
| Content/script-generator | ✅ | `local-agent/src/factory.ts` (CHANNELS, topic-pick) + `local-agent/src/lib/ai.ts` (LM Studio/Ollama → title/script/hook/cta/thumbnail_concept) |
| Stock-footage path | ✅ | `content-worker/` + `lib/pexels.ts` (Pexels) + `lib/ffmpeg.ts` |
| Video-assemblage | ✅ (FFmpeg+PIL) | `local-agent/src/lib/video.ts` (titelcard+audio composite, 16:9 & 9:16) |
| Voice (TTS) | ✅ (basic) | `local-agent/src/lib/tts.ts` — **Microsoft edge-tts** + espeak fallback (GEEN ElevenLabs) |
| Muziek-mux | ✅ | `youtube-engine/src/workers/ffmpeg-normalizer-worker.ts` + audio-library scan |
| YouTube-thumbnail | ✅ (frame-extract) | `youtube-engine/src/generate-thumbnails.ts` + `workers/thumbnail-worker.ts` |
| Upload naar YouTube | ✅ | `youtube-engine/src/lib/youtube-api.ts` `uploadVideo()` (`videos.insert`) |
| **Upload-dispatcher (chokepoint)** | ✅ | `youtube-engine/src/workers/upload-orchestrator.ts` `pollQueuedItems()` L77–128 |
| Agent-framework | ✅ | `executive_agents` (DB) + `executive-engine/src/lib/agent-runner.ts` (Claude) + agents: viral-analyst, retention-scientist, algorithm-strategist, channel-manager, content-fund-manager |
| Quality-score (advisory) | ✅ | `frontend/app/api/youtube/quality-score/route.ts` (Claude via Vercel AI SDK) → schrijft `youtube_quality_scores` |
| LLM-helper | ✅ | `frontend/lib/ai/client.ts` (`claude.sonnet`) — **alleen in frontend**; engine roept AI via HTTP aan |
| Analytics-feedback | ✅ | `youtube-engine/src/workers/analytics-feedback-worker.ts` + `youtube_video_analytics` |

### Tabellen (bestaand, hergebruiken/uitbreiden)
- **`youtube_upload_queue`** — state machine. Status-CHECK: queued/preparing/normalizing/uploading/uploaded_pending_processing/processing/verifying/verified_live/failed/retrying/manual_review_required/cancelled. **Geen `blocked`/`rework`-status.**
- **`youtube_quality_scores`** — `title_score, hook_score, thumbnail_score, total_score, verdict(publish|improve|reject), feedback`. **Mist: visual/voice/music/cqi.**
- **`youtube_videos`**, **`youtube_upload_jobs`**, **`youtube_video_analytics`** (ctr/retention/watch_time/avg_view_pct — voedt learning loop).
- **`yt_content_calendar`** (script/hook/cta/thumbnail_concept), **`yt_scripts`**, **`yt_seo_data`**, **`yt_thumbnails`** (variant/main_text/sub_text/emotion — concept-only, géén scoring), **`yt_pipeline_configs/runs`**.
- **`media_holding_content_items`** (content_brief/retention_analysis/render_*), **`hook_library`** (success_score), **`content_radar_queue`**, **`content_fund_allocations`**.

---

## 2. GAP-ANALYSE — wat ontbreekt (te bouwen)

| Spec-onderdeel | Status | Actie |
|---|---|---|
| Scene-planner (script → scenes met visual_intent/shot/emotion/duration) | ❌ | NIEUW |
| Multi-source visual search + scoring (>85) | ❌ (alleen Pexels, geen scoring) | NIEUW visual-intelligence + provider-laag |
| `visual_assets` registry (source/license/scores/reuse) | ❌ | NIEUW tabel |
| Auto-download + scene-koppeling (geen handmatige links) | ❌ | NIEUW |
| Premium voice (≥95, ElevenLabs/OpenAI/Azure) | ❌ (edge-tts) | NIEUW voice-provider-abstractie |
| Voice/Visual/Music **scoring** | ❌ | NIEUW agent-routes |
| Thumbnail A/B/C + CTR-predictie ≥90 | ❌ (frame-extract) | NIEUW thumbnail-intelligence |
| **CQI + harde gate vóór upload** | ❌ (advisory only) | NIEUW gate in upload-orchestrator |
| Approval-queue (manual_approval=true) | ❌ | NIEUW statussen |
| Upload-verificatie-agent (live/thumb/UTM/pinned) | ⚠️ deels (verification-worker checkt alleen YouTube-policy) | UITBREIDEN |
| Learning loop 1/6/24/72u → agents | ⚠️ deels (analytics-feedback bestaat) | UITBREIDEN + `viral_patterns` |

---

## 3. RISICO'S (kritiek — lezen vóór go)

1. **🔴 Pipeline-halt.** Harde drempels (Voice≥95, Visual≥85, CQI≥90, "geen uitzonderingen") op de huidige **edge-tts + FFmpeg-titelcard**-output blokkeren vrijwel 100% → productie valt stil. **Mitigatie:** (a) premium voice (ElevenLabs) tilt voice_score; (b) `manual_approval`-gate als veiligheidsklep; (c) **shadow-kalibratiefase** (score+log, nog niet blokkeren) per kanaal vóór enforce.
2. **🔴 Betaalde clip-bronnen.** Pexels/Pixabay = gratis + publieke API ✅. **Storyblocks/Artgrid/MotionArray = betaald abonnement, géén publieke programmatische download-API; auto-download kan ToS/licentie schenden.** Voorstel: start met Pexels/Pixabay + eigen asset-library; betaalde bronnen alleen via geautoriseerde API/handmatige ingest in de library (niet auto-scrapen).
3. **🟠 Schaal/kosten.** 74 video's/dag × (multi-search + render + premium voice) = forse compute + API-kosten. ElevenLabs-kosten per 74×NL+EN voice-overs/dag; render-capaciteit (FFmpeg-farm). Begroting + rate-limits nodig.
4. **🟠 Engine heeft geen LLM-SDK.** youtube-engine (Render-worker) mag geen Anthropic-SDK krijgen → alle scoring-agents = **frontend Next.js API-routes**, door de engine via HTTP aangeroepen (zoals de bestaande quality-score-route).
5. **🟠 Repo-staat.** orlando-core-os staat op `feat/hermes-core-os-v2-self-routing` (bevroren Hermes-werk) met vervuilde working tree (` 2.*`-dupes). **Bouwen op een schone branch vanaf `main`.**
6. **🟡 Twee content-systemen.** `local-agent/factory` (→ youtube_upload_queue) naast `media_holding_content_items`. Nieuwe engine = nieuwe `video_projects`-spine die ná approval in de BESTAANDE `youtube_upload_queue` schrijft (bestaande upload-machinerie intact = lage blast radius).

---

## 4. DATAMODEL (voorstel — additief, NIET uitgevoerd)

Migratie **`153_content_factory_2.sql`** (additief, idempotent). Hergebruik bestaande tabellen waar mogelijk:

| Spec-tabel | Plan |
|---|---|
| `video_projects` | **NIEUW** — master per video: channel_id, topic, script, status (zie §5), language, format(16:9/9:16/1:1), cqi, approved bool, approved_by, rework_reason, queue_id→youtube_upload_queue |
| `video_scenes` | **NIEUW** — project_id, idx, voice_text, visual_intent, search_query, shot_type, emotion, pacing, music_intensity, caption_text, expected_duration, selected_asset_id |
| `visual_assets` | **NIEUW** — original_source_url, local_asset_url, source_provider, license, license_status, duration, resolution, topic_relevance, cinematic_score, freshness_score, uniqueness_score, reuse_count, final_visual_score, approved_for_reuse |
| `audio_assets` | **NIEUW** — kind(voice/music), provider, url, language, duration, scores(naturalness/emotion/pacing/clarity OR music scores), final_score |
| `thumbnail_variants` | **NIEUW** (of `yt_thumbnails` uitbreiden) — project_id, variant(A/B/C), image_url, ctr_prediction, contrast/curiosity/premium/readability/focus scores, chosen bool |
| `video_quality_scores` | **`youtube_quality_scores` UITBREIDEN** — kolommen toevoegen: visual_score, voice_score, music_score, content_quality_index, per-dimensie verdict; + view `v_video_cqi` |
| `video_approval_queue` | **statussen op `video_projects`** (geen aparte tabel nodig) |
| `upload_queue` | **HERGEBRUIK `youtube_upload_queue`** + nieuwe statussen `blocked`/`rework_required` in CHECK + `QueueStatus` TS-type (`youtube-engine/src/lib/supabase.ts`) |
| `upload_verification_logs` | **NIEUW** — queue_id, checks jsonb (live/thumb/title/desc/cta/pinned/utm/channel/privacy), passed bool, verified_at |
| `video_performance_metrics` | **HERGEBRUIK `youtube_video_analytics`** + checkpoints 1/6/24/72u |
| `viral_patterns` | **NIEUW** — niche, platform, pattern_type(hook/thumbnail/retention/music/pacing/visual), pattern jsonb, success_score, sampled_at |

---

## 5. STATUS-MACHINE (video_projects)
`draft → production_ready → quality_checked → awaiting_approval → approved → upload_ready → (youtube_upload_queue) → uploaded → verified_live`
Zijpaden: `rejected` (quality_gate_failed), `rework_required` → rework_queue.
**Upload-engine pakt alleen `upload_ready` + `approved=true`.**

---

## 6. BUILDVOLGORDE

**FASE 2 — Minimale werkende pipeline** (topic→script→scenes→visuals→voice→render→QC→approval)
- `local-agent` of nieuwe `visual-production-engine/`: scene-planner (script→scenes), visual-search (Pexels/Pixabay + cinematic scoring), auto-download→`visual_assets`, voice-provider-abstractie (edge-tts → ElevenLabs pluggable), FFmpeg scene-concat render (16:9 + 9:16), captions (whisper/forced-align of script-timed).
- QC-agents = frontend API-routes (`/api/youtube/quality/{hook,visual,voice,music,thumbnail,cqi}`) op `claude.sonnet`, schrijven scores.
- Schrijft `video_projects` met status t/m `awaiting_approval`.

**FASE 3 — Upload-engine bescherming**
- Gate in `upload-orchestrator.ts` `pollQueuedItems()` (L98–122): vóór `enqueueUpload` → check gekoppeld `video_projects.approved=true` + alle drempels + `content_quality_index≥90`; anders status `blocked`/`rework_required` + `continue`. Defensieve 2e check in `youtube-upload-worker.ts` vóór `uploadVideo`.

**FASE 4 — Dashboard** (`frontend/app/dashboard/media-holding/content-quality-center/`)
- Per video: thumbnail/hook/voice/visual/music/CQI met kleurcodering (≥90 groen / 80–89 oranje / <80 rood). Approval-queue UI (approve/reject/rework). Leest `video_projects` ⋈ `youtube_quality_scores`.

**FASE 5 — Learning loop**
- `analytics-feedback-worker` uitbreiden: checkpoints 1/6/24/72u (CTR/views/retention/AVD/watchtime/subs/Aquier-clicks) → schrijf `viral_patterns` → voed hook/thumbnail/visual/music-agents (prompt-context + drempel-kalibratie).

---

## 7. BESLISSINGEN NODIG VÓÓR FASE 2
1. **Voice-provider:** ElevenLabs (beste kwaliteit, betaald) / OpenAI TTS / Azure Neural / edge-tts-behouden-en-kalibreren? → bepaalt of voice_score≥95 haalbaar is.
2. **Clip-bronnen:** start Pexels+Pixabay+eigen library (gratis/legaal) — akkoord betaalde bronnen (Storyblocks/Artgrid/MotionArray) buiten scope tot geautoriseerde API?
3. **Enforce-modus:** shadow-kalibratie eerst (aanbevolen, geen halt) → daarna hard enforce per kanaal? Of direct hard + leunen op `manual_approval`?
4. **Build-branch:** schone branch vanaf `main` in orlando-core-os (aanbevolen, want huidige branch = bevroren Hermes-v2 + vervuild).
5. **Render-stack:** FFmpeg (bestaand, stabiel, gratis) als basis; Remotion/Shotstack alleen als FFmpeg-scene-concat tekortschiet?
