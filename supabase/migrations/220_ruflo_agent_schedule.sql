-- 220_ruflo_agent_schedule.sql
-- Ruflo AI-orchestratie: nieuw tijdblok 'ai' (04:00-06:00 NL, na janitor, vóór YouTube)
-- + Engine Planner rijen voor ruflo-coördinator, AgentDB-sync en ReasoningBank.
-- Additief & idempotent. Geen schema-wijziging.
--
-- Rationale: het AI-blok loopt VÓÓR de YouTube-pipeline (06:00) zodat de ruflo-agent
-- viral_patterns kan analyseren en inzichten kan opslaan in AgentDB vóór de content-
-- productie begint. Het janitor-blok (00:00-04:00) doet cleanup; AI-blok doet voorbereiding.
--
-- sync_engine_windows() hoeft NIET uitgebreid te worden: ai:-engines hebben geen externe
-- flag-tabel. De ruflo-dispatcher checkt engine_window_open() direct (zoals cf2-producer).

insert into public.engine_schedule_blocks
  (block_key, label, window_start, window_end, weight, color, sort)
values
  ('ai', 'AI Orchestratie (Ruflo)', '04:00', '06:00', 2, '#7c3aed', 5)
on conflict (block_key) do nothing;

insert into public.engine_schedule (engine_key, grp, label, block_key, enabled)
values
  ('ai:ruflo-coordinator',  'ai', 'Ruflo Swarm Coördinator (dagplanning + trending research)', 'ai',      true),
  ('ai:agentdb-sync',       'ai', 'AgentDB Memory Sync (vectoren + patroon-consolidatie)',     'janitor', true),
  ('ai:reasoning-bank',     'ai', 'ReasoningBank Trajectories (verdict-opslag na productie)',  'janitor', true)
on conflict (engine_key) do update
  set grp       = excluded.grp,
      label     = excluded.label,
      block_key = excluded.block_key,
      updated_at = now();
