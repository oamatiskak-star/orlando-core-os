-- 215_seo_gsc_ga4_metrics.sql
-- Wire Google Search Console + GA4 metrics into the SEO performance view.
-- Backbone for "worden de 274 kennisbank-pagina's opgepakt + hoeveel traffic".
--
-- v_seo_revenue.impressions/clicks/ctr waren hardcoded NULL (geen GSC-feed).
-- Deze migratie maakt de ingestie-doeltabellen en koppelt de view eraan.
-- NULL-safe: zolang seo_gsc_daily leeg is gedraagt de view zich identiek (NULL).

-- 1. GSC per-URL daagse metrics (Search Analytics API, dims=[date,page])
create table if not exists vastgoed_core.seo_gsc_daily (
  date         date    not null,
  page         text    not null,          -- volledige URL, bv. /kennisbank/<slug> of https://aquier.com/kennisbank/<slug>
  clicks       integer not null default 0,
  impressions  integer not null default 0,
  ctr          numeric(7,4) not null default 0,   -- fractie 0..1 zoals GSC teruggeeft
  position     numeric(6,2),
  fetched_at   timestamptz not null default now(),
  primary key (date, page)
);
create index if not exists idx_seo_gsc_daily_page on vastgoed_core.seo_gsc_daily (page);
create index if not exists idx_seo_gsc_daily_date on vastgoed_core.seo_gsc_daily (date);

-- 2. GA4 per-landing-path daagse metrics (Data API)
create table if not exists vastgoed_core.seo_ga4_daily (
  date             date    not null,
  landing_path     text    not null,
  sessions         integer not null default 0,
  organic_sessions integer not null default 0,
  engaged_sessions integer not null default 0,
  conversions      integer not null default 0,
  fetched_at       timestamptz not null default now(),
  primary key (date, landing_path)
);
create index if not exists idx_seo_ga4_daily_path on vastgoed_core.seo_ga4_daily (landing_path);

-- 3. v_seo_revenue: vervang hardcoded NULL impressions/clicks/ctr door GSC-aggregaat (laatste 28d).
--    Page-match is NULL-safe op zowel pad als volledige URL.
create or replace view vastgoed_core.v_seo_revenue as
 with pages as (
         select seo_pages.id as page_id,
            seo_pages.slug,
            seo_pages.url,
            seo_pages.title,
            seo_pages.ai_model,
            seo_pages.published_at,
            seo_pages.ai_model = 'claude-opus-cli-r'::text as is_clir
           from public.seo_pages
          where seo_pages.status = 'published'::text and seo_pages.url ~~ '/kennisbank/%'::text
        ), sessions as (
         select content_touches.landing_path,
            count(*) as sessions,
            count(distinct content_touches.anon_id) as distinct_visitors,
            mode() within group (order by content_touches.channel) as top_channel
           from vastgoed_core.content_touches
          where content_touches.landing_path ~~ '/kennisbank/%'::text
          group by content_touches.landing_path
        ), engagement as (
         select intent_events.page,
            count(*) as page_signals,
            count(*) filter (where intent_events.signal = any (array['cta'::text, 'membership'::text, 'sample_report'::text, 'teaser_lead'::text])) as lead_signals,
            count(*) filter (where intent_events.signal = 'financing_check'::text) as financing_signals,
            count(*) filter (where intent_events.signal = 'checkout_start'::text) as checkout_signals,
            count(*) filter (where intent_events.signal = 'membership'::text) as membership_signals
           from vastgoed_core.intent_events
          where intent_events.page ~~ '/kennisbank/%'::text
          group by intent_events.page
        ), gsc as (
         select
            replace(seo_gsc_daily.page, 'https://aquier.com', '') as page,
            sum(seo_gsc_daily.clicks)::integer as clicks,
            sum(seo_gsc_daily.impressions)::integer as impressions,
            round(case when sum(seo_gsc_daily.impressions) > 0
                       then 100.0 * sum(seo_gsc_daily.clicks)::numeric / sum(seo_gsc_daily.impressions)::numeric
                       else 0 end, 2) as ctr
           from vastgoed_core.seo_gsc_daily
          where seo_gsc_daily.date >= (current_date - 28)
          group by replace(seo_gsc_daily.page, 'https://aquier.com', '')
        ), ft as (
         select distinct on (content_touches.user_id) content_touches.user_id,
            content_touches.landing_path
           from vastgoed_core.content_touches
          where content_touches.user_id is not null and content_touches.landing_path ~~ '/kennisbank/%'::text
          order by content_touches.user_id, content_touches.created_at
        ), report_rev as (
         select ft.landing_path,
            count(*) as report_sales,
            coalesce(sum(urp.amount_eur), 0::numeric) as report_revenue_eur
           from ft
             join vastgoed_core.user_report_purchases urp on urp.user_id = ft.user_id and (urp.status is null or (lower(urp.status) = any (array['paid'::text, 'completed'::text, 'complete'::text, 'succeeded'::text])))
          group by ft.landing_path
        ), mem_rev as (
         select ft.landing_path,
            count(*) as membership_sales,
            coalesce(sum(mt.monthly_price_eur), 0::numeric) as membership_mrr_eur
           from ft
             join vastgoed_core.user_memberships um on um.user_id = ft.user_id and um.status = 'active'::text
             join vastgoed_core.membership_tiers mt on mt.id = um.tier_id
          group by ft.landing_path
        ), base as (
         select p.page_id,
            p.slug,
            p.url,
            p.title,
            p.ai_model,
            p.is_clir,
            p.published_at,
            coalesce(s.sessions, 0::bigint) as sessions,
            coalesce(s.distinct_visitors, 0::bigint) as distinct_visitors,
            s.top_channel,
            coalesce(e.lead_signals, 0::bigint) as lead_signals,
            coalesce(e.financing_signals, 0::bigint) as financing_signals,
            coalesce(e.checkout_signals, 0::bigint) as checkout_signals,
            coalesce(e.membership_signals, 0::bigint) as membership_signals,
            coalesce(rr.report_sales, 0::bigint) as report_sales,
            coalesce(rr.report_revenue_eur, 0::numeric) as report_revenue_eur,
            coalesce(mr.membership_sales, 0::bigint) as membership_sales,
            coalesce(mr.membership_mrr_eur, 0::numeric) as membership_mrr_eur,
            coalesce(rr.report_revenue_eur, 0::numeric) + coalesce(mr.membership_mrr_eur, 0::numeric) * 12::numeric as total_revenue_eur,
            g.impressions,
            g.clicks,
            g.ctr
           from pages p
             left join sessions s on s.landing_path = p.url
             left join engagement e on e.page = p.url
             left join gsc g on g.page = p.url
             left join report_rev rr on rr.landing_path = p.url
             left join mem_rev mr on mr.landing_path = p.url
        ), norm as (
         select base.page_id, base.slug, base.url, base.title, base.ai_model, base.is_clir, base.published_at,
            base.sessions, base.distinct_visitors, base.top_channel,
            base.lead_signals, base.financing_signals, base.checkout_signals, base.membership_signals,
            base.report_sales, base.report_revenue_eur, base.membership_sales, base.membership_mrr_eur,
            base.total_revenue_eur, base.impressions, base.clicks, base.ctr,
            nullif(max(base.total_revenue_eur) over (), 0::numeric) as mx_rev,
            nullif(max(base.lead_signals) over (), 0) as mx_lead,
            nullif(max(base.financing_signals) over (), 0) as mx_fin,
            nullif(max(base.membership_sales) over (), 0) as mx_mem,
            nullif(max(base.sessions) over (), 0) as mx_traf
           from base
        )
 select page_id, slug, url, title, ai_model, is_clir, published_at,
    sessions, distinct_visitors, top_channel,
    lead_signals, financing_signals, checkout_signals, membership_signals,
    report_sales, report_revenue_eur, membership_sales, membership_mrr_eur, total_revenue_eur,
    impressions, clicks, ctr,
    round(total_revenue_eur / nullif(sessions, 0)::numeric, 2) as revenue_per_session,
    round(total_revenue_eur / nullif(lead_signals, 0)::numeric, 2) as revenue_per_lead,
    round(100::numeric * (0.40 * coalesce(total_revenue_eur / mx_rev, 0::numeric) + 0.25 * coalesce(lead_signals::numeric / mx_lead::numeric, 0::numeric) + 0.20 * coalesce(financing_signals::numeric / mx_fin::numeric, 0::numeric) + 0.10 * coalesce(membership_sales::numeric / mx_mem::numeric, 0::numeric) + 0.05 * coalesce(sessions::numeric / mx_traf::numeric, 0::numeric)), 2) as revenue_score,
    rank() over (order by total_revenue_eur desc) as revenue_rank,
    rank() over (order by lead_signals desc) as lead_rank,
    rank() over (order by membership_sales desc) as membership_rank,
    rank() over (order by financing_signals desc) as finance_rank,
    rank() over (order by (coalesce(sessions, 0::bigint) + coalesce(distinct_visitors, 0::bigint)) desc, published_at) as authority_rank
   from norm;
