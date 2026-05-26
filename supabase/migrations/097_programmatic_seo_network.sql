-- 097_programmatic_seo_network.sql
-- Milestone 4 — Programmatic SEO Network fundering.
-- Domein-agnostisch schema voor 1000+ geautomatiseerde niche-pagina's.
-- No-mock: body_md blijft NULL tot AI genereert (runtime, ANTHROPIC_API_KEY).
-- Patroon hergebruikt Aquier programmatic SEO (markets/alternatives/compare).

-- 1) Niches (gevoed door bestaande YouTube-kanalen = bestaande audience/traffic, rule 10)
create table if not exists public.seo_niches (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique,
  naam         text not null,
  taal         text not null default 'nl',
  channel_link text,        -- bron YouTube-kanaal (bestaande asset)
  beschrijving text,
  status       text not null default 'active' check (status in ('active','paused')),
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

-- 2) Keyword clusters per niche (topic-architectuur, internal linking)
create table if not exists public.seo_keyword_clusters (
  id              uuid primary key default gen_random_uuid(),
  niche_id        uuid not null references public.seo_niches(id) on delete cascade,
  cluster         text not null,
  primary_keyword text not null,
  search_intent   text check (search_intent in ('informational','commercial','transactional','navigational')),
  priority        smallint not null default 0,
  created_at      timestamptz default now(),
  unique (niche_id, primary_keyword)
);

-- 3) Pagina's (status-driven; content key-gated)
create table if not exists public.seo_pages (
  id               uuid primary key default gen_random_uuid(),
  niche_id         uuid not null references public.seo_niches(id) on delete cascade,
  cluster_id       uuid references public.seo_keyword_clusters(id) on delete set null,
  slug             text not null,
  title            text,
  meta_description text,
  h1               text,
  body_md          text,        -- NULL tot AI genereert (no-mock)
  status           text not null default 'planned'
                     check (status in ('planned','generating','draft','published','blocked')),
  ai_model         text,
  url              text,
  generated_at     timestamptz,
  published_at     timestamptz,
  created_at       timestamptz default now(),
  updated_at       timestamptz default now(),
  unique (niche_id, slug)
);

create index if not exists idx_seo_clusters_niche on public.seo_keyword_clusters (niche_id);
create index if not exists idx_seo_pages_niche     on public.seo_pages (niche_id);
create index if not exists idx_seo_pages_status    on public.seo_pages (status);

-- updated_at triggers
create or replace function public.set_seo_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists trg_seo_niches_updated_at on public.seo_niches;
create trigger trg_seo_niches_updated_at before update on public.seo_niches
  for each row execute function public.set_seo_updated_at();
drop trigger if exists trg_seo_pages_updated_at on public.seo_pages;
create trigger trg_seo_pages_updated_at before update on public.seo_pages
  for each row execute function public.set_seo_updated_at();

-- RLS (conform 027_osil.sql)
alter table public.seo_niches            enable row level security;
alter table public.seo_keyword_clusters  enable row level security;
alter table public.seo_pages             enable row level security;
drop policy if exists seo_niches_auth   on public.seo_niches;
drop policy if exists seo_clusters_auth on public.seo_keyword_clusters;
drop policy if exists seo_pages_auth    on public.seo_pages;
create policy seo_niches_auth   on public.seo_niches           for all to authenticated using (true) with check (true);
create policy seo_clusters_auth on public.seo_keyword_clusters for all to authenticated using (true) with check (true);
create policy seo_pages_auth    on public.seo_pages            for all to authenticated using (true) with check (true);

-- Seed niches uit bestaande NL finance-kanalen (bestaande audience benutten)
insert into public.seo_niches (slug, naam, taal, channel_link, beschrijving) values
  ('vermogen',   'Vermogensopbouw',  'nl', 'VermogenTv',     'Vermogen opbouwen, financiële onafhankelijkheid, passief inkomen'),
  ('sparen',     'Sparen',           'nl', 'SpaarTv',        'Sparen, spaarrekeningen, budgetteren, geld besparen'),
  ('vastgoed',   'Vastgoed',         'nl', 'VastgoedTv',     'Vastgoed beleggen, huren, verhuren, vastgoedfinanciering'),
  ('crypto',     'Crypto',           'nl', 'CryptoVermogen', 'Crypto investeren, bitcoin, blockchain, digitale activa'),
  ('beleggen',   'Beleggen',         'nl', 'BeleggingsTv',   'Beleggen, ETF, aandelen, dividend, portefeuille')
on conflict (slug) do nothing;

-- Initiële keyword clusters (startarchitectuur; uitbreidbaar door research-agent)
insert into public.seo_keyword_clusters (niche_id, cluster, primary_keyword, search_intent, priority)
select n.id, c.cluster, c.kw, c.intent, c.prio
from public.seo_niches n
join (values
  ('vermogen', 'Basics',      'hoe begin ik met vermogen opbouwen',     'informational', 9),
  ('vermogen', 'Passief',     'passief inkomen opbouwen',               'informational', 8),
  ('sparen',   'Spaarrente',  'beste spaarrekening 2026',               'commercial',    9),
  ('sparen',   'Budget',      'hoeveel geld opzij zetten per maand',    'informational', 7),
  ('vastgoed', 'Beleggen',    'beleggen in vastgoed voor beginners',    'informational', 9),
  ('vastgoed', 'Rendement',   'huurrendement berekenen',                'commercial',    8),
  ('crypto',   'Basics',      'crypto kopen voor beginners',            'informational', 9),
  ('crypto',   'Bitcoin',     'bitcoin kopen nederland',                'transactional', 8),
  ('beleggen', 'ETF',         'beste etf om in te beleggen',            'commercial',    9),
  ('beleggen', 'Dividend',    'dividend aandelen nederland',            'commercial',    8)
) as c(niche_slug, cluster, kw, intent, prio) on c.niche_slug = n.slug
on conflict (niche_id, primary_keyword) do nothing;
