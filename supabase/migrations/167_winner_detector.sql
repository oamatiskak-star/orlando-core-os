-- 167_winner_detector.sql
-- CF2 Adaptive Growth Engine — Winner Detector (sluit de leerloop, ONAFHANKELIJK).
-- Vult winner_extraction_jobs (nu 0) door eigen best-presterende content te detecteren.
-- Content Horizon (166) hangt hier NIET van af. ADDITIEF + idempotent.
-- HARDE GATE: niet auto-toepassen; engine enabled=false; cron draait pas na go.
-- Reversibel: maakt alleen 'pending' variant-jobs aan, wist niets.

create or replace function public.detect_content_winners()
returns integer language plpgsql as $fn$
declare v_count int := 0;
begin
  with latest as (
    select distinct on (content_item_id) content_item_id, views, retention_pct, ctr_pct
    from public.media_holding_metrics
    order by content_item_id, snapshot_at desc
  ),
  ranked as (
    select l.content_item_id, l.views, l.retention_pct,
           percent_rank() over (order by coalesce(l.views,0)) as views_pr,
           percent_rank() over (order by coalesce(l.retention_pct,0)) as ret_pr
    from latest l
    where coalesce(l.views,0) > 0 or coalesce(l.retention_pct,0) > 0
  ),
  winners as (
    -- top 25% op views OF retentie = winnaar
    select content_item_id from ranked where views_pr >= 0.75 or ret_pr >= 0.75
  ),
  -- elke winnaar krijgt 2 variant-kinds, mits nog niet aanwezig
  to_make as (
    select w.content_item_id, vk.variant_kind
    from winners w
    cross join (values ('remix'),('enhanced')) as vk(variant_kind)
    where not exists (
      select 1 from public.winner_extraction_jobs j
      where j.source_content_id = w.content_item_id and j.variant_kind = vk.variant_kind
    )
  ),
  ins as (
    insert into public.winner_extraction_jobs (source_content_id, variant_kind, status)
    select content_item_id, variant_kind, 'pending' from to_make
    returning 1
  )
  select count(*) into v_count from ins;

  return v_count;
end $fn$;

insert into public.engine_schedule (engine_key, grp, label, block_key, enabled)
values ('content:winner-detector','content','Winner detector (leerloop)', null, false)
on conflict (engine_key) do update set label=excluded.label;

do $u$ begin perform cron.unschedule('content_winner_detector'); exception when others then null; end $u$;
select cron.schedule('content_winner_detector','45 */6 * * *',
  $cron$ select case when public.engine_window_open('content:winner-detector')
                     then public.detect_content_winners() else 0 end $cron$);
