-- 094_acq_radars_planner.sql
-- Activeert de stille acquisitie-radars en plant ze in de Engine Planner.
-- Eigen nachtblok (04:00–06:00, vóór alle scraper-blokken) zodat ze nooit met de
-- scrapers botsen. Per radar een eigen engine_key zodat de UI ze toont/stuurt.

insert into public.engine_schedule_blocks (block_key,label,window_start,window_end,weight,color,sort) values
  ('acq_radar', 'Acquisitie radars (scan)', '04:00','06:00',2,'#ec4899',5)
on conflict (block_key) do nothing;

-- De 6 radars als planner-engines (grp 'acq_radar'), direct actief.
insert into public.engine_schedule (engine_key, grp, label, block_key, enabled) values
  ('acq_radar:bouw-scan',         'acq_radar', 'Bouw-radar',        'acq_radar', true),
  ('acq_radar:distress-scan',     'acq_radar', 'Distress-radar',    'acq_radar', true),
  ('acq_radar:permit-scan',       'acq_radar', 'Vergunning-radar',  'acq_radar', true),
  ('acq_radar:offmarket-scan',    'acq_radar', 'Off-market radar',  'acq_radar', true),
  ('acq_radar:deal-scan',         'acq_radar', 'Deal-radar',        'acq_radar', true),
  ('acq_radar:director-briefing', 'acq_radar', 'Director-briefing', 'acq_radar', true)
on conflict (engine_key) do update set enabled = excluded.enabled, block_key = excluded.block_key;
