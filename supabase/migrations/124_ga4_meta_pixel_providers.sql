-- 124_ga4_meta_pixel_providers.sql
-- GA4 + Meta Pixel als account-setup providers via de bestaande browser-co-pilot
-- (run_kind='browser_registration'). Voegt ID-oogst toe: een 'extract'-fase op de
-- field-map leest het Measurement-ID (G-XXXX) / Pixel-ID van de pagina en schrijft
-- het terug naar affiliate_programs. Additief + idempotent. Geen mock.

-- 1) Oogst-kolommen op affiliate_programs
alter table public.affiliate_programs
  add column if not exists ga4_measurement_id text,
  add column if not exists meta_pixel_id      text;

-- 2) Extract-config op de field-map (gelezen door local-agent/browser/field-map.ts)
alter table public.account_setup_field_maps
  add column if not exists extract jsonb not null default '[]'::jsonb;

-- 3) Twee nieuwe account-setup-types (infra)
insert into public.account_setup_types
  (type_key, label, domain, description, checklist, required_docs, default_run_kind, active, sort_order)
values
 ('google_analytics_4', 'Google Analytics 4', 'infra',
  'GA4-property + webstream aanmaken en het Measurement ID (G-XXXX) oogsten.',
  '[{"step":"Log in op Google Analytics","action_kind":"approve_action"},{"step":"Maak property + webstream voor aquier.com","action_kind":"approve_submit"},{"step":"Measurement ID geoogst","action_kind":"manual_review"}]'::jsonb,
  '[]'::jsonb, 'browser_registration', true, 50),
 ('meta_facebook_pixel', 'Meta Pixel', 'infra',
  'Meta Pixel (dataset) aanmaken in Events Manager en het Pixel ID oogsten.',
  '[{"step":"Log in op Meta Business / Events Manager","action_kind":"approve_action"},{"step":"Maak Pixel/dataset voor aquier.com","action_kind":"approve_submit"},{"step":"Pixel ID geoogst","action_kind":"manual_review"}]'::jsonb,
  '[]'::jsonb, 'browser_registration', true, 51)
on conflict (type_key) do update set
  label            = excluded.label,
  domain           = excluded.domain,
  description      = excluded.description,
  checklist        = excluded.checklist,
  required_docs    = excluded.required_docs,
  default_run_kind = excluded.default_run_kind,
  active           = true;

-- 4) Twee programma's onder Modiwerijo Financial Management BV (Aquier valt hieronder)
insert into public.affiliate_programs
  (id, company_id, name, account_type, account_status, login_status, category)
values
 ('0a400a4d-0000-4000-a000-000000000001'::uuid, '4679cb71-dab5-4e80-aae1-59db58dfe6c5',
  'Aquier — Google Analytics 4', 'google_analytics_4', 'not_started', 'none', 'other'),
 ('0b400b16-0000-4000-b000-000000000002'::uuid, '4679cb71-dab5-4e80-aae1-59db58dfe6c5',
  'Aquier — Meta Pixel', 'meta_facebook_pixel', 'not_started', 'none', 'other')
on conflict (id) do nothing;

-- 5) Field-maps: geen auto-fill (mens drijft de wizard achter de goedkeurings-gate),
--    submit-selectors leeg, en een extract-regel die het ID van de pagina oogst.
insert into public.account_setup_field_maps
  (program_id, signup_url, fields, success_patterns, submit_selectors, extract, source)
select '0a400a4d-0000-4000-a000-000000000001'::uuid,
       'https://analytics.google.com/analytics/web/',
       '[]'::jsonb,
       '["measurement id","g-"]'::jsonb,
       '[]'::jsonb,
       '[{"field":"ga4_measurement_id","target_column":"ga4_measurement_id","pattern":"G-[A-Z0-9]{6,12}","from":"page_text"}]'::jsonb,
       'seed'
where not exists (select 1 from public.account_setup_field_maps
                  where program_id = '0a400a4d-0000-4000-a000-000000000001'::uuid);

insert into public.account_setup_field_maps
  (program_id, signup_url, fields, success_patterns, submit_selectors, extract, source)
select '0b400b16-0000-4000-b000-000000000002'::uuid,
       'https://business.facebook.com/events_manager2/',
       '[]'::jsonb,
       '["dataset id","pixel id"]'::jsonb,
       '[]'::jsonb,
       '[{"field":"meta_pixel_id","target_column":"meta_pixel_id","pattern":"(?:Dataset ID|Pixel ID|Dataset-ID|Pixel-ID)[^0-9]{0,24}(\\d{6,})","from":"page_text"}]'::jsonb,
       'seed'
where not exists (select 1 from public.account_setup_field_maps
                  where program_id = '0b400b16-0000-4000-b000-000000000002'::uuid);
