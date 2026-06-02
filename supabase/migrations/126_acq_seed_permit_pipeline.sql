-- 126_acq_seed_permit_pipeline.sql
-- Acquisition-pijplijn dichttimmeren:
--  (1) Twee nieuwe radars registreren in de Engine Planner (vuistregel):
--      acq_radar:seed-deals (zaait acq_deals) + acq_radar:permit-source (vult acq_permits).
--  (2) Watchdog cron-lateness checks voor beide nieuwe crons + bestaande
--      acquisition-schema's uitlijnen met vercel.json (waren scheef → vals alarm).
--      Severity acquisition-crons → 'warning' (late cron is geen failed service;
--      voorkomt directe Telegram-push via hermes_notify_now).
--  (3) Data-freshness voor acq_deals/acq_permits: allow_empty — lege pijplijn-tabel
--      (nog geen kwalificerende rijen) is geen storing.

-- ── (1) Engine Planner: nieuwe radars in het acq_radar-tijdblok (04:00–06:00) ──
insert into public.engine_schedule (engine_key, grp, label, block_key, enabled)
values
  ('acq_radar:permit-source', 'acq_radar', 'Vergunning-bron', 'acq_radar', true),
  ('acq_radar:seed-deals',    'acq_radar', 'Deal-zaaier',     'acq_radar', true)
on conflict (engine_key) do update
  set label = excluded.label, block_key = excluded.block_key, enabled = excluded.enabled;

-- ── (2a) Nieuwe watchdog cron-lateness checks (schema's = vercel.json) ─────────
insert into public.infra_watchdog_checks
  (slug, display_name, check_type, layer, category, config, threshold,
   interval_seconds, consecutive_failures_to_escalate, severity, notes)
values
  ('cron.vercel.acquisition.permit-source', 'Vercel cron: acquisition permit-source (04:10)',
   'cron_lateness', 'app', 'vercel-cron',
   '{"slug":"cron.vercel.acquisition.permit-source","schedule":"10 4 * * *"}',
   '{"grace_seconds":3600}', 3600, 2, 'warning',
   'Vult acq_permits vóór permit-scan (04:40).'),
  ('cron.vercel.acquisition.seed-deals', 'Vercel cron: acquisition seed-deals (05:10)',
   'cron_lateness', 'app', 'vercel-cron',
   '{"slug":"cron.vercel.acquisition.seed-deals","schedule":"10 5 * * *"}',
   '{"grace_seconds":3600}', 3600, 2, 'warning',
   'Zaait acq_deals vóór deal-scan (05:20).')
on conflict (slug) do update
  set config = excluded.config, threshold = excluded.threshold, severity = excluded.severity, notes = excluded.notes;

-- ── (2b) Bestaande acquisition-schema's uitlijnen met vercel.json + warning ────
update public.infra_watchdog_checks set config = config || '{"schedule":"0 4 * * *"}'::jsonb,  severity='warning' where slug='cron.vercel.acquisition.bouw-scan';
update public.infra_watchdog_checks set config = config || '{"schedule":"20 4 * * *"}'::jsonb, severity='warning' where slug='cron.vercel.acquisition.distress-scan';
update public.infra_watchdog_checks set config = config || '{"schedule":"40 4 * * *"}'::jsonb, severity='warning' where slug='cron.vercel.acquisition.permit-scan';
update public.infra_watchdog_checks set config = config || '{"schedule":"0 5 * * *"}'::jsonb,  severity='warning' where slug='cron.vercel.acquisition.offmarket-scan';
update public.infra_watchdog_checks set config = config || '{"schedule":"20 5 * * *"}'::jsonb, severity='warning' where slug='cron.vercel.acquisition.deal-scan';
update public.infra_watchdog_checks set config = config || '{"schedule":"40 5 * * *"}'::jsonb, severity='warning' where slug='cron.vercel.acquisition.director-briefing';

-- ── (3) Data-freshness: lege deal/permit-pijplijn is geen storing ─────────────
update public.infra_watchdog_checks set config = config || '{"allow_empty":true}'::jsonb where slug='data.acq_deals.fresh';
update public.infra_watchdog_checks set config = config || '{"allow_empty":true}'::jsonb where slug='data.acq_permits.fresh';
