-- 069_render_publish_chains.sql
-- Chain E: content_item status pending→ready (Forge klaar) → dispatch renderer
-- Chain F: content_item kreeg output_url (renderer klaar) → dispatch atlas_upload naar YouTube
-- Beide chains DEFAULT OFF voor budget controle (Replicate kost €0.10-0.30/video).

create or replace function public.autopilot_ready_to_render()
returns trigger
language plpgsql
security definer
set search_path = public
as $f$
begin
  if new.status <> 'ready' then return new; end if;
  if tg_op = 'UPDATE' and old.status = 'ready' then return new; end if;
  if new.output_url is not null then return new; end if;  -- al gerenderd
  if not public._autopilot_link_active('ready_to_render') then return new; end if;

  perform public._autopilot_dispatch(
    'ready_to_render',
    'media_holding_content_items',
    new.id,
    'renderer',
    format('[autopilot] Render — %s', substring(coalesce(new.title,'item'),1,40)),
    'autopilot_render',
    jsonb_build_object(
      'content_item_id', new.id,
      'persona', 'Forge',
      'autopilot_source', 'ready_to_render'
    ),
    'Auto-render content_item na brief-ready.'
  );
  return new;
end
$f$;

drop trigger if exists trg_autopilot_ready_to_render on public.media_holding_content_items;
create trigger trg_autopilot_ready_to_render
  after insert or update of status on public.media_holding_content_items
  for each row execute function public.autopilot_ready_to_render();

create or replace function public.autopilot_render_to_upload()
returns trigger
language plpgsql
security definer
set search_path = public
as $f$
begin
  if new.output_url is null then return new; end if;
  if tg_op = 'UPDATE' and old.output_url is not null then return new; end if;
  if new.channel_id is null then return new; end if;
  if not public._autopilot_link_active('render_to_upload') then return new; end if;

  if exists (
    select 1 from public.media_holding_uploads
     where content_item_id = new.id and platform = 'youtube'
  ) then return new; end if;

  perform public._autopilot_dispatch(
    'render_to_upload',
    'media_holding_content_items',
    new.id,
    'atlas_upload',
    format('[autopilot] Upload YouTube — %s', substring(coalesce(new.title,'item'),1,40)),
    'autopilot_upload',
    jsonb_build_object(
      'content_item_id', new.id,
      'platform', 'youtube',
      'persona', 'Atlas',
      'autopilot_source', 'render_to_upload'
    ),
    'Auto-upload naar YouTube na render-success.'
  );
  return new;
end
$f$;

drop trigger if exists trg_autopilot_render_to_upload on public.media_holding_content_items;
create trigger trg_autopilot_render_to_upload
  after update of output_url on public.media_holding_content_items
  for each row execute function public.autopilot_render_to_upload();

insert into public.autopilot_config (link_key, description, enabled, threshold)
values
  ('ready_to_render',  'Auto-dispatch renderer bij content_item status=ready (Forge brief klaar) — Replicate cost €0.10-0.30/video', false, null),
  ('render_to_upload', 'Auto-dispatch atlas_upload naar YouTube bij render-success (output_url filled)', false, null)
on conflict (link_key) do update
  set description = excluded.description,
      updated_at = now();
