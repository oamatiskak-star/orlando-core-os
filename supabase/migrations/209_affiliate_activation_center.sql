-- 209_affiliate_activation_center.sql — AFFILIATE ACTIVATION CENTER (one-click)
--
-- Doel: de schil rond de bestaande affiliate-omzetlus. Eén command-center dat de 6
-- prioriteitsprogramma's toont met tier/RPM/EPC/cookie/kanaal-match/verwachte omzet, plus
-- de "eerste euro"-rollup. Voert NIETS nieuws uit aan de motoren — hergebruikt volledig:
--   affiliate_programs (registry), affiliate_channel_mappings (mapping), account_setup_runs/
--   _run_steps/_human_actions (agent-queue), affiliate_go_live() trigger (GO LIVE),
--   rank_affiliate_programs() / generate_affiliate_recommendations() / auto_generate_affiliate_link()
--   / affiliate_setup_readiness(), affiliate_clicks/conversions + affiliate_revenue_ledger (omzet).
--
-- Engine Planner: GEEN nieuwe losse job. De readiness/recommendations draaien mee op de
-- bestaande Vercel-cron `account-setup-cron-tick` en de bestaande engine-rij
-- `content:affiliate-recommendations` (migratie 199). Daarom hier geen engine_schedule-rij.
--
-- Toegevoegd (alles credit-vrij, deterministisch):
--   1) 4 ontbrekende kanaal-koppelingen (mission Fase 5)
--   2) view v_affiliate_activation_center (Fase 1 — kolommen die v_affiliate_program_overview mist)
--   3) view v_affiliate_first_euro (Fase 6 — realtime rollup + milestones)
--   4) functie activate_channel_content_links() (Fase 5 — top-video's ↔ programma via bestaande fn)

-- ── 1) Seed 4 ontbrekende kanaal-koppelingen (idempotent, naam-gebaseerd) ─────
-- LoopForge → Amazon (NL/EU), BrickPulse → xTool + Bambu Lab, Aquier → HubSpot.
-- VermogenTv→TradingView en CryptoVermogen→Binance bestaan al — niet opnieuw seeden.
insert into public.affiliate_channel_mappings (channel_id, affiliate_program_id, priority, est_epc, reason, is_active)
select mhc.id, p.id, 1, p.avg_epc, 'mission: LoopForge → marketplace (Amazon)', true
from public.media_holding_channels mhc, public.affiliate_programs p
where mhc.name = 'LoopForge Lab' and p.name = 'Amazon Associates NL/EU'
  and not exists (
    select 1 from public.affiliate_channel_mappings m
    where m.channel_id = mhc.id and m.affiliate_program_id = p.id);

insert into public.affiliate_channel_mappings (channel_id, affiliate_program_id, priority, est_epc, reason, is_active)
select mhc.id, p.id, 1, p.avg_epc, 'mission: BrickPulse → maker hardware (xTool)', true
from public.media_holding_channels mhc, public.affiliate_programs p
where mhc.name = 'BrickPulse Lab' and p.name = 'xTool'
  and not exists (
    select 1 from public.affiliate_channel_mappings m
    where m.channel_id = mhc.id and m.affiliate_program_id = p.id);

insert into public.affiliate_channel_mappings (channel_id, affiliate_program_id, priority, est_epc, reason, is_active)
select mhc.id, p.id, 2, p.avg_epc, 'mission: BrickPulse → maker hardware (Bambu Lab)', true
from public.media_holding_channels mhc, public.affiliate_programs p
where mhc.name = 'BrickPulse Lab' and p.name = 'Bambu Lab'
  and not exists (
    select 1 from public.affiliate_channel_mappings m
    where m.channel_id = mhc.id and m.affiliate_program_id = p.id);

insert into public.affiliate_channel_mappings (channel_id, affiliate_program_id, priority, est_epc, reason, is_active)
select mhc.id, p.id, 1, p.avg_epc, 'mission: Aquier → SaaS/CRM (HubSpot)', true
from public.media_holding_channels mhc, public.affiliate_programs p
where mhc.name = 'AquierTv' and p.name = 'HubSpot Affiliate Program'
  and not exists (
    select 1 from public.affiliate_channel_mappings m
    where m.channel_id = mhc.id and m.affiliate_program_id = p.id);

-- ── 2) Activation-center view (Fase 1) ───────────────────────────────────────
-- Levert wat v_affiliate_program_overview mist: tier/RPM/EPC/cookie/approval + beste
-- kanaal-match + verwachte omzet (deterministische proxy). is_priority markeert de 6
-- prioriteitsprogramma's (7 rijen incl. 2× Amazon).
create or replace view public.v_affiliate_activation_center as
select
  p.id,
  p.company_id,
  p.name,
  p.category,
  p.account_status,
  p.approval_status,
  p.login_status,
  p.tier,
  p.avg_epc,
  p.rpm_equiv,
  p.cookie_days,
  p.recurring,
  p.audience_fit_score,
  p.affiliate_link,
  p.referral_code,
  p.url,
  bc.channel_name              as best_channel_name,
  bc.est_epc                   as best_est_epc,
  bc.priority                  as best_priority,
  -- Verwachte omzet (proxy): beste EPC (of registry-EPC) × audience-fit. Deterministisch,
  -- geen LLM. Schaalt mee met fit-score; bedoeld als ranking-signaal, geen forecast.
  round((coalesce(bc.est_epc, p.avg_epc, 0) * coalesce(p.audience_fit_score, 0))::numeric, 2)
                               as revenue_potential,
  coalesce(ha.open_count, 0)   as open_human_actions,
  coalesce(ar.active_runs, 0)  as active_runs,
  (p.name in (
    'xTool','Bambu Lab','Amazon Associates NL/EU','Amazon Associates US',
    'TradingView Partner Program','Binance Affiliates','HubSpot Affiliate Program'
  ))                           as is_priority
from public.affiliate_programs p
left join lateral (
  select mhc.name as channel_name, m.est_epc, m.priority
  from public.affiliate_channel_mappings m
  join public.media_holding_channels mhc on mhc.id = m.channel_id
  where m.affiliate_program_id = p.id and m.is_active
  order by m.priority asc nulls last, m.est_epc desc nulls last
  limit 1
) bc on true
left join lateral (
  select count(*) as open_count
  from public.account_setup_human_actions a
  where a.program_id = p.id and a.status in ('open','in_progress')
) ha on true
left join lateral (
  select count(*) as active_runs
  from public.account_setup_runs r
  where r.program_id = p.id and r.status in ('queued','running','awaiting_action','awaiting_approval')
) ar on true;

comment on view public.v_affiliate_activation_center is
  'Fase 1: per-programma command-center (tier/RPM/EPC/cookie/approval + beste kanaal-match + verwachte omzet). is_priority = de 6 mission-programma''s.';

-- ── 3) Eerste-euro rollup (Fase 6) ───────────────────────────────────────────
-- Eén rij met realtime totalen + milestone-vlaggen. Per-programma detail komt rechtstreeks
-- uit v_affiliate_program_performance (niet dupliceren).
create or replace view public.v_affiliate_first_euro as
with conv as (
  select
    count(*)                                                    as leads,
    count(*) filter (where status = 'confirmed')                as sales,
    coalesce(sum(commission_eur) filter (where status = 'confirmed'), 0) as commission_eur,
    coalesce(sum(value_eur)      filter (where status = 'confirmed'), 0) as revenue_eur
  from public.affiliate_conversions
),
clk as (
  select count(*) as clicks from public.affiliate_clicks
),
ledger as (
  select coalesce(sum(commission_revenue), 0) as ledger_commission
  from public.affiliate_revenue_ledger
),
best_ch as (
  select mhc.name as channel, coalesce(sum(ap.confirmed_commission_eur), 0) as rev
  from public.affiliate_performance ap
  join public.media_holding_channels mhc on mhc.id = ap.channel_id
  group by mhc.name
  order by rev desc nulls last, channel
  limit 1
),
best_aff as (
  select program_name, revenue_eur
  from public.v_affiliate_program_performance
  order by revenue_eur desc nulls last
  limit 1
),
active as (
  select count(*) as active_programs
  from public.affiliate_programs
  where account_status in ('active','payout_active')
)
select
  active.active_programs,
  clk.clicks,
  conv.leads,
  conv.sales,
  conv.commission_eur,
  greatest(conv.revenue_eur, ledger.ledger_commission) as revenue_eur,
  best_ch.channel       as best_channel,
  best_aff.program_name as best_affiliate,
  (clk.clicks > 0)                                          as has_first_click,
  (conv.leads > 0)                                          as has_first_lead,
  (conv.sales > 0)                                          as has_first_sale,
  (conv.commission_eur > 0)                                 as has_first_commission,
  (greatest(conv.revenue_eur, ledger.ledger_commission) >= 1) as has_first_euro
from active, clk, conv, ledger
left join best_ch on true
left join best_aff on true;

comment on view public.v_affiliate_first_euro is
  'Fase 6: realtime eerste-euro rollup (clicks/leads/sales/commissie/omzet + best channel/affiliate + milestone-vlaggen).';

-- ── 4) Content-koppeling: top-video's ↔ programma (Fase 5) ────────────────────
-- Roept de BESTAANDE auto_generate_affiliate_link() aan voor de top-N content-items van een
-- kanaal. Idempotent: slaat content-items over die al een link voor dit programma hebben.
create or replace function public.activate_channel_content_links(
  p_program_id uuid, p_channel_id uuid, p_top_n int default 5
)
returns integer
language plpgsql
as $$
declare
  v_count    int := 0;
  v_item     record;
  v_existing uuid;
  v_prog     text;
begin
  if p_program_id is null or p_channel_id is null then
    raise exception 'program_id en channel_id zijn verplicht';
  end if;

  select name into v_prog from public.affiliate_programs where id = p_program_id;
  if v_prog is null then raise exception 'affiliate_program % niet gevonden', p_program_id; end if;

  for v_item in
    select ci.id
    from public.media_holding_content_items ci
    where ci.channel_id = p_channel_id
    order by (ci.status = 'published') desc, ci.published_at desc nulls last, ci.created_at desc
    limit greatest(p_top_n, 1)
  loop
    select l.id into v_existing
    from public.affiliate_links l
    where l.content_item_id = v_item.id and l.network = v_prog
    limit 1;

    if v_existing is null then
      perform public.auto_generate_affiliate_link(v_item.id, p_program_id);
      v_count := v_count + 1;
    end if;
    v_existing := null;
  end loop;

  return v_count;
end;
$$;

comment on function public.activate_channel_content_links(uuid, uuid, int) is
  'Fase 5: genereert affiliate-links voor de top-N content-items van een kanaal via de bestaande auto_generate_affiliate_link(). Idempotent per content-item×programma.';
