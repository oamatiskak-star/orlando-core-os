-- ─────────────────────────────────────────────────────────────────────────
-- Migration 086 — AQUIER_USA_DOMINATION_ENGINE (Build Tracker registratie)
-- ─────────────────────────────────────────────────────────────────────────
-- Registreert het overkoepelende USA-domination project + 11 build-tracker
-- secties + data-connector registry. Bestaande AQUIER_USA_ACTIVATION (90%)
-- wordt als CHILD gekoppeld (parent_project_id).
--
-- HARDE REGEL — GEEN MOCK DATA:
--   Alle live-cijfers worden via subqueries uit echte tabellen gelezen
--   (vastgoed_core.scraper_sources / kansenradar_scores / funnel_metrics_daily).
--   Bronnen zonder credentials krijgen status 'waiting_for_credentials' + 0.
--
-- Draait op het public schema. Vereist: gen_random_uuid(), tabellen uit 082.
-- ─────────────────────────────────────────────────────────────────────────

-- ── 1. Parent/child kolom op aquier_projects ───────────────────────────────
alter table public.aquier_projects
  add column if not exists parent_project_id uuid references public.aquier_projects(id) on delete set null;

create index if not exists aquier_projects_parent_idx
  on public.aquier_projects (parent_project_id);

-- ── 2. Parent project: AQUIER_USA_DOMINATION_ENGINE ─────────────────────────
insert into public.aquier_projects
  (code, name, module_ref, description, status, priority, progress_pct, owner_agent, start_at, metadata)
values
  ('AQUIER_USA_DOMINATION_ENGINE',
   'Aquier USA Domination Engine',
   'USA_DOMINATION',
   'AI Acquisition Operating System voor de VS — competitor intelligence, signal stacking, acquisition prediction, SEO/content dominantie en funnel intelligence. Overkoepelend project; AQUIER_USA_ACTIVATION is de afgeronde data/scoring sub-fase.',
   'in_progress', 'critical', 30, 'CONQUEST-USA',
   now(),
   jsonb_build_object(
     'no_mock_data', true,
     'data_posture', 'aggressive_scrape_all',
     'legal_note', 'CoStar/Reonomy/ATTOM scraping = ToS/litigatie-risico, expliciet geaccepteerd door Orlando',
     'first_engine', 'competitor-intel-engine'
   ))
on conflict (code) do update set
  name = excluded.name,
  description = excluded.description,
  status = excluded.status,
  priority = excluded.priority,
  owner_agent = excluded.owner_agent,
  metadata = excluded.metadata,
  updated_at = now();

-- Koppel de bestaande 90%-activation als child
update public.aquier_projects
set parent_project_id = (select id from public.aquier_projects where code = 'AQUIER_USA_DOMINATION_ENGINE')
where code = 'AQUIER_USA_ACTIVATION';

-- ── 3. Build-tracker secties tabel ──────────────────────────────────────────
create table if not exists public.aquier_project_sections (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.aquier_projects(id) on delete cascade,
  section_key text not null,
  name text not null,
  position int not null default 0,
  status text not null default 'pending'
    check (status in ('live','building','pending','blocked','waiting_for_source')),
  error_count int not null default 0,
  live_workers int not null default 0,
  active_tasks int not null default 0,
  pending_tasks int not null default 0,
  failed_tasks int not null default 0,
  success_ratio numeric(5,2) not null default 0,
  live_data_sources jsonb not null default '[]'::jsonb,
  api_status jsonb not null default '{}'::jsonb,
  growth_metrics jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  unique (project_id, section_key)
);

create index if not exists aquier_sections_project_idx
  on public.aquier_project_sections (project_id, position);

drop trigger if exists trg_aquier_sections_updated on public.aquier_project_sections;
create trigger trg_aquier_sections_updated
  before update on public.aquier_project_sections
  for each row execute function public.aquier_touch_updated_at();

-- ── 4. Data-connector registry ──────────────────────────────────────────────
create table if not exists public.aquier_data_connectors (
  id uuid primary key default gen_random_uuid(),
  section_key text not null,
  name text not null unique,
  category text not null,
  status text not null default 'waiting_for_credentials'
    check (status in ('live','waiting_for_credentials','error','disabled')),
  requires text[] not null default '{}',
  last_run_at timestamptz,
  objects_count bigint not null default 0,
  notes text,
  updated_at timestamptz not null default now()
);

create index if not exists aquier_connectors_status_idx
  on public.aquier_data_connectors (status, section_key);

drop trigger if exists trg_aquier_connectors_updated on public.aquier_data_connectors;
create trigger trg_aquier_connectors_updated
  before update on public.aquier_data_connectors
  for each row execute function public.aquier_touch_updated_at();

-- ── 5. Seed connectors — LIVE scrapers uit echte vastgoed_core.scraper_sources ─
insert into public.aquier_data_connectors (section_key, name, category, status, last_run_at, objects_count, notes)
select
  'usa_scrapers',
  s.name,
  'us_property_scraper',
  case when s.is_active then 'live' else 'disabled' end,
  s.last_successful_run,
  coalesce(s.total_objects_scraped, 0),
  'Tier '||coalesce(s.priority_tier::text,'?')||' US scraper (live count uit scraper_sources)'
from vastgoed_core.scraper_sources s
where s.country_id = (select id from vastgoed_core.countries where code = 'US')
on conflict (name) do update set
  status = excluded.status,
  objects_count = excluded.objects_count,
  last_run_at = excluded.last_run_at,
  updated_at = now();

-- ── 6. Seed connectors — bronnen die nog credentials/licenties nodig hebben ───
--    GEEN MOCK: deze tonen 0 + 'waiting_for_credentials' tot Orlando keys levert.
insert into public.aquier_data_connectors (section_key, name, category, status, requires, notes) values
  ('signal_stacking', 'attom',            'property_data_api',  'waiting_for_credentials', array['ATTOM_API_KEY'],            'Ownership/AVM/tax data'),
  ('signal_stacking', 'county_records',   'public_records',     'waiting_for_credentials', array['COUNTY_PORTAL_ACCESS'],     'Per-county recorder data (deeds, liens)'),
  ('signal_stacking', 'reonomy',          'cre_data_api',       'waiting_for_credentials', array['REONOMY_API_KEY'],          'CRE ownership intelligence (litigatie-risico)'),
  ('signal_stacking', 'tax_delinquency',  'public_records',     'waiting_for_credentials', array['TAX_DELINQUENCY_SOURCE'],   'Belastingachterstand signalen'),
  ('signal_stacking', 'permit_data',      'public_records',     'waiting_for_credentials', array['PERMIT_API_KEY'],           'Bouwvergunningen / development signalen'),
  ('signal_stacking', 'airbnb_trends',    'market_signal_api',  'waiting_for_credentials', array['AIRBNB_DATA_SOURCE'],       'Short-stay vraag/rendement trends'),
  ('signal_stacking', 'migration_data',   'market_signal_api',  'waiting_for_credentials', array['MIGRATION_DATA_SOURCE'],    'Bevolkings/migratie trends per metro'),
  ('competitor_intelligence', 'costar',       'competitor_site', 'waiting_for_credentials', array['PROXY_POOL'],             'CoStar publieke marketingpaginas (ToS-risico)'),
  ('competitor_intelligence', 'housecanary',  'competitor_site', 'waiting_for_credentials', array['PROXY_POOL'],             'HouseCanary publieke marketing/SEO'),
  ('competitor_intelligence', 'mashvisor',    'competitor_site', 'waiting_for_credentials', array['PROXY_POOL'],             'Mashvisor publieke marketing/SEO'),
  ('seo_expansion',           'backlink_api', 'seo_api',         'waiting_for_credentials', array['AHREFS_OR_SEMRUSH_KEY'],  'Backlink/keyword-volume data'),
  ('funnel_engine',           'heatmap',      'analytics_api',   'waiting_for_credentials', array['HEATMAP_TOOL_KEY'],       'Heatmap/sessie-replay tool'),
  ('youtube_automation',      'aquier_usa_channel',     'youtube_channel', 'waiting_for_credentials', array['YT_OAUTH_AQUIER_USA'],       'YouTube kanaal Aquier USA'),
  ('youtube_automation',      'private_investor_tv',    'youtube_channel', 'waiting_for_credentials', array['YT_OAUTH_PRIVATE_INVESTOR'], 'YouTube kanaal Private Investor TV')
on conflict (name) do nothing;

-- ── 7. Seed 11 build-tracker secties (FASE 7) met ECHTE beginwaarden ─────────
-- Helper-waarden uit live tabellen
do $$
declare
  v_project_id uuid;
  v_usa_country uuid;
  v_scraper_active int;
  v_scraper_total int;
  v_objects_total bigint;
  v_scored int;
  v_funnel_rows int;
  v_sources jsonb;
begin
  select id into v_project_id from public.aquier_projects where code = 'AQUIER_USA_DOMINATION_ENGINE';
  select id into v_usa_country from vastgoed_core.countries where code = 'US';

  select count(*) filter (where is_active),
         count(*),
         coalesce(sum(total_objects_scraped),0)
    into v_scraper_active, v_scraper_total, v_objects_total
  from vastgoed_core.scraper_sources where country_id = v_usa_country;

  select coalesce(jsonb_agg(jsonb_build_object('name', s.name, 'objects', coalesce(s.total_objects_scraped,0), 'active', s.is_active) order by s.name), '[]'::jsonb)
    into v_sources
  from vastgoed_core.scraper_sources s where s.country_id = v_usa_country;

  -- kansenradar scored properties (signal stacking bewijslast)
  begin
    execute 'select count(*) from vastgoed_core.kansenradar_scores' into v_scored;
  exception when others then v_scored := 0; end;

  begin
    execute 'select count(*) from vastgoed_core.funnel_metrics_daily' into v_funnel_rows;
  exception when others then v_funnel_rows := 0; end;

  insert into public.aquier_project_sections
    (project_id, section_key, name, position, status, live_workers, live_data_sources, growth_metrics) values
    (v_project_id, 'usa_scrapers',            'USA Scrapers',            1,
       case when v_objects_total > 0 then 'live' else 'building' end,
       0, v_sources,
       jsonb_build_object('active_scrapers', v_scraper_active, 'total_scrapers', v_scraper_total, 'objects_scraped', v_objects_total)),
    (v_project_id, 'competitor_intelligence', 'Competitor Intelligence', 2, 'building', 0,
       '[]'::jsonb, jsonb_build_object('platforms_tracked', 0, 'snapshots', 0)),
    (v_project_id, 'seo_expansion',           'SEO Expansion',           3, 'pending', 0,
       '[]'::jsonb, jsonb_build_object('pages_generated', 0)),
    (v_project_id, 'signal_stacking',         'Signal Stacking',         4,
       case when v_scored > 0 then 'live' else 'building' end, 0,
       '[]'::jsonb, jsonb_build_object('scored_properties', v_scored)),
    (v_project_id, 'content_engine',          'Content Engine',          5, 'pending', 0,
       '[]'::jsonb, jsonb_build_object('scripts_generated', 0)),
    (v_project_id, 'funnel_engine',           'Funnel Engine',           6,
       case when v_funnel_rows > 0 then 'live' else 'building' end, 0,
       '[]'::jsonb, jsonb_build_object('funnel_metric_days', v_funnel_rows)),
    (v_project_id, 'ai_prediction_engine',    'AI Prediction Engine',    7, 'pending', 0,
       '[]'::jsonb, '{}'::jsonb),
    (v_project_id, 'acquisition_radar',       'Acquisition Radar',       8, 'pending', 0,
       '[]'::jsonb, '{}'::jsonb),
    (v_project_id, 'investor_intelligence',   'Investor Intelligence',   9, 'pending', 0,
       '[]'::jsonb, '{}'::jsonb),
    (v_project_id, 'trend_detection',         'Trend Detection',        10, 'pending', 0,
       '[]'::jsonb, '{}'::jsonb),
    (v_project_id, 'youtube_automation',      'YouTube Automation',     11, 'pending', 0,
       '[]'::jsonb, '{}'::jsonb)
  on conflict (project_id, section_key) do nothing;
end $$;

-- ── 8. Monitor event = systeem geactiveerd ──────────────────────────────────
insert into public.aquier_monitor_events (severity, category, source_agent, title, detail, advice)
values ('success', 'operations', 'CONQUEST-USA',
  'AQUIER_USA_DOMINATION_ENGINE geregistreerd',
  '11 build-tracker secties + connector-registry live. AQUIER_USA_ACTIVATION (90%) gekoppeld als child. Geen mock data — credential-loze bronnen staan op waiting_for_credentials.',
  'Lever API-keys/proxy om waiting_for_credentials connectors live te zetten; competitor-intel-engine draait als eerste engine');
