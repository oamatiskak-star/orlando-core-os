-- 215_measurement_loop_schedule.sql
-- Fase 1 (meetlus) — Engine Planner rijen voor de twee meet-workers die WEL gebouwd zijn
-- maar nooit gescheduled werden (analytics-feedback + learning-loop).
-- Additief & idempotent. Geen tabel-/kolomwijziging. Conform CLAUDE.md Engine-Planner-vuistregel:
-- lichte read-engines mogen een bestaand blok delen -> 'janitor' (00:00-04:00, na settle van de dag).
--
-- Handhaving loopt automatisch via sync_engine_windows() (migratie 093, minuut-cron):
-- die zet engine_schedule.enabled = engine_window_open(engine_key). De workers checken
-- daarnaast zelf engine_window_open() (zie worker-edits in deze branch) voor fail-safe gating.
--
-- NB: aanzetten = puur observeren/leren. Onomkeerbaar niets. Gate: Orlando past mig op prod toe.

insert into public.engine_schedule (engine_key, grp, label, block_key, enabled)
values
  ('content:analytics-feedback', 'content', 'Analytics Feedback (CTR/retentie/RPM ingestie)', 'janitor', true),
  ('content:learning-loop',      'content', 'Learning Loop (checkpoints + viral_patterns)',   'janitor', true)
on conflict (engine_key) do update
  set grp       = excluded.grp,
      label     = excluded.label,
      block_key = excluded.block_key,
      updated_at = now();
