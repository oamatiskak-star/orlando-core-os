-- 212_s14_affiliate_revenue_sync_scheduler.sql
-- Autonome revenue-sync scheduler — Engine-Planner-registratie.
--
-- Sluit het laatste software-gat in de affiliate-revenue-ingest: er was geen autonome
-- trigger die `revenue_sync`-runs aanmaakte (alleen handmatig via de payouts-UI). Deze
-- scheduler-cron (frontend route /api/media-holding/affiliate-engine/sync) enqueued per
-- programma met een ACTIEVE connector een `revenue_sync`-run, en maakt programma's zonder
-- connector/credentials zichtbaar als MANUAL (account_setup_human_actions).
--
-- VEILIG/ADDITIEF: raakt NIET de revenue->allocatie-keten (211_s13), monetization_streams,
-- of bestaande triggers. Alleen Engine-Planner-registratie hier; alle logica zit in de route.
-- Deelt het lichte 'youtube'-blok met media:affiliate-revenue-import (complementair, licht).
--
-- VERVOLGSTAP (genoteerd, NIET hier): het connector/`revenue_sync`-pad vult
-- affiliate_revenue_ledger maar bereikt monetization_streams niet — daardoor telt
-- connector-omzet nog niet mee in 211_s13's allocatie/60k-projectie. Dat gat dichten pas
-- NA merge/validatie van 211_s13 door CLI-R (om ketenconflict te vermijden).

insert into public.engine_schedule (engine_key, grp, label, block_key, enabled) values
  ('media:affiliate-revenue-sync', 'media', 'S14 Affiliate revenue-sync scheduler (connector -> revenue_sync-run)', 'youtube', true)
on conflict (engine_key) do update set enabled = true, label = excluded.label, block_key = excluded.block_key, updated_at = now();
