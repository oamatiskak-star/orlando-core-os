-- 051_hook_library_extraction.sql
-- Phase 4 — Hook Library auto-extraction.
--
-- Wanneer Forge een content_item met content_brief inserteert:
--   - extract hook tekst, hook_pattern, suggested_kind, replay_friendly
--   - insert in hook_library met success_score baseline van 50
-- Wanneer een content_item op status='published' komt:
--   - geef hook +20 score (capped op 100)
-- Wanneer status='archived' of 'failed':
--   - geef hook -10 score (floored op 0)

create or replace function public.extract_hook_to_library()
returns trigger
language plpgsql
security definer
set search_path = public
as $f$
declare
  v_hook_text     text;
  v_hook_pattern  text;
  v_kind          text;
  v_replay        boolean;
begin
  -- Skip als geen brief
  if new.content_brief is null then return new; end if;

  v_hook_text    := new.content_brief->>'hook';
  v_hook_pattern := new.content_brief->>'hook_pattern';
  v_kind         := coalesce(new.content_brief->>'suggested_kind', new.kind);
  v_replay       := coalesce((new.content_brief->>'replay_friendly')::boolean, false);

  if v_hook_text is null or v_hook_text = '' then return new; end if;

  -- Dedupe op (hook_text, hook_pattern) — voorkomt dubbele inserts bij re-runs
  if exists (
    select 1 from public.hook_library
     where hook_text = v_hook_text
       and coalesce(hook_pattern, '') = coalesce(v_hook_pattern, '')
       and source_content_id = new.id
  ) then
    return new;
  end if;

  insert into public.hook_library (
    hook_text, hook_visual_ref, hook_kind, pacing, replay_friendly,
    success_score, source_content_id
  ) values (
    v_hook_text,
    new.content_brief->>'visual_prompt',
    case
      when new.content_brief ? 'visual_prompt' and new.content_brief ? 'audio_prompt' then 'combo'
      when new.content_brief ? 'visual_prompt'                                       then 'visual'
      when new.content_brief ? 'audio_prompt'                                        then 'audio'
      else 'text'
    end,
    v_hook_pattern,
    v_replay,
    50,
    new.id
  );

  return new;
end
$f$;

drop trigger if exists trg_extract_hook_to_library on public.media_holding_content_items;
create trigger trg_extract_hook_to_library
  after insert on public.media_holding_content_items
  for each row execute function public.extract_hook_to_library();

-- ─────────────────────────────────────────────────────────────────────────────
-- Score adjustment trigger op status veranderingen
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.adjust_hook_score_on_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $f$
declare
  v_delta integer;
begin
  if old.status = new.status then return new; end if;

  v_delta := case new.status
    when 'published' then 20
    when 'archived'  then -10
    when 'failed'    then -10
    else 0
  end;

  if v_delta = 0 then return new; end if;

  update public.hook_library
     set success_score = greatest(0, least(100, success_score + v_delta))
   where source_content_id = new.id;

  return new;
end
$f$;

drop trigger if exists trg_adjust_hook_score on public.media_holding_content_items;
create trigger trg_adjust_hook_score
  after update of status on public.media_holding_content_items
  for each row execute function public.adjust_hook_score_on_status();

-- ─────────────────────────────────────────────────────────────────────────────
-- Backfill: extract hooks uit bestaande content_items (Phase 2 Forge output)
-- ─────────────────────────────────────────────────────────────────────────────
insert into public.hook_library (hook_text, hook_visual_ref, hook_kind, pacing, replay_friendly, success_score, source_content_id)
select
  ci.content_brief->>'hook',
  ci.content_brief->>'visual_prompt',
  case
    when ci.content_brief ? 'visual_prompt' and ci.content_brief ? 'audio_prompt' then 'combo'
    when ci.content_brief ? 'visual_prompt'                                       then 'visual'
    when ci.content_brief ? 'audio_prompt'                                        then 'audio'
    else 'text'
  end,
  ci.content_brief->>'hook_pattern',
  coalesce((ci.content_brief->>'replay_friendly')::boolean, false),
  50,
  ci.id
from public.media_holding_content_items ci
where ci.content_brief is not null
  and ci.content_brief->>'hook' is not null
  and ci.content_brief->>'hook' <> ''
  and not exists (
    select 1 from public.hook_library hl
     where hl.source_content_id = ci.id
  );
