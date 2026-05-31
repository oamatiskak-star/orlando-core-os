-- 096_osm_terminal_commands.sql
-- Commando-queue voor de "Ga verder"-knop. De dashboardknop zet hier een commando;
-- een lokale listener op de host (cli-l/cli-r) opent iTerm2, typt 'claude' + Enter en
-- laadt de prompt. Bij een mobiele druk draait de sessie in een gedeelde tmux-sessie
-- zodat Terminus op de iPhone met hetzelfde venster kan koppelen.
create table if not exists public.osm_terminal_commands (
  id            uuid primary key default gen_random_uuid(),
  machine_id    text not null,                       -- cli-l | cli-r (op basis van worktree)
  worktree_path text not null,
  repo          text,
  action        text not null default 'open_claude_resume',
  prompt        text not null,
  build_id      uuid,
  title         text,
  from_mobile   boolean not null default false,
  tmux_session  text,
  terminus_link text,
  status        text not null default 'queued' check (status in ('queued','claimed','done','failed')),
  claimed_by    text,
  claimed_at    timestamptz,
  result        jsonb,
  created_at    timestamptz not null default now()
);
create index if not exists idx_osm_terminal_cmd_poll on public.osm_terminal_commands(machine_id, status, created_at);

alter table public.osm_terminal_commands enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='osm_terminal_commands' and policyname='svc_all') then
    create policy svc_all on public.osm_terminal_commands for all using (true) with check (true);
  end if;
end $$;
grant select, insert, update on public.osm_terminal_commands to anon, authenticated, service_role;
