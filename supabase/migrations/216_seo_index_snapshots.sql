-- 216_seo_index_snapshots.sql
-- Wekelijkse indexatie-tracker (Aquier kennisbank): snapshot per run van de
-- Google-index-status van de 274 pagina's, gemeten via de GSC URL-Inspection API.
create table if not exists vastgoed_core.seo_index_snapshots (
  id                     uuid primary key default gen_random_uuid(),
  captured_at            timestamptz not null default now(),
  total                  integer not null,
  indexed                integer not null default 0,
  crawled_not_indexed    integer not null default 0,
  discovered_not_indexed integer not null default 0,
  unknown                integer not null default 0,
  other                  integer not null default 0,
  details                jsonb
);
create index if not exists idx_seo_index_snapshots_at on vastgoed_core.seo_index_snapshots (captured_at desc);
