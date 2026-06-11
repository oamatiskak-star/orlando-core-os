-- 178_cf2_winner_replication.sql
-- CF2 Winner Replication Engine — varianten vanuit ECHTE winners (v_winner_intelligence),
-- niet vrij verzonnen content. Additief, reversibel. Geen publicatie, geen engine-activatie.
--
-- Flow: winner → structuur (hook/titel/scene-ritme) → 50 varianten → ranking → top 10.
-- De top-10 (status 'selected') kan via een GEGATEDE functie naar content_horizon → cf2_jobs.

create table if not exists public.cf2_winner_variants (
  id                   uuid primary key default gen_random_uuid(),
  variation_request_id uuid references public.variation_requests(id) on delete cascade,
  source_video_id      uuid,                 -- youtube_videos.id (de winner)
  source_title         text,
  niche                text,
  hook_category        text,
  rank                 integer,              -- 1..N binnen deze winner (1 = beste)
  variant_title        text not null,
  hook_structure       text,                 -- het toegepaste hook-patroon
  scene_rhythm         jsonb not null default '[]'::jsonb,  -- pacing-template (scenes/seconden)
  replication_score    numeric(5,2),         -- hoe goed de variant de winner-structuur + niche volgt
  status               text not null default 'prepared'
                         check (status in ('prepared','selected','seeded','skipped')),
  created_at           timestamptz not null default now()
);
create index if not exists cf2_winner_variants_req_idx    on public.cf2_winner_variants(variation_request_id);
create index if not exists cf2_winner_variants_status_idx on public.cf2_winner_variants(status, replication_score desc);
create index if not exists cf2_winner_variants_source_idx on public.cf2_winner_variants(source_video_id);

-- Per-winner overzicht van de geselecteerde topvarianten
create or replace view public.v_cf2_winner_replication as
select
  v.source_video_id,
  v.source_title,
  v.niche,
  v.hook_category,
  count(*)                                          as variants_total,
  count(*) filter (where v.status = 'selected')     as variants_selected,
  count(*) filter (where v.status = 'seeded')       as variants_seeded,
  round(max(v.replication_score), 1)                as best_score,
  max(v.created_at)                                 as last_run
from public.cf2_winner_variants v
group by v.source_video_id, v.source_title, v.niche, v.hook_category;

-- GEGATEDE brug: zet 'selected' varianten in content_horizon (max 48u vooruit), markeer 'seeded'.
-- Roept GEEN producer aan, uploadt niets. Aparte expliciete stap; daarna cf2_seed_jobs_from_horizon().
create or replace function public.cf2_seed_variants_to_horizon(p_limit integer default 10)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
begin
  with picks as (
    select v.*, row_number() over (order by v.replication_score desc nulls last) as rn
    from public.cf2_winner_variants v
    where v.status = 'selected'
    order by v.replication_score desc nulls last
    limit greatest(p_limit, 0)
  ),
  ins as (
    insert into public.content_horizon
      (channel_id, niche, title_draft, source_winner_video_id, bron_hook_category,
       planned_publish_at, confidence, reason, status)
    select
      null, p.niche, p.variant_title, p.source_video_id, p.hook_category,
      now() + interval '48 hours',
      p.replication_score,
      'Winner-replicatie: ' || coalesce(p.source_title, 'winner') || ' · hook ' || coalesce(p.hook_category, '?'),
      'planned'
    from picks p
    returning 1
  ),
  mark as (
    update public.cf2_winner_variants v set status = 'seeded'
    from picks p where v.id = p.id
    returning 1
  )
  select count(*) into v_count from ins;
  return v_count;
end $$;

-- RLS
alter table public.cf2_winner_variants enable row level security;
drop policy if exists cf2_winner_variants_read on public.cf2_winner_variants;
create policy cf2_winner_variants_read on public.cf2_winner_variants for select to authenticated, anon using (true);
drop policy if exists cf2_winner_variants_write on public.cf2_winner_variants;
create policy cf2_winner_variants_write on public.cf2_winner_variants for all to service_role using (true) with check (true);

grant select on public.cf2_winner_variants to authenticated, anon;
grant select on public.v_cf2_winner_replication to authenticated, anon;
