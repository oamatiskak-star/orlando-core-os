-- 154_cf2_north_star_additive.sql
-- ════════════════════════════════════════════════════════════════════════════
-- CF2 North-Star Additive Hardening — bovenop 153_content_factory_2 (canoniek live).
-- North Star = CONTENT IMPACT SCORE = 40% revenue + 30% leads + 20% authority +
-- 10% viral growth. Live model heeft CQI (kwaliteit) maar GEEN impact-score.
--
-- 100% ADDITIEF: alleen ADD COLUMN (nullable/default), CREATE TABLE/VIEW/FUNCTION.
-- GEEN drop, rename, type-wijziging of constraint-verscherping op bestaande data.
-- Raakt v_video_cqi, de live gate, youtube-engine en content-worker NIET.
-- ════════════════════════════════════════════════════════════════════════════

-- ── A. Content Impact Score — gewichten als DATA (config), CIS live berekend ──
create table if not exists public.content_impact_weights (
  id               integer primary key default 1 check (id = 1),
  weight_revenue   numeric(4,3) not null default 0.40,
  weight_leads     numeric(4,3) not null default 0.30,
  weight_authority numeric(4,3) not null default 0.20,
  weight_viral     numeric(4,3) not null default 0.10,
  updated_at       timestamptz  not null default now()
);
insert into public.content_impact_weights (id) values (1) on conflict (id) do nothing;

create or replace function public.content_impact_score(
  p_revenue integer, p_leads integer, p_authority integer, p_viral integer)
returns numeric
language sql
stable
set search_path = public, pg_temp
as $f$
  select round(
    coalesce(p_revenue,0)   * w.weight_revenue +
    coalesce(p_leads,0)     * w.weight_leads +
    coalesce(p_authority,0) * w.weight_authority +
    coalesce(p_viral,0)     * w.weight_viral, 2)
  from public.content_impact_weights w where w.id = 1;
$f$;

-- ── B. Impact-subscores op youtube_quality_scores (waar dimensiescores + CQI al wonen)
--    Plain integer (nullable), consistent met bestaande visual_score/voice_score/etc.
alter table public.youtube_quality_scores add column if not exists revenue_score   integer;
alter table public.youtube_quality_scores add column if not exists leads_score     integer;
alter table public.youtube_quality_scores add column if not exists authority_score integer;
alter table public.youtube_quality_scores add column if not exists viral_score     integer;

-- ── C. Currency op bestaande revenue-velden (multi-land) ─────────────────────
alter table public.video_projects add column if not exists revenue_currency text not null default 'EUR';
alter table public.viral_patterns add column if not exists revenue_currency text not null default 'EUR';

-- ── D. Platform-neutraliteit (additief; default behoudt YouTube-flow) ────────
alter table public.video_projects add column if not exists platform text not null default 'youtube';
create index if not exists idx_video_projects_platform on public.video_projects(platform);

-- ── E. Event-grained attributie (UTM → lead → sale; product-neutraal) ────────
create table if not exists public.video_attribution (
  id                     uuid primary key default gen_random_uuid(),
  project_id             uuid not null references public.video_projects(id) on delete cascade,
  utm_source             text,
  utm_medium             text,
  utm_campaign           text,
  utm_content            text,
  utm_term               text,
  stage                  text not null check (stage in (
                            'click','lead','signup','trial','subscription_started',
                            'sale','upsell','refund','chargeback')),
  affiliate_link_id      uuid references public.affiliate_links(id) on delete set null,
  monetization_stream_id uuid references public.monetization_streams(id) on delete set null,
  product_type           text,
  product_ref            text,
  order_id               text,
  lead_email             text,
  revenue                numeric(14,2) not null default 0,
  currency               text not null default 'EUR',
  external_ref           text,
  raw_payload            jsonb not null default '{}'::jsonb,
  occurred_at            timestamptz not null default now(),
  created_at             timestamptz not null default now()
);
create index if not exists idx_video_attr_project      on public.video_attribution(project_id, occurred_at desc);
create index if not exists idx_video_attr_stage        on public.video_attribution(stage);
create index if not exists idx_video_attr_campaign     on public.video_attribution(utm_campaign);
create index if not exists idx_video_attr_affiliate    on public.video_attribution(affiliate_link_id);
create index if not exists idx_video_attr_monetization on public.video_attribution(monetization_stream_id);
create index if not exists idx_video_attr_product      on public.video_attribution(product_type);
create index if not exists idx_video_attr_order        on public.video_attribution(order_id);

-- ── F. v_video_impact — North Star view (laatste qs-rij per project + CIS) ────
create or replace view public.v_video_impact
  with (security_invoker = true) as
select
  vp.id as project_id, vp.channel_id, vp.platform, vp.niche, vp.title, vp.status,
  vp.approved, vp.quality_enforced, vp.quality_passed,
  vp.revenue_attributed, vp.revenue_currency, vp.leads_attributed,
  qs.content_quality_index,
  qs.revenue_score, qs.leads_score, qs.authority_score, qs.viral_score,
  public.content_impact_score(qs.revenue_score, qs.leads_score, qs.authority_score, qs.viral_score) as content_impact_score,
  vp.created_at, vp.updated_at
from public.video_projects vp
left join lateral (
  select * from public.youtube_quality_scores q where q.video_project_id = vp.id
  order by q.created_at desc limit 1
) qs on true;

-- ── G. RLS + policies (huisstijl: service_role write, authenticated read-only) ─
do $$
declare t text;
begin
  foreach t in array array['content_impact_weights','video_attribution']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format($p$ drop policy if exists %1$s_service on public.%1$s $p$, t);
    execute format($p$ create policy %1$s_service on public.%1$s for all to service_role using (true) with check (true) $p$, t);
    execute format($p$ drop policy if exists %1$s_auth_read on public.%1$s $p$, t);
    execute format($p$ create policy %1$s_auth_read on public.%1$s for select to authenticated using (true) $p$, t);
  end loop;
end $$;

grant select on public.v_video_impact to authenticated, service_role;

-- updated_at trigger op de config (hergebruikt bestaande fn uit 153)
drop trigger if exists trg_content_impact_weights_touch on public.content_impact_weights;
create trigger trg_content_impact_weights_touch before update on public.content_impact_weights
  for each row execute function public.cf2_touch_updated_at();
