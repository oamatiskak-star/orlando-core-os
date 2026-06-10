-- 163_war_room_review_notes.sql
-- Media War Room — Review Queue notities/markeringen (NIET-blokkerend).
-- Dit is GEEN approval-systeem: het blokkeert Hermes/de Content Factory niet.
-- Alleen een extra observatie/controlelaag voor Orlando (opmerking / interessant / analyseren).
-- GEEN workers, GEEN cron → Engine Planner-regel niet van toepassing.
-- HARDE GATE: niet automatisch toepassen op prod — los toepassen na review.
-- De Review Queue toont de pipeline OOK zonder deze tabel; alleen het opslaan van
-- notities/markeringen activeert na toepassing (frontend degradeert gracieus).

create table if not exists public.war_room_review_notes (
  id            uuid primary key default gen_random_uuid(),
  content_item_id uuid,                 -- creative (media_holding_content_items.id), geen harde FK (additief/veilig)
  kind          text not null default 'comment'
                check (kind in ('comment', 'interesting', 'analyze')),
  note          text,
  created_by    text,
  created_at    timestamptz not null default now()
);

create index if not exists war_room_review_notes_item_idx
  on public.war_room_review_notes (content_item_id, created_at desc);

grant select, insert on public.war_room_review_notes to authenticated;
