-- 183_build_consolidation_fn.sql
-- Deterministische duplicate-kandidaten (pg_trgm) — server-side, voor de
-- consolidation-engine fallback wanneer de AI niet beschikbaar is (Anthropic €0).
-- Read-only/stable. Geen worker/cron.

create or replace function public.build_consolidation_candidates(
  p_entity    text default null,
  p_threshold numeric default 0.45
)
returns table (
  item_a_id    uuid,
  item_b_id    uuid,
  item_a_title text,
  item_b_title text,
  similarity   numeric
)
language sql
stable
security definer
set search_path = ''
as $$
  with items as (
    select i.id, i.title
    from public.build_tracker_items i
    join public.build_tracker_documents d on d.id = i.document_id and d.is_current
    left join public.v_build_item_project_match mm on mm.item_id = i.id
    where p_entity is null or p_entity = 'all'
       or coalesce(mm.entity_slug, '') = p_entity
  )
  select a.id, b.id, a.title, b.title,
         round(public.similarity(lower(a.title), lower(b.title))::numeric, 3) as similarity
  from items a
  join items b on a.id < b.id
  where public.similarity(lower(a.title), lower(b.title)) >= p_threshold
  order by similarity desc
  limit 50;
$$;

grant execute on function public.build_consolidation_candidates(text, numeric)
  to authenticated, service_role;
