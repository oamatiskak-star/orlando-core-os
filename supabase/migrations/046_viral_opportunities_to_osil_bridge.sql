-- 046_viral_opportunities_to_osil_bridge.sql
-- Trigger op viral_opportunities: bij virality_score >= 70 push de kans
-- automatisch naar osil_opportunities met category='youtube' zodat hij
-- in de OSIL/kansenradar UI verschijnt onder het YouTube kopje.
-- Bij update van de score: update de osil_opportunities row.
-- Linking via osil_opportunities.ai_analysis (jsonb-encoded text ref op
-- de viral_opportunities.id, omdat er geen dedicated foreign-key kolom is).

create or replace function public.bridge_viral_to_osil()
returns trigger
language plpgsql
security definer
set search_path = public
as $f$
declare
  v_existing_id   uuid;
  v_title         text;
  v_description   text;
begin
  -- Threshold: alleen sterke kansen
  if new.virality_score < 70 then
    return new;
  end if;

  -- Bouw titel en beschrijving op
  v_title := substring(coalesce(new.title, 'Viral kans'), 1, 240);
  v_description := format(
    E'Viral kans gedetecteerd op %s.\nKanaal: %s\nViews: %s, velocity: %s/uur\nVirality: %s, automation: %s, saturation: %s\nURL: %s',
    new.source_platform,
    coalesce(new.channel_name, '—'),
    new.views,
    round(new.view_velocity)::text,
    new.virality_score,
    new.automation_score,
    new.saturation_score,
    coalesce(new.url, '—')
  );

  -- Bestaande bridge entry zoeken via ai_analysis tag
  select id into v_existing_id
    from public.osil_opportunities
   where category = 'youtube'
     and source = 'viral_intelligence'
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
      'radar',
      new.virality_score,
      format('viral_opportunity_id=%s; platform=%s; external_id=%s', new.id, new.source_platform, new.external_id)
    );
  else
    update public.osil_opportunities
       set title           = v_title,
           description     = v_description,
           potential_value = coalesce(new.revenue_potential, 0),
           probability_pct = least(100, new.automation_score),
           ai_score        = new.virality_score,
           updated_at      = now()
     where id = v_existing_id;
  end if;

  return new;
end
$f$;

drop trigger if exists trg_bridge_viral_to_osil on public.viral_opportunities;
create trigger trg_bridge_viral_to_osil
  after insert or update of virality_score, title, views, view_velocity, automation_score, revenue_potential
  on public.viral_opportunities
  for each row
  execute function public.bridge_viral_to_osil();
