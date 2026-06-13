-- 213_s15_affiliate_link_health.sql — Affiliate link-health crawler
--
-- Periodieke validatie van bestaande affiliate_links: dood/redirect/kapot, short-code-check,
-- defecte links flaggen. VOLLEDIG additief — geen externe credentials nodig, direct live.
-- Crawler-logica zit in de frontend Vercel-cron route /api/media-holding/affiliate-engine/link-health.
--
-- Engine Planner: media:affiliate-link-health in het off-peak 'janitor'-blok (00:00-04:00).
-- Raakt de revenue/allocatie-keten niet.

create table if not exists public.affiliate_link_health (
  id          uuid primary key default gen_random_uuid(),
  link_id     uuid not null references public.affiliate_links(id) on delete cascade,
  status      text not null default 'unchecked'
              check (status in ('ok','redirect','broken','error','unchecked')),
  http_status int,
  final_url   text,
  redirected  boolean not null default false,
  latency_ms  int,
  error       text,
  checked_at  timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (link_id)
);

comment on table public.affiliate_link_health is
  'S15: laatste link-health per affiliate_link (HTTP-status, redirect, latency). Gevuld door de link-health crawler.';

create index if not exists idx_aff_link_health_status on public.affiliate_link_health(status);

-- Dashboard-view: alle links + (eventuele) health; links zonder check = 'unchecked'.
create or replace view public.v_affiliate_link_health as
select
  l.id            as link_id,
  l.product,
  l.network,
  l.niche,
  l.url,
  l.short_code,
  l.channel_id,
  l.active,
  coalesce(h.status, 'unchecked') as status,
  h.http_status,
  h.final_url,
  h.redirected,
  h.latency_ms,
  h.error,
  h.checked_at
from public.affiliate_links l
left join public.affiliate_link_health h on h.link_id = l.id;

comment on view public.v_affiliate_link_health is
  'S15: affiliate-links met laatste health-status (ok/redirect/broken/error/unchecked).';

-- Engine-Planner-registratie (off-peak janitor-blok).
insert into public.engine_schedule (engine_key, grp, label, block_key, enabled) values
  ('media:affiliate-link-health', 'media', 'S15 Affiliate link-health crawler (dood/redirect/kapot)', 'janitor', true)
on conflict (engine_key) do update set enabled = true, label = excluded.label, block_key = excluded.block_key, updated_at = now();
