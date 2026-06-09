-- 157_osm_sessions_archive.sql
-- Soft-delete/archive voor Claude-sessies in de Build Tracker.
-- "Verwijder sessie" = archiveren (archived_at gezet) → uit de actieve dashboardlijsten,
-- maar de rij + alle gekoppelde data (build_tracker/commits/logs) blijven bestaan.
-- "Stop sessie" gebruikt de bestaande status-conventie (status='done' + stop_reason);
-- daarvoor is GEEN schema-wijziging nodig (stop_reason bestaat al, 'done' zit in de CHECK).

alter table public.osm_sessions add column if not exists archived_at timestamptz;
create index if not exists idx_osm_sessions_archived on public.osm_sessions (archived_at);
