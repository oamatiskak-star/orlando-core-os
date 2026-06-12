# S3 — Winner Replication Loop · oplevering

> Onderdeel van **AUTONOMOUS GROWTH PHASE 1** (P1). Status: **code-compleet in branch `feat/cf2-stronger-model-track`**, wacht op deploy + migratie 195.

## Uitgangspunt (live geverifieerd 12-06)
De replicatie-keten **bestond al** als SQL-functies — niet gedupliceerd:
`cf2_winner_variants` (DNA: hook_structure, scene_rhythm, replication_score; 30 'selected') → `cf2_seed_variants_to_horizon()` → `content_horizon` → `cf2_seed_jobs_from_horizon()` → `cf2_jobs` → `cf2-producer`.

Wat ontbrak: **autonome aansturing** (alles handmatig/gated) en de `winner-detector`-engine stond UIT. Bovendien was de bestaande variant-generator (`winner-replication.ts`) **LLM/credit-afhankelijk** (Anthropic €0).

## Wat S3 oplevert (deliverables 1-4)

| # | Deliverable | Hoe | Bestand |
|---|---|---|---|
| 1 | Winner detector activeren | `engine_schedule content:winner-detector` → `enabled=true` | migratie 195 |
| 2 | Winner DNA database | Bestaand `cf2_winner_variants` + `v_winner_intelligence` (hergebruikt) | — |
| 3 | Variant generation | **Credit-vrije** planning: `replicate_winners()` plant bewezen winners direct naar de queue (creatie door CF2-producer). LLM-variant-titels blijven optioneel via `winner-replication.ts`. | migratie 195 |
| 4 | Replication queue | `content_horizon` → `cf2_jobs` (status='planned'); zichtbaar via `v_replication_queue` | migratie 195 |
| + | Autonome run | Vercel-cron `winner-replication` (11:20): draineert variants + `replicate_winners(5, 14d cooldown)` | `api/youtube/cron/winner-replication/route.ts`, `vercel.json` |
| + | Engine Planner | `content:winner-detector` (aan) + `content:winner-replication` (nieuw) | migratie 195 |
| + | Dashboard | Replicatie-queue in de "Learnings & aanbevelingen"-card | `metrics/learning` + card |

## De autonome loop (credit-vrij)
`replicate_winners(p_max, p_cooldown_days)`:
1. Selecteert top bewezen winners uit `v_winner_intelligence` (`winner_status` ∈ top_5pct/winner) die **niet** binnen de cooldown al gerepliceerd zijn (dedupe op `cf2_jobs.source_winner_video_id`).
2. Plant ze in `content_horizon` (met `source_winner_video_id`, `bron_hook_category`, niche, channel-mapping via `media_holding_channels.youtube_channel_id`).
3. Roept `cf2_seed_jobs_from_horizon()` aan → `cf2_jobs` (status='planned'), die de **CF2-producer** oppakt.

**Geen LLM nodig voor de planning** — de creatie/render doet de producer. **Plant alleen jobs**: geen upload/spend (producer blijft gated, C-blockers).

## Read-only gevalideerd op live data
- **58 bewezen winners** klaar om te repliceren, **allen channel-mapped** — o.a. *"Rente op rente in 30 seconden"* (finance/money, score 99), *"Je eerste aandeel kopen"* (shock, 98), vastgoed/mystery.
- Met `p_max=5` + 14-daagse cooldown verloopt replicatie gedoseerd (geen vloedgolf).
- `v_replication_queue` toont nu al 21 bestaande winner-jobs.

## DoD
"Bij bewezen winnaar worden automatisch nieuwe varianten gepland" → ✅ via de cron-loop. Per run: bestaande winner-variants → horizon, plus 5 nieuwe directe winner-replicaties → cf2_jobs.

## Verificatie na deploy
1. Pas migratie 195 toe (CI/pipeline).
2. Trigger cron: `GET /api/youtube/cron/winner-replication` met `Authorization: Bearer <CRON_SECRET>` → `replication.winners_planned > 0`, `jobs_seeded > 0`.
3. `select status, count(*) from v_replication_queue group by status;` → nieuwe 'planned' rijen.
4. Dashboard: "Replicatie-queue: N gepland" in de learnings-card.
5. Producer (apart, gated) zet 'planned' → 'produced'.

## Niet in scope (volgt)
S4 Revenue engine/attributie (P1), S5 Director repair (P1), S6 Autonomous growth mode (P2). De CF2-producer live zetten (`CF2_PRODUCER_RUN/MODE`, `content:cf2-video-projects-runner`) blijft een aparte gate (C-blockers) — S3 vult enkel de queue.
