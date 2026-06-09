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

## 5. Bewijs-SQL (read-only) — ÉÉN query, met ingebouwd PASS/FAIL-verdict
Plak deze ene query na de run; één rij met alle bewijs + `shadow_verdict`:
```sql
with lp as (
  select * from public.video_projects order by created_at desc limit 1
),
lq as (
  select * from public.youtube_quality_scores
  where video_project_id = (select id from lp)
  order by created_at desc limit 1
),
cnt as (
  select
    (select count(*) from public.video_projects)                                            as vp,
    (select count(*) from public.video_scenes)                                              as sc,
    (select count(*) from public.audio_assets)                                              as au,
    (select count(*) from public.visual_assets)                                             as vi,
    (select count(*) from public.thumbnail_variants)                                        as th,
    (select count(*) from public.youtube_quality_scores where video_project_id is not null) as qc,
    (select count(*) from public.youtube_upload_queue q
       join public.video_projects p on p.queue_id = q.id)                                   as uq
)
select
  c.vp as video_projects, c.sc as video_scenes, c.au as audio_assets, c.vi as visual_assets,
  c.th as thumbnail_variants, c.qc as qc_scores, c.uq as upload_queue_inserts,
  lp.id as latest_project, lp.status, lp.approved, lp.queue_id, lp.rework_reason,
  lq.gate_passed, lq.gate_reason, lq.content_quality_index as cqi,
  case
    when c.vp > 0 and c.sc > 0 and c.qc >= 1
      and lp.status in ('awaiting_approval','rework_required')
      and lp.queue_id is null and lp.approved = false
      and c.uq = 0
    then 'PASS' else 'FAIL'
  end as shadow_verdict,
  nullif(concat_ws('; ',
    case when c.vp = 0 then 'video_projects=0' end,
    case when c.sc = 0 then 'video_scenes=0' end,
    case when c.qc = 0 then 'qc_scores=0' end,
    case when lp.status is null or lp.status not in ('awaiting_approval','rework_required') then 'status='||coalesce(lp.status,'(geen)') end,
    case when lp.queue_id is not null then 'queue_id_NOT_NULL' end,
    case when lp.approved then 'approved=true' end,
    case when c.uq > 0 then 'upload_queue_inserts>0' end
  ), '') as fail_reasons
from cnt c left join lp on true left join lq on true;
```
`shadow_verdict = PASS` ⇔ alle harde criteria uit §6 waar. `fail_reasons` toont
exact wat faalt (NULL bij PASS). Assets-aanwezig-of-`blocked_*` blijkt uit
`rework_reason`/`gate_reason` op de rij.

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
