-- 136_content_radar_calendar.sql
-- Brug: competitor_signals (viral-radar + concurrent-spikes) → content-ideeën,
-- gerouteerd naar Orlando's eigen kanalen (media_holding_channels) per niche.
-- Dit is de IDEE-backlog (review-laag) vóór de productiekalender yt_content_calendar;
-- Orlando keurt ideeën goed/af en promoot ze pas daarna naar productie.
-- Draait als geplande engine 'content:radar-calendar' in het content-blok (18:30-22:00),
-- pg_cron gated door engine_window_open() — single source of truth = de Engine Planner.

create table if not exists public.content_radar_queue (
  id                  uuid primary key default gen_random_uuid(),
  source_signal_id    uuid unique references public.competitor_signals(id) on delete cascade,
  source_competitor   text,
  source_topic        text,
  niche               text,
  target_channel_id   uuid references public.media_holding_channels(id),
  target_channel      text,
  signal_relevance    text,                      -- 'benchmark' | 'format_only'
  format              text,                      -- challenge|experiment|myth_bust|trend_cover|format_test
  hook                text,
  title_draft         text not null,
  rationale           text,
  priority            int  not null default 0,
  status              text not null default 'idea' check (status in ('idea','approved','rejected','promoted')),
  promoted_calendar_id text,
  due_date            date,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index if not exists idx_content_radar_queue_status  on public.content_radar_queue(status);
create index if not exists idx_content_radar_queue_channel on public.content_radar_queue(target_channel_id);
create index if not exists idx_content_radar_queue_prio    on public.content_radar_queue(priority desc);

grant select, insert, update on public.content_radar_queue to service_role;
grant select on public.content_radar_queue to authenticated, anon;

-- ── Generator: signalen → content-ideeën (idempotent via unique source_signal_id) ──
create or replace function public.generate_radar_content_queue()
returns integer language plpgsql as $fn$
declare v_count integer;
begin
  with nichemap(niche, ch_name, thema, doel) as (values
    ('beleggen','BeleggingsTv','je portfolio','meer rendement'),
    ('crypto',  'CryptoVermogen','je crypto','crypto-winst'),
    ('vermogen','VermogenTv','je vermogen','financiële vrijheid'),
    ('sparen',  'SpaarTv','je spaargeld','meer overhouden'),
    ('vastgoed','VastgoedTv','je vastgoed','je eerste pand')
  ),
  cand as (
    select s.id as signal_id, s.signal_type, s.signal_relevance, s.magnitude, s.notes, s.metadata,
           c.name as competitor, c.niche, v.title as topic,
           nm.ch_name, nm.thema, nm.doel, mc.id as channel_id
    from public.competitor_signals s
    join public.competitor_channels c on c.id = s.competitor_id
    join nichemap nm on nm.niche = c.niche
    join public.media_holding_channels mc on mc.name = nm.ch_name
    left join public.competitor_videos v on v.id = s.video_id
    where s.detected_at > now() - interval '21 days'
      and s.video_id is not null
      and s.acknowledged_at is null              -- alleen LIVE signals → geen ruis/dubbel
      and not exists (select 1 from public.content_radar_queue q where q.source_signal_id = s.id)
  ),
  shaped as (
    select *,
      case
        when signal_type = 'format_shift' then 'format_test'
        when signal_relevance = 'format_only' and (metadata->>'hooks') ilike any(array['%€0%','%van 0%']) then 'challenge'
        when signal_relevance = 'format_only' and (metadata->>'hooks') ilike any(array['%ik testte%','%ik probeerde%','%wat gebeurt%']) then 'experiment'
        when signal_relevance = 'format_only' and (metadata->>'hooks') ilike any(array['%scam%','%nep%','%illegaal%']) then 'myth_bust'
        else 'trend_cover'
      end as fmt
    from cand
  )
  insert into public.content_radar_queue
    (source_signal_id, source_competitor, source_topic, niche, target_channel_id, target_channel,
     signal_relevance, format, hook, title_draft, rationale, priority, status, due_date)
  select
    signal_id, competitor, left(coalesce(topic,'(onbekend)'),120), niche, channel_id, ch_name,
    signal_relevance, fmt,
    left(coalesce(notes,''),160),
    case fmt
      when 'challenge'   then 'Van €0 naar €1.000: '||doel||' — lukt het in 30 dagen?'
      when 'experiment'  then 'Ik testte: '||left(coalesce(topic,'dit'),48)||' — werkt dit voor '||thema||'?'
      when 'myth_bust'   then left(coalesce(topic,'Deze tip'),52)||' — slim of scam? Ik zoek het uit'
      when 'format_test' then 'Concurrent '||competitor||' schakelt van format — moeten wij dat ook?'
      else left(coalesce(topic,'Dit nieuws'),52)||' — wat betekent dit voor '||thema||'?'
    end,
    'Uit '||signal_type||' van '||competitor||' ('||niche||'): '||left(coalesce(notes,''),90),
    least(100, greatest(1, round(case when signal_relevance='format_only' then magnitude/20.0 else magnitude*5 end)))::int,
    'idea', current_date + 7
  from shaped
  on conflict (source_signal_id) do nothing;
  get diagnostics v_count = row_count;
  return v_count;
end $fn$;

grant execute on function public.generate_radar_content_queue() to service_role, authenticated, anon;

-- ── Status-RPC voor het dashboard (security definer; user-client mag updaten) ──
create or replace function public.set_radar_idea_status(p_id uuid, p_status text)
returns void language plpgsql security definer set search_path=public as $st$
begin
  if p_status not in ('idea','approved','rejected','promoted') then
    raise exception 'ongeldige status: %', p_status;
  end if;
  update public.content_radar_queue set status = p_status, updated_at = now() where id = p_id;
end $st$;
grant execute on function public.set_radar_idea_status(uuid, text) to anon, authenticated, service_role;

-- ── Planner-registratie: engine in het content-blok ──────────────────────────
insert into public.engine_schedule (engine_key, grp, label, block_key, enabled)
values ('content:radar-calendar','content','Viral-radar → contentkalender','content', true)
on conflict (engine_key) do update set block_key=excluded.block_key, label=excluded.label, enabled=true;

-- ── Gated pg_cron: draait elke 20 min, maar werkt alleen binnen het content-venster ──
do $unsch$ begin perform cron.unschedule('content_radar_calendar'); exception when others then null; end $unsch$;
select cron.schedule('content_radar_calendar','*/20 * * * *',
  $cron$ select case when public.engine_window_open('content:radar-calendar')
                     then public.generate_radar_content_queue() else 0 end $cron$);
