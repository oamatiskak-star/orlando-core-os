-- 066_affiliate_engine.sql
-- Phase 13 — Affiliate Engine
--
-- Tracking voor affiliate links: clicks + conversions met revenue
-- attribution naar content_items en channels. Bij confirmed conversion
-- wordt monetization_streams (stream_type='affiliate') opgehoogd.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. uitbreiding affiliate_links — niche + utm template + content/channel link tracking
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.affiliate_links
  add column if not exists niche               text,
  add column if not exists utm_template        text default 'utm_source=mediaholding&utm_medium=affiliate&utm_campaign={channel}&utm_content={content_item}',
  add column if not exists short_link          text,
  add column if not exists notes               text,
  add column if not exists updated_at          timestamptz not null default now();

create index if not exists idx_affiliate_links_niche  on affiliate_links(niche);
create index if not exists idx_affiliate_links_active on affiliate_links(active);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. affiliate_clicks
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.affiliate_clicks (
  id                  uuid primary key default gen_random_uuid(),
  link_id             uuid not null references public.affiliate_links(id) on delete cascade,
  content_item_id     uuid references public.media_holding_content_items(id) on delete set null,
  channel_id          uuid references public.media_holding_channels(id) on delete set null,
  source_platform     text check (source_platform in ('youtube','tiktok','instagram','facebook','snapchat','x','linkedin','reddit','other')),
  occurred_at         timestamptz not null default now(),
  referrer            text,
  country_code        text,
  session_token       text,
  user_agent_hash     text
);
create index if not exists idx_aff_clicks_link    on affiliate_clicks(link_id, occurred_at desc);
create index if not exists idx_aff_clicks_content on affiliate_clicks(content_item_id);
create index if not exists idx_aff_clicks_session on affiliate_clicks(session_token);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. affiliate_conversions
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.affiliate_conversions (
  id                       uuid primary key default gen_random_uuid(),
  link_id                  uuid not null references public.affiliate_links(id) on delete cascade,
  click_id                 uuid references public.affiliate_clicks(id) on delete set null,
  content_item_id          uuid references public.media_holding_content_items(id) on delete set null,
  channel_id               uuid references public.media_holding_channels(id) on delete set null,
  value_eur                numeric(12,2) not null default 0,
  commission_eur           numeric(12,2) not null default 0,
  currency                 text not null default 'EUR',
  status                   text not null default 'pending'
                              check (status in ('pending','confirmed','rejected','refunded')),
  network_transaction_id   text,
  occurred_at              timestamptz not null default now(),
  confirmed_at             timestamptz,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);
create index if not exists idx_aff_conv_link    on affiliate_conversions(link_id, occurred_at desc);
create index if not exists idx_aff_conv_status  on affiliate_conversions(status);
create index if not exists idx_aff_conv_channel on affiliate_conversions(channel_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. View — affiliate_performance per link
-- ─────────────────────────────────────────────────────────────────────────────
create or replace view public.affiliate_performance as
select
  l.id                  as link_id,
  l.product,
  l.network,
  l.niche,
  l.channel_id,
  l.commission_pct,
  coalesce(c.click_count, 0)             as click_count,
  coalesce(v.conversion_count, 0)        as conversion_count,
  coalesce(v.confirmed_count, 0)         as confirmed_count,
  coalesce(v.confirmed_commission, 0)    as confirmed_commission_eur,
  coalesce(v.pending_commission, 0)      as pending_commission_eur,
  case
    when coalesce(c.click_count, 0) = 0 then 0
    else round((coalesce(v.confirmed_count, 0)::numeric / c.click_count) * 100, 2)
  end as conversion_rate_pct,
  case
    when coalesce(c.click_count, 0) = 0 then 0
    else round(coalesce(v.confirmed_commission, 0) / c.click_count, 4)
  end as epc_eur
from public.affiliate_links l
left join (
  select link_id, count(*) as click_count
    from public.affiliate_clicks
   group by link_id
) c on c.link_id = l.id
left join (
  select link_id,
         count(*)                                                              as conversion_count,
         count(*) filter (where status = 'confirmed')                          as confirmed_count,
         coalesce(sum(commission_eur) filter (where status = 'confirmed'), 0)  as confirmed_commission,
         coalesce(sum(commission_eur) filter (where status = 'pending'), 0)    as pending_commission
    from public.affiliate_conversions
   group by link_id
) v on v.link_id = l.id;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Trigger — bij confirmed conversion → monetization_streams update
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.sync_affiliate_to_monetization()
returns trigger
language plpgsql
security definer
set search_path = public
as $f$
declare
  v_channel_id uuid;
  v_stream_id  uuid;
  v_period_start timestamptz := date_trunc('month', new.confirmed_at);
begin
  -- alleen verwerken bij overgang naar 'confirmed'
  if new.status <> 'confirmed' then return new; end if;
  if tg_op = 'UPDATE' and old.status = 'confirmed' then return new; end if;
  if new.confirmed_at is null then
    new.confirmed_at := now();
  end if;

  v_channel_id := coalesce(new.channel_id, (
    select channel_id from public.affiliate_links where id = new.link_id
  ));
  if v_channel_id is null then return new; end if;

  -- vind of maak een affiliate monetization_stream voor dit channel deze maand
  select id into v_stream_id
    from public.monetization_streams
   where channel_id = v_channel_id
     and stream_type = 'affiliate'
   limit 1;

  if v_stream_id is null then
    insert into public.monetization_streams (channel_id, platform, stream_type, monthly_revenue, active)
    values (v_channel_id, 'affiliate', 'affiliate', new.commission_eur, true)
    returning id into v_stream_id;
  else
    update public.monetization_streams
       set monthly_revenue = coalesce(monthly_revenue, 0) + new.commission_eur,
           active = true,
           updated_at = now()
     where id = v_stream_id;
  end if;

  return new;
end
$f$;

drop trigger if exists trg_sync_affiliate_to_monetization on public.affiliate_conversions;
create trigger trg_sync_affiliate_to_monetization
  after insert or update of status on public.affiliate_conversions
  for each row execute function public.sync_affiliate_to_monetization();

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Executor enum: voeg affiliate_injector toe
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.orchestrator_tasks
  drop constraint if exists orchestrator_tasks_executor_check;

alter table public.orchestrator_tasks
  add constraint orchestrator_tasks_executor_check
  check (executor in (
    'claude-code','anthropic','shell',
    'viral_scanner','content_factory','gravity_detector','atlas_upload','renderer',
    'trend_scanner','retention_lab','winner_extractor','audio_scanner',
    'sponsor_engine','monetization_tracker','language_expander','cron_dispatcher',
    'affiliate_injector'
  ));

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. Module entry — affiliate-engine live + Fase 6 voortgang 100%
-- ─────────────────────────────────────────────────────────────────────────────
update public.media_holding_modules
   set route   = '/dashboard/media-holding/affiliate-engine',
       status  = 'live',
       live_at = coalesce(live_at, now()),
       updated_at = now()
 where module_key = 'affiliate-engine';

update public.media_holding_phases
   set voortgang = 100,
       status   = 'active',
       updated_at = now()
 where fase_nr = 6;
