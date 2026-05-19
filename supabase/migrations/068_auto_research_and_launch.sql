-- 068_auto_research_and_launch.sql
-- Chain A: viral score >= 100 → osil_opportunities status='onderzoek' (i.p.v. 'radar')
-- Chain B: osil_opportunity (category=youtube) status → 'actief'
--          → maak/vind media_holding_channels (niche-based) + dispatch content_factory

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Update bestaande bridge trigger: bij score 100+ promote naar 'onderzoek'
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.bridge_viral_to_osil()
returns trigger
language plpgsql
security definer
set search_path = public
as $f$
declare
  v_existing_id   uuid;
  v_existing_st   text;
  v_title         text;
  v_description   text;
  v_target_status text;
begin
  if new.virality_score < 70 then return new; end if;

  v_title := substring(coalesce(new.title, 'Viral kans'), 1, 240);
  v_description := format(
    E'Viral kans gedetecteerd op %s.\nKanaal: %s\nViews: %s, velocity: %s/uur\nVirality: %s, automation: %s, saturation: %s\nURL: %s',
    new.source_platform,
    coalesce(new.channel_name, '—'),
    new.views,
    round(coalesce(new.view_velocity, 0))::text,
    new.virality_score,
    new.automation_score,
    new.saturation_score,
    coalesce(new.url, '—')
  );

  -- Score >= 100 → onderzoek, anders radar
  v_target_status := case when new.virality_score >= 100 then 'onderzoek' else 'radar' end;

  select id, status into v_existing_id, v_existing_st
    from public.osil_opportunities
   where category = 'youtube'
     and source  = 'viral_intelligence'
     and ai_analysis like '%viral_opportunity_id=' || new.id::text || '%'
   limit 1;

  if v_existing_id is null then
    insert into public.osil_opportunities (
      source, category, title, description,
      potential_value, probability_pct, time_horizon,
      status, ai_score, ai_analysis
    ) values (
      'viral_intelligence',
      'youtube',
      v_title,
      v_description,
      coalesce(new.revenue_potential, 0),
      least(100, new.automation_score),
      'nu',
      v_target_status,
      new.virality_score,
      format('viral_opportunity_id=%s; platform=%s; external_id=%s', new.id, new.source_platform, new.external_id)
    );
  else
    -- Update titel/beschrijving/score altijd. Status promoten naar onderzoek
    -- alleen als hij nog op 'radar' staat (user-overrides niet overschrijven).
    update public.osil_opportunities
       set title           = v_title,
           description     = v_description,
           potential_value = coalesce(new.revenue_potential, 0),
           probability_pct = least(100, new.automation_score),
           ai_score        = new.virality_score,
           status          = case
             when v_target_status = 'onderzoek' and v_existing_st = 'radar' then 'onderzoek'
             else v_existing_st
           end,
           updated_at      = now()
     where id = v_existing_id;
  end if;

  return new;
end
$f$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Chain B — bij osil_opportunity (youtube) status → 'actief':
--    maak/vind channel + dispatch content_factory
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.osil_actief_to_channel_launch()
returns trigger
language plpgsql
security definer
set search_path = public
as $f$
declare
  v_viral_id      uuid;
  v_viral         record;
  v_channel_id    uuid;
  v_channel_name  text;
  v_niche         text;
  v_task_id       uuid;
begin
  if new.category <> 'youtube'      then return new; end if;
  if new.status   <> 'actief'        then return new; end if;
  if tg_op = 'UPDATE' and old.status = 'actief' then return new; end if;
  if not public._autopilot_link_active('osil_actief_to_launch') then return new; end if;

  -- Extract viral_opportunity_id uit ai_analysis tag
  v_viral_id := nullif(substring(new.ai_analysis from 'viral_opportunity_id=([0-9a-f-]+)'), '')::uuid;
  if v_viral_id is not null then
    select id, title, niche, channel_name, raw_payload
      into v_viral
      from public.viral_opportunities
     where id = v_viral_id;
  end if;

  -- Bepaal channel niche (uit viral_opportunity.niche of fallback)
  v_niche := coalesce(v_viral.niche, 'general');
  v_channel_name := substring(format('Auto · %s', coalesce(v_viral.title, new.title)), 1, 80);

  -- Vind bestaand auto-channel met dezelfde niche (één per niche) — anders maak nieuw
  select id into v_channel_id
    from public.media_holding_channels
   where niche = v_niche
     and (persona_owner = 'Vortex' or name like 'Auto · %')
   order by created_at desc
   limit 1;

  if v_channel_id is null then
    insert into public.media_holding_channels (
      name, niche, persona_owner, status, target_views_10d, current_views_10d, branding, upload_strategy, posting_schedule
    ) values (
      v_channel_name,
      v_niche,
      'Vortex',
      'incubating',
      100000,
      0,
      jsonb_build_object('auto_launched', true, 'spawned_from_osil', new.id),
      jsonb_build_object('kind', 'shorts', 'per_day', 3),
      jsonb_build_object('cadence', 'daily')
    )
    returning id into v_channel_id;
  end if;

  -- Dispatch content_factory task — Forge maakt brief op basis van viral_opportunity
  insert into public.orchestrator_tasks (
    company_id, title, task_type, executor, allowed_actions, priority, status, objective, payload
  ) values (
    'modiwerijo',
    format('[auto-launch] %s', substring(coalesce(v_viral.title, new.title), 1, 60)),
    'auto_launch_brief',
    'content_factory',
    '["*"]'::jsonb,
    2,
    'open',
    jsonb_build_array(format('Auto-launch content voor OSIL kans %s in niche %s.', new.id, v_niche)),
    jsonb_build_object(
      'viral_opportunity_id', v_viral_id,
      'osil_opportunity_id',  new.id,
      'channel_id',           v_channel_id,
      'persona',              'Forge',
      'auto_launch',          true,
      'brief',                format('Genereer ready-to-publish content voor channel %s (niche=%s). Bron: viral kans "%s".',
                                     v_channel_name, v_niche, coalesce(v_viral.title, new.title))
    )
  )
  returning id into v_task_id;

  -- Channel naar 'live' status zetten (incubating → live bij eerste auto-launch trigger)
  update public.media_holding_channels
     set status = 'live',
         launched_at = coalesce(launched_at, now()),
         updated_at = now()
   where id = v_channel_id
     and status = 'incubating';

  -- Log naar autopilot_events voor traceability
  insert into public.autopilot_events (link_key, source_table, source_id, target_executor, task_id, details)
  values (
    'osil_actief_to_launch',
    'osil_opportunities',
    new.id,
    'content_factory',
    v_task_id,
    jsonb_build_object(
      'channel_id', v_channel_id,
      'niche', v_niche,
      'viral_opportunity_id', v_viral_id
    )
  );

  return new;
end
$f$;

drop trigger if exists trg_osil_actief_to_launch on public.osil_opportunities;
create trigger trg_osil_actief_to_launch
  after insert or update of status on public.osil_opportunities
  for each row execute function public.osil_actief_to_channel_launch();

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Voeg link toe aan autopilot_config voor zichtbaarheid + uitschakelbaarheid
--    Geen threshold nodig — gewoon manual toggle vanuit dashboard.
-- ─────────────────────────────────────────────────────────────────────────────
insert into public.autopilot_config (link_key, description, enabled, threshold)
values
  ('osil_actief_to_launch',
   'Auto-launch channel + content_factory bij OSIL youtube kans status=actief',
   true, null)
on conflict (link_key) do update
  set description = excluded.description,
      updated_at = now();

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Back-fill: promote bestaande viral_opps met score >= 100 naar onderzoek
-- ─────────────────────────────────────────────────────────────────────────────
update public.osil_opportunities o
   set status = 'onderzoek',
       updated_at = now()
  from public.viral_opportunities v
 where o.category = 'youtube'
   and o.source = 'viral_intelligence'
   and o.status = 'radar'
   and v.virality_score >= 100
   and o.ai_analysis like '%viral_opportunity_id=' || v.id::text || '%';
