-- 199_s7_affiliate_orchestration.sql
-- AUTONOMOUS GROWTH OS — S7: Affiliate orchestration (software-laag van de omzetlus).
--
-- Doel: de commerciële feedbacklus maximaal in software afmaken. De resterende blokkades
-- zijn dan uitsluitend EXTERN (affiliate-accounts/approval, credentials, postbacks, YPP).
--
-- Hergebruik (NIET dupliceren): affiliate_programs (34, registry), affiliate_channel_mappings
-- (25, mapping-laag), affiliate_performance (link-level perf), account_setup_human_actions
-- (setup-agent queue), affiliate_links/clicks/conversions + trigger-rollups (S4).
--
-- Toegevoegd: orchestratie/aanbevelings-engine, programma-performance + winner-patterns,
-- auto-link-generatie (content↔programma koppeling) en setup-readiness-detectie.
-- Alles credit-vrij (geen LLM). Joins geverifieerd: affiliate_channel_mappings.channel_id ->
-- media_holding_channels.id; affiliate_links.channel_id -> media_holding_channels.id.

-- ── 1) Aanbevelingen-tabel ──────────────────────────────────────────────────
create table if not exists public.affiliate_recommendations (
  id                 uuid primary key default gen_random_uuid(),
  channel_id         uuid,
  channel_name       text,
  program_id         uuid references public.affiliate_programs(id),
  program_name       text,
  est_epc            numeric(8,2),
  audience_fit_score int,
  priority           int,
  score              numeric(6,4),
  action             text not null default 'activate' check (action in ('activate','promote','pending')),
  rationale          text,
  status             text not null default 'active' check (status in ('active','applied','dismissed')),
  generated_at       timestamptz not null default now(),
  created_at         timestamptz not null default now()
);
create index if not exists idx_affrec_channel on public.affiliate_recommendations(channel_id, status);

comment on table public.affiliate_recommendations is
  'S7: per-kanaal aanbevolen affiliate-programma (activate/promote) op EPC × audience-fit.';

-- ── 2) Match-view: bestaande mapping × registry × kanaal ────────────────────
create or replace view public.v_affiliate_match as
select
  acm.channel_id,
  mhc.name                                       as channel_name,
  p.id                                           as program_id,
  p.name                                         as program_name,
  p.category,
  coalesce(acm.est_epc, p.avg_epc)               as est_epc,
  p.audience_fit_score,
  acm.priority,
  p.account_status,
  p.payout_model,
  round((least(1.0, coalesce(acm.est_epc, p.avg_epc, 0) / 3.0) * 0.6
       + coalesce(p.audience_fit_score, 0) / 100.0 * 0.4)::numeric, 4) as match_score
from public.affiliate_channel_mappings acm
join public.affiliate_programs p on p.id = acm.affiliate_program_id
left join public.media_holding_channels mhc on mhc.id = acm.channel_id
where acm.is_active;

comment on view public.v_affiliate_match is
  'S7: kanaal×programma match-score (EPC + audience-fit) uit de bestaande mapping-laag.';

-- ── 3) Recommendation-generator (credit-vrij) ───────────────────────────────
create or replace function public.generate_affiliate_recommendations(p_top int default 3)
returns integer
language plpgsql
as $$
declare v_count int := 0;
begin
  delete from public.affiliate_recommendations
   where status = 'active' and generated_at::date = current_date;

  insert into public.affiliate_recommendations
    (channel_id, channel_name, program_id, program_name, est_epc, audience_fit_score, priority, score, action, rationale)
  select
    channel_id, channel_name, program_id, program_name, est_epc, audience_fit_score, priority, match_score,
    case when account_status in ('active','approved') then 'promote' else 'activate' end,
    format('%s → %s (EPC ~€%s, fit %s, prio %s) — %s',
      coalesce(channel_name,'kanaal'), program_name, coalesce(est_epc,0), coalesce(audience_fit_score,0), coalesce(priority,0),
      case when account_status in ('active','approved')
           then 'promoten + auto-link genereren'
           else 'account activeren (extern) → daarna auto-link' end)
  from (
    select v.*, row_number() over (partition by channel_id order by match_score desc nulls last) as rn
    from public.v_affiliate_match v
  ) x
  where rn <= greatest(p_top, 1);

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

comment on function public.generate_affiliate_recommendations(int) is
  'S7: schrijft per-kanaal top-N affiliate-aanbevelingen uit v_affiliate_match.';

create or replace view public.v_affiliate_recommendations_current as
select id, channel_id, channel_name, program_id, program_name, est_epc, audience_fit_score,
       priority, score, action, rationale, generated_at
from public.affiliate_recommendations
where status = 'active'
order by score desc nulls last;

comment on view public.v_affiliate_recommendations_current is
  'S7: actuele actieve affiliate-aanbevelingen, hoogste match-score eerst.';

-- ── 4) Programma-performance (rollup) + winner-patterns ─────────────────────
create or replace view public.v_affiliate_program_performance as
select
  p.id              as program_id,
  p.name            as program_name,
  p.category,
  p.account_status,
  p.avg_epc         as registry_epc,
  coalesce(sum(ap.click_count), 0)             as clicks,
  coalesce(sum(ap.conversion_count), 0)        as conversions,
  coalesce(sum(ap.confirmed_count), 0)         as confirmed,
  coalesce(sum(ap.confirmed_commission_eur),0) as revenue_eur,
  case when coalesce(sum(ap.click_count),0) > 0
       then round(coalesce(sum(ap.confirmed_commission_eur),0) / sum(ap.click_count), 2)
       else 0 end                              as actual_epc
from public.affiliate_programs p
left join public.affiliate_links l       on l.network = p.name
left join public.affiliate_performance ap on ap.link_id = l.id
group by p.id, p.name, p.category, p.account_status, p.avg_epc;

comment on view public.v_affiliate_program_performance is
  'S7: programma-niveau performance (clicks/conversies/omzet/actual-EPC) — vult zich met conversies.';

create or replace view public.v_affiliate_winners as
select
  ap.link_id, ap.product, ap.network, ap.niche, ap.channel_id,
  ap.click_count, ap.conversion_count, ap.confirmed_count,
  ap.confirmed_commission_eur, ap.conversion_rate_pct, ap.epc_eur,
  rank() over (order by ap.epc_eur desc nulls last, ap.confirmed_commission_eur desc nulls last) as rank
from public.affiliate_performance ap
where ap.click_count > 0;

comment on view public.v_affiliate_winners is
  'S7: affiliate winner-patterns — best converterende links/offers (op EPC + confirmed commission).';

-- ── 5) Auto-link-generatie: content ↔ programma (Phase 4/5 koppeling) ───────
create or replace function public.auto_generate_affiliate_link(p_content_item_id uuid, p_program_id uuid)
returns uuid
language plpgsql
as $$
declare
  v_id uuid;
  v_code text;
  v_prog public.affiliate_programs%rowtype;
  v_channel uuid;
begin
  select * into v_prog from public.affiliate_programs where id = p_program_id;
  if v_prog.id is null then raise exception 'affiliate_program % niet gevonden', p_program_id; end if;

  select channel_id into v_channel from public.media_holding_content_items where id = p_content_item_id;
  v_code := substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);

  insert into public.affiliate_links
    (affiliate_id, network, product, url, niche, channel_id, content_item_id, short_code, active, notes)
  values (
    coalesce(nullif(v_prog.referral_code, ''), 'pending'),
    v_prog.name, v_prog.name,
    coalesce(nullif(v_prog.affiliate_link, ''), v_prog.url, 'https://example.invalid/pending'),
    v_prog.category, v_channel, p_content_item_id, v_code, true,
    'auto-generated (S7) program=' || v_prog.name)
  returning id into v_id;

  return v_id;
end;
$$;

comment on function public.auto_generate_affiliate_link(uuid,uuid) is
  'S7: genereert een attributie-klare affiliate-link (short_code) voor content×programma. Klaar voor Hermes-autonomie zodra een programma actief is.';

-- ── 6) Setup-readiness: ontbrekende externe stappen → setup-agent queue ─────
create or replace function public.affiliate_setup_readiness()
returns integer
language plpgsql
as $$
declare v_count int := 0;
begin
  insert into public.account_setup_human_actions (program_id, action_kind, title, description, status, metadata)
  select
    p.id, 'manual_review',
    'Activeer affiliate-programma: ' || p.name,
    'Status=' || coalesce(p.account_status,'?') || '. Ontbreekt extern: ' ||
      coalesce(nullif(concat_ws(', ',
        case when p.account_status <> 'active' then 'account aanmaken/goedkeuring' end,
        case when coalesce(p.affiliate_link,'') = '' then 'affiliate-link/URL' end,
        case when coalesce(p.referral_code,'') = '' then 'referral-code' end,
        case when not coalesce(p.api_available,false) then 'API/postback' end), ''), 'onbekend'),
    'open',
    jsonb_build_object('source','affiliate_setup_readiness','program',p.name,'category',p.category,'avg_epc',p.avg_epc)
  from public.affiliate_programs p
  where p.account_status <> 'active'
    and not exists (
      select 1 from public.account_setup_human_actions a
      where a.program_id = p.id and a.action_kind = 'manual_review' and a.status = 'open'
        and a.metadata->>'source' = 'affiliate_setup_readiness');

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

comment on function public.affiliate_setup_readiness() is
  'S7: detecteert per programma de ontbrekende EXTERNE activatiestappen en zet ze in de setup-agent human-action queue.';

-- ── 7) Engine Planner ───────────────────────────────────────────────────────
insert into public.engine_schedule (engine_key, grp, label, block_key, enabled) values
  ('content:affiliate-recommendations', 'media', 'S7 Affiliate-orchestratie (mapping -> aanbevelingen)', 'youtube', true)
on conflict (engine_key) do update set enabled = true, updated_at = now();
