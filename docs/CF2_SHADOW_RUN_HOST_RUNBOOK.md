# CF2 Shadow-Run — Host Runbook (Mac Mini)

Doel: de **eerste CF2 shadow-run** lokaal uitvoeren — content→scenes→voice→visual→music→thumbnail→render — **zonder upload, zonder publicatie, zonder spend**. Eén readiness-commando: `npm run cf2:shadow`.

> Veiligheid: `cf2:shadow` produceert/publiceert NIETS. Het controleert readiness, bouwt, en bereidt het shadow-run command voor. Het **stopt hard als `CF2_PUBLISH=1`**.

## B1–B6 checklist (cf2:shadow dekt al deze checks af)
| ID | Check | Fix |
|---|---|---|
| B1 | TTS-provider (`TTS_PROVIDER`) bereikbaar | `pipx install edge-tts` (of piper/espeak) |
| B2 | `PEXELS_API_KEY` gezet | gratis key op pexels.com/api → `.env` |
| B3 | `MUSIC_CATALOG` gezet | royalty-free muziekbron (bucket/pad) → `.env` |
| B4 | `CAPTION_FONT` bestaat | geldig `.ttf`-pad → `.env` |
| B5 | Ollama (`:11434`) + LM Studio (`:1234`) bereikbaar | `ollama serve`; LM Studio server starten |
| B6 | Build `dist/cf2-producer.js` | `npm ci && npm run build` (cf2:shadow bouwt zelf indien nodig) |
| — | FFmpeg + Supabase-env | `brew install ffmpeg`; `.env` met SUPABASE_URL/SERVICE_ROLE_KEY |

## Exacte commando's
```bash
# 0. Host-tools
brew install ffmpeg espeak
pipx install edge-tts

# 1. Lokale modellen
ollama serve & ; ollama pull llama3.2          # :11434
# LM Studio → model laden → "Start Server" (:1234)

# 2. .env vullen (uit .env.example) — GEEN echte secrets in git
cd local-agent && cp -n .env.example .env
#   vul: SUPABASE_SERVICE_ROLE_KEY, PEXELS_API_KEY, MUSIC_CATALOG, CAPTION_FONT
#   laat staan: CF2_PRODUCER_MODE=prepared, CF2_PUBLISH=0, CF2_PRODUCER_RUN=0

# 3. Readiness + build (geen productie)
npm ci
npm run cf2:shadow

# 4. Shadow-run (PAS uitvoeren als cf2:shadow alles groen meldt) — lokaal, GEEN upload
CF2_PRODUCER_MODE=live CF2_PRODUCER_RUN=1 node dist/cf2-producer.js
```

## Verwachte output
**`npm run cf2:shadow` (alles groen):**
```
CF2 shadow-run readiness — mode=prepared · publish=0
  ✅ [B5a] Ollama bereikbaar
  ✅ [B5b] LM Studio bereikbaar
  ✅ [B1] TTS-provider (edge_tts)
  ✅ [FF] FFmpeg
  ✅ [B2] PEXELS_API_KEY
  ✅ [B3] MUSIC_CATALOG
  ✅ [B4] CAPTION_FONT bestaat
  ✅ [ENV] Supabase env
  ✅ [B6] Build (dist/cf2-producer.js)

Alle checks groen. Voer de shadow-run zelf uit (lokaal, GEEN upload):
  CF2_PRODUCER_MODE=live CF2_PRODUCER_RUN=1 node dist/cf2-producer.js
```
**Shadow-run:** `{ mode:'live', health:{ollama:true,lmstudio:true}, processed:N, pending:22 }` + per job gevulde `cf2_job_steps` (creative/thumbnail/video=done, upload=skipped) + ≥1 `video_projects.render_url`.

## Failure cases
| Symptoom | Oorzaak | Fix |
|---|---|---|
| HARD STOP exit 2 | `CF2_PUBLISH=1` | zet op 0 — shadow publiceert nooit |
| `[B1] ❌` | geen TTS-binary | `pipx install edge-tts` of `brew install espeak` |
| `[B5a/b] ❌` | model niet gestart | `ollama serve` / LM Studio server |
| video-stap `failed: VOICE_GATE_NO_PROVIDER` | TTS ontbreekt tijdens run | idem B1 |
| `VISUAL_GATE_NO_PEXELS` | geen PEXELS key | B2 |
| `MUSIC_GATE_NO_SOURCE` | geen MUSIC_CATALOG | B3 |
| thumbnail-gate `failed` | geen thumbnail (verplicht) | controleer visual/font; thumbnail is hard vereist |
| `[B6] ❌` | tsc-fout | `npm ci && npm run build`, los TS-fouten op |

## Rollback / stop
- **Stoppen tijdens run:** `Ctrl-C` (idempotent; geen upload onderweg).
- **Producties terugdraaien (lokaal, niet gepubliceerd):**
  ```sql
  update public.cf2_jobs set status='planned' where status in ('producing','produced');
  update public.cf2_job_steps set status='pending', started_at=null, completed_at=null, failed_at=null, failure_reason=null
    where step in ('creative','thumbnail','video','upload','attribution');
  -- optioneel lokale render-projecten opruimen:
  delete from public.video_projects where status <> 'verified_live' and created_at > now()-interval '1 day';
  ```
- **Lokale bestanden:** verwijder `VIDEO_OUTPUT_DIR`.

## Bewijs dat upload/publicatie UIT blijft
- `cf2:shadow` stopt hard bij `CF2_PUBLISH=1` (geverifieerd: exit 2).
- Shadow-run gebruikt `runShadowTopic` → `noQueue` (geen `youtube_upload_queue`-insert).
- De upload-stap in `cf2-producer.ts` vuurt **alleen** bij `CF2_PUBLISH=1` én geslaagde render, en zet dan **altijd `privacy_status='private'`** (nooit direct publiek).
- Engine `content:cf2-video-projects-runner` blijft `enabled=false` (gated); `cf2:shadow` raakt engines niet aan.
- De YouTube-engine (upload-consument) draait los; zonder queue-rij is er geen upload.

> Eerste echte publicatie = aparte go's: `CF2_PUBLISH=1` (privé-queue) → review in War Room → handmatig public → engine enabled=true.
