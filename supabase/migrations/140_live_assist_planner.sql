-- ─────────────────────────────────────────────────────────────────────────
-- Migration 140 — Live Assist Runner in de Engine Planner
-- ─────────────────────────────────────────────────────────────────────────
-- VUISTREGEL: elke nieuwe worker hoort in engine_schedule. De live-assist-runner
-- (co-watch: mens vult aanmeldformulieren, Setup Agent kijkt mee) is ON-DEMAND —
-- hij draait alleen wanneer de mens een sessie start. Daarom een 24u-ALTIJD-OPEN
-- blok: de runner wordt NIET venster-gated (consult van engine_window_open is
-- bewust niet in de claim-loop gewired); deze rij dient voor zichtbaarheid +
-- governance in /dashboard/planner.
--
-- Idempotent (on conflict do nothing / update).

insert into public.engine_schedule_blocks (block_key, label, window_start, window_end, weight, color, sort) values
  ('account_setup', 'Account Setup / Co-watch (on-demand, 24u)', '00:00:00', '23:59:59', 1, '#6366f1', 100)
on conflict (block_key) do nothing;

insert into public.engine_schedule (engine_key, grp, label, block_key, enabled) values
  ('account_setup:live-assist', 'account_setup', 'Live co-watch (Setup Agent)', 'account_setup', true)
on conflict (engine_key) do update set enabled = excluded.enabled, block_key = excluded.block_key;
