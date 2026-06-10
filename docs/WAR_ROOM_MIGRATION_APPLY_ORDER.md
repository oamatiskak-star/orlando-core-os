# War Room — exacte apply-volgorde migraties 164–170

> Alle migraties zijn **additief, reversibel, gated** (views/tabellen/functies; geen deletes,
> geen spend). Engines worden enabled=false geregistreerd — er draait **niets** tot je ze
> apart aanzet. Pas in deze volgorde toe (afhankelijkheden zijn gerespecteerd).

## Volgorde (verplicht)

| # | Migratie | Wat | Afhankelijkheid |
|---|---|---|---|
| 1 | `164_war_room_youtube_source.sql` | `v_war_room_nodes` = superset 161+162 **+ youtube_videos** als creative/platform-nodes (cap 40/kanaal). **Live content + thumbnails.** | — |
| 2 | `165_channel_strategy.sql` | `channel_strategy` + `v_channel_strategy` (modes growth/authority/revenue). | — |
| 3 | `166_content_horizon.sql` | `content_horizon` + `v_niche_momentum` + `v_viral_candidates` + gated planner. | — |
| 4 | `167_winner_detector.sql` | `detect_content_winners()` (gated). | — |
| 5 | `168_platform_health_maintenance.sql` | `v_ph_*` + `db_health_audits` + `run_db_janitor()`. | **na 166** (v_ph_queue leest `content_horizon`) |
| 6 | `169_hook_intelligence.sql` | `v_hook_classified` + `v_hook_category_perf` (14 categorieën). | — |
| 7 | `170_winner_intelligence.sql` | `v_winner_intelligence` + `variation_requests`. | **na 169** (leest `v_hook_classified`) |

Kritieke afhankelijkheden: **166 vóór 168**, **169 vóór 170**. De volgorde 164→165→166→167→168→169→170 voldoet hieraan.

## Toepassen (per migratie)
Pas elk `.sql`-bestand uit `supabase/migrations/` toe op project **shaunum** (Supabase SQL editor of CLI). Allemaal `create or replace` / `create table if not exists` → idempotent, veilig her-uitvoerbaar.

## Live-check ná toepassen
```sql
-- 1) Live content + thumbnails (was 72)
select count(*) from v_war_room_nodes where node_type='creative';            -- ~398
-- 2) Hook Intelligence gevuld
select category, count(*) from v_hook_classified group by category order by 2 desc;
-- 3) Winner Intelligence gevuld
select count(*) from v_winner_intelligence;
-- 4) Channel Strategy / Platform Health
select name, mode from v_channel_strategy;
select * from v_ph_storage;
```
UI: open `/dashboard/media-holding/war-room/workspace` → Creative Library toont YouTube-thumbnails (i.ytimg.com); Hook Intelligence + Winners gevuld.

## Apart aanzetten (NA review, jouw go — spend/host)
Niet nodig voor de live-check hierboven. Voor autonome productie:
1. Engines: `update engine_schedule set enabled=true, block_key='<blok>' where engine_key in ('content:horizon-planner','content:winner-detector','maintenance:db-janitor');`
2. CF2-producer deployen (zie `docs/CONTENT_FACTORY_REACTIVATION.md`) — vereist migratie 153 + host-worker + API-keys (spend).
