-- 095_mail_ops_planner.sql
-- Licht 'mail_ops'-blok voor doorlopende, ultralichte mail-ops jobs (status-flips).
-- Mag overlappen met scraper-blokken: weight=1 → veroorzaakt geen grote batch.
-- Registreert de mail auto-goedkeur-job zodat hij planner-stuurbaar is.

insert into public.engine_schedule_blocks (block_key,label,window_start,window_end,weight,color,sort) values
  ('mail_ops', 'Mail ops (licht, doorlopend)', '07:00','23:00',1,'#22d3ee',100)
on conflict (block_key) do nothing;

insert into public.engine_schedule (engine_key, grp, label, block_key, enabled) values
  ('mail_ops:auto-approve', 'mail_ops', 'Mail auto-goedkeuren', 'mail_ops', true)
on conflict (engine_key) do update set enabled = excluded.enabled, block_key = excluded.block_key;
