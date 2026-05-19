-- 053_fix_hook_extract_trigger.sql
-- Bugfix migratie 051: dedupe check verwees naar kolom `hook_pattern`
-- in hook_library, maar de pattern wordt opgeslagen in `pacing`.
-- Resultaat: extract trigger faalde bij elke content_item insert met
-- "column hook_pattern does not exist".

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
  if new.content_brief is null then return new; end if;

  v_hook_text    := new.content_brief->>'hook';
  v_hook_pattern := new.content_brief->>'hook_pattern';
  v_kind         := coalesce(new.content_brief->>'suggested_kind', new.kind);
  v_replay       := coalesce((new.content_brief->>'replay_friendly')::boolean, false);

  if v_hook_text is null or v_hook_text = '' then return new; end if;

  -- Dedupe: pacing kolom (niet hook_pattern — die bestaat niet)
  if exists (
    select 1 from public.hook_library
     where hook_text = v_hook_text
       and coalesce(pacing, '') = coalesce(v_hook_pattern, '')
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
