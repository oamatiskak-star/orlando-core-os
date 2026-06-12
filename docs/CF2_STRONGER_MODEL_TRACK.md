# CF2 — Stronger-Model Track (Mac Mini) — gated runbook

> **Apart spoor.** Doel: de resterende winst in **absolute beeldrelevantie** (topic_relevance) ophalen door de bottleneck aan te pakken die CF2.10 bewees: het lokale **8B-model (llama3.1:8b) is te variabel/zwak** om consistent concrete, niche-specifieke scene-queries te leveren. Prompt- en heuristiek-fixes (CF2.7 preservation, CF2.10 scene-query V2) zijn veilig en gated, maar lossen dit **niet** op — het model is de bottleneck.
>
> Dit is **geen codewijziging**: het is een operator-runbook voor een sterker model op de Mac Mini, gevolgd door her-validatie van de bestaande gated flags. **Niets gaat default aan; geen upload/publicatie/spend.**

## Waarom (bewezen)
| Stap | Uitkomst |
|---|---|
| CF2.6 | onderwerpvervanging door niche-ankers → topic 26.7 (−55%) |
| CF2.7 | Scene Intent Preservation → 0 vervanging, niche-onafhankelijk (5 niches) |
| CF2.8 | finance bevestiging → topic 70.7 > baseline |
| CF2.9 | multi-niche: 0 vervanging overal, MAAR absolute topic ~56 (model levert generieke raw-queries) |
| CF2.10 | scene-query V2 (prompt + concretize): variantie 8B-model (40↔60) domineert → onvoldoende |

**Conclusie:** de keten (render/preservation/gates) is bewezen. De resterende hefboom = **modelkwaliteit**, niet pipeline-code.

## Stap 1 — Modelkeuze (RAM-afhankelijk)
Bepaal eerst het RAM van de Mac Mini: `sysctl -n hw.memsize | awk '{print $1/1073741824" GB"}'`.

| Mac Mini RAM | Aanbevolen model | Grootte (Q4/MXFP4) | Notitie |
|---|---|---|---|
| **≥ 32 GB** | `openai/gpt-oss-20b` (al in LM Studio) of `Qwen2.5-32B-Instruct` | ~13–20 GB | Sterke instructie-volger; gpt-oss-20b is de directe upgrade die op 16GB faalde |
| **24 GB** | `openai/gpt-oss-20b` (krap) of **`Qwen2.5-14B-Instruct`** | ~9–14 GB | Qwen2.5-14B = veilige sterke keus |
| **16 GB** | `Qwen2.5-14B-Instruct` (Q4) of `Mistral-Small`/`gemma-2-9b` | ~7–9 GB | gpt-oss-20b past NIET (bewezen op CLI-L) |

> Voorkeur: **gpt-oss-20b** indien ≥24–32 GB (al gedownload in LM Studio op CLI-L; download op Mac Mini). Anders **Qwen2.5-14B-Instruct** — uitstekende instructie-naleving, kleiner.

## Stap 2 — Setup (LM Studio of Ollama)
**LM Studio (aanbevolen voor gpt-oss-20b):**
1. Open LM Studio → download het model → **laad** het → start de **server** (poort `:1234`).
2. Verifieer geladen model: `curl -s http://127.0.0.1:1234/v1/models` → de model-id verschijnt (bv. `openai/gpt-oss-20b`).
3. Smoke-test (echt geladen, niet JIT-fail): `curl -s http://127.0.0.1:1234/v1/chat/completions -H "Content-Type: application/json" -d '{"model":"<model-id>","messages":[{"role":"user","content":"Reply OK"}],"max_tokens":10}'` → echt antwoord (geen "insufficient system resources").

**Ollama-alternatief (Qwen):** `ollama pull qwen2.5:14b-instruct` → bevestig `ollama ps`.

## Stap 3 — `.env` config (lokaal, gitignored — gated)
In `local-agent/.env` (alleen lokaal; nooit committen):
```bash
# LM Studio pad:
USE_LM_STUDIO=true
LM_STUDIO_MODEL=openai/gpt-oss-20b      # exacte id uit /v1/models
# Ollama pad (alternatief):
# USE_LM_STUDIO=false
# OLLAMA_MODEL=qwen2.5:14b-instruct
```
Gating ongewijzigd: `CF2_PRODUCER_MODE`, `CF2_PRODUCER_RUN`, `CF2_PUBLISH=0`, en de twee feature-flags blijven **UIT** (alleen op de command-line tijdens validatie).

## Stap 4 — Build + preflight
```bash
cd local-agent && npm ci && npm run build
npm run cf2:shadow        # B1–B6 groen (incl. LM Studio :1234 bereikbaar)
```

## Stap 5 — Her-validatie (A/B/C/D + multi-niche)
Draai per topic vier varianten (gated shadow-runs, `CF2_PRODUCER_LIMIT=1`, geen upload). Gebruik **dezelfde test-job/topic** voor een eerlijke vergelijking. Seed een schone niche-job zoals in CF2.8 (horizon + cf2_job + 9 steps), zet `created_at` oudste → `LIMIT=1` pakt 'm.

```bash
# A — baseline (beide flags uit) — sterker model alleen
CF2_PRODUCER_MODE=live CF2_PRODUCER_RUN=1 CF2_PRODUCER_LIMIT=1 node dist/cf2-producer.js
# B — + scene-query V2
CF2_SCENE_QUERY_V2=1 CF2_PRODUCER_MODE=live CF2_PRODUCER_RUN=1 CF2_PRODUCER_LIMIT=1 node dist/cf2-producer.js
# C — + intent preservation
CF2_QUERY_INTELLIGENCE=1 CF2_PRODUCER_MODE=live CF2_PRODUCER_RUN=1 CF2_PRODUCER_LIMIT=1 node dist/cf2-producer.js
# D — beide samen
CF2_SCENE_QUERY_V2=1 CF2_QUERY_INTELLIGENCE=1 CF2_PRODUCER_MODE=live CF2_PRODUCER_RUN=1 CF2_PRODUCER_LIMIT=1 node dist/cf2-producer.js
```
Daarna **multi-niche** (CF2.9-stijl): finance/vastgoed/bouw/AI/marketing, variant D.

**Audit per run (vision):** een Claude-sessie extraheert frames uit de gekozen visuals (`cf2_visual_decisions` → `visual_assets.local_asset_url`, ffmpeg frame-grab) en scoort `topic_relevance`; schrijft per scene naar `visual_assets.topic_relevance` (zoals CLI-R-audit 99489ee0). Controleer ook `v_cf2_query_decisions` (modes/subject_replacement) en de gates.

## Stap 6 — Acceptatie (per niche + totaal)
PER NICHE PASS wanneer:
- `topic_relevance ≥ baseline 68.8` (of aantoonbaar stabiel zonder regressie)
- `subject_replacement = 0` · `intent_similarity ≥ 0.95`
- raw-queries aantoonbaar concreter dan llama3.1:8b (minder "person doing X", meer "stock market trading floor")

DEFAULT-ACTIVATION VOORSTEL (apart, na Orlando-GO) wanneer **alle niches PASS** EN gates dicht (0 uploads/publicatie/spend/auto-resource) EN `query_decision`-logging aanwezig.

## Harde gates (blijven gesloten)
- Geen uploads · geen publicatie · geen YouTube · geen spend · geen engine `enabled=true`.
- `CF2_QUERY_INTELLIGENCE`, `CF2_SCENE_QUERY_V2`, model-`.env` **alleen lokaal/command-line** tot validatie PASS én Orlando's expliciete GO.
- Geen default-flip zonder bewezen multi-niche PASS.

## Beslisboom
```
sterker model draait → A/B/C/D + multi-niche → audit
   ├─ alle niches topic ≥ 68.8 + 0 vervanging  → "DEFAULT-VOORSTEL JA" → wacht op GO → aparte PR CF2.11 default-activation
   ├─ beter dan 8B maar < baseline             → tuning (prompt/concretize) of nog sterker model
   └─ geen verbetering                          → model is niet de bottleneck → heroverweeg (visual_intent-gebaseerde search, extra stockbron)
```

## Wat dit spoor NIET doet
Geen nieuwe features, geen architectuurwijziging, geen upload/publish-pad. Puur: sterker model + her-validatie van bestaande gated flags. De CF2.7-preservation en CF2.10-scene-query-V2 code (PR #172 gemerged / #190 open) blijven de basis.
