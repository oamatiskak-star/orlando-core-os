# CF2 SHADOW-RUN — OPERATOR RUNBOOK

**Doel:** bewijzen dat de volledige Content Factory 2.0-keten records produceert
(topic → script → scenes → voice → visuals → music → thumbnail → render → QC),
**zonder** te uploaden, publiceren of approven. Alleen de live host heeft de
SUPABASE service-role env; daarom draait de record-producerende run dáár.

> **Veiligheid:** print/kopieer NOOIT `SUPABASE_SERVICE_ROLE_KEY` of andere secrets
> naar chat/logs. De runbook gebruikt ze uitsluitend als reeds-aanwezige env.

---

## 1. Vereiste environment (op de live host)
| Var | Verplicht | Reden |
|---|---|---|
| `SUPABASE_URL` | ✅ | DB-writes naar CF2-tabellen |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | service-role schrijfrechten (RLS) |
| `ANTHROPIC_API_KEY` | ⚠️ indien QC-LLM actief | QC draait in frontend-route; alleen nodig als `FRONTEND_QC_URL` wordt gezet |
| `FRONTEND_QC_URL` | ⚠️ optioneel | basis-URL van de Next.js-frontend voor `/api/youtube/quality/assess`; afwezig → QC-stap `blocked_missing_frontend_qc_url` (geen fake) |
| `PEXELS_API_KEY` | ⚠️ optioneel | echte visuals; afwezig → `blocked_missing_pexels_key` |
| `PIXABAY_API_KEY` | ⚠️ optioneel | tweede visual-bron |
| `MUSIC_CATALOG` | ⚠️ optioneel | pad naar licensed-track-JSON; afwezig → `blocked_missing_music_source` |
| Voice-provider | ⚠️ optioneel | `edge-tts`/`piper`/`XTTS_URL`/`OPENAI_API_KEY`/`ELEVENLABS_API_KEY`; geen → `blocked_no_voice_provider` |
| `ffmpeg` in PATH | ✅ | render + frame-extract |
| `OLLAMA_URL` of `LM_STUDIO_URL` | ✅ | content + scene-planner (lokale LLM) |

Ontbrekende optionele bron = **expliciete `blocked_*`-reden**, GEEN fake/placeholder.

## 2. Verboden acties (hard)
- Geen `youtube_upload_queue` insert · geen publish/upload · geen `approved=true`
- Geen `upload_ready`/`uploaded`/`verified_live` · `queue_id` blijft `NULL`
- Geen fake/mock assets · geen planner-enable · geen secrets in logs

## 3. Commands (live host)
```bash
cd local-agent
npm install            # eenmalig / na deps-wijziging
npm run build          # tsc → dist/
node dist/preflight.js # MOET PASS geven; anders STOP + rapporteer BLOCKED_*
# alleen bij PREFLIGHT: PASS →
node dist/video-projects-runner.js --shadow \
  --topic "Verborgen kansen in transformatievastgoed" \
  --niche vastgoed --lang nl --format 16:9
```

## 4. Verwachte output
- **Preflight PASS:** `{"ok":true,...}` + `PREFLIGHT: PASS`.
- **Preflight BLOCKED:** `PREFLIGHT: BLOCKED_MISSING_SUPABASE_ENV` (of `_LLM_RUNTIME`/`_FFMPEG`) → run draait NIET.
- **Shadow-run:** `SHADOW-RESULT: { projectId, sceneCount, voiceProvider, visualsSelected, musicScore, thumbnailVariants, renderUrl, cqi, gatePassed, status, reasons, noQueue:true }`. Bij ontbrekende bronnen → `status:"rework_required"` + `reasons` met `blocked_*`. Bij alle bronnen aanwezig + scores ≥ drempel → `status:"awaiting_approval"`.

## 5. Bewijs-SQL (read-only)
```sql
select
  (select count(*) from public.video_projects)                                   as video_projects,
  (select count(*) from public.video_scenes)                                     as scenes,
  (select count(*) from public.audio_assets)                                     as audio_assets,
  (select count(*) from public.visual_assets)                                    as visual_assets,
  (select count(*) from public.thumbnail_variants)                               as thumbnails,
  (select count(*) from public.youtube_quality_scores where video_project_id is not null) as qc_scores;

select id, status, approved, queue_id, rework_reason
from public.video_projects order by created_at desc limit 1;

select gate_passed, gate_reason, content_quality_index
from public.youtube_quality_scores where video_project_id is not null
order by created_at desc limit 1;

-- MOET 0 zijn (geen upload-queue write door de shadow-run):
select count(*) as upload_queue_rows_voor_dit_project from public.youtube_upload_queue q
join public.video_projects vp on vp.queue_id = q.id;
```

## 6. PASS-criteria (alle waar)
- `video_projects > 0`
- `video_scenes > 0`
- `youtube_quality_scores >= 1`
- laatste `status ∈ {awaiting_approval, rework_required}`
- `queue_id IS NULL`
- `approved = false`
- upload_queue inserts = 0
- assets aanwezig **of** correcte `blocked_*`-redenen

## 7. Na de run
- Bewijs PASS → meld terug; PR #148 blijft **ready**, NIET mergen zonder finale gate, 156/157 NIET prod-applyen zonder aparte opdracht.
- Bewijs BLOCKED → meld de exacte `BLOCKED_*`/`blocked_*`-reden; geen merge.
