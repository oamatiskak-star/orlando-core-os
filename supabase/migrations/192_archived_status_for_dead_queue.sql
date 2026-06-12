-- 186_archived_status_for_dead_queue.sql
-- Fase 1 cleanup-correctie: 'archived' toestaan als terminale status voor dode wachtrij-records.
-- Reden: mf_classify_dead_queue(true) (migr 185) zet status='archived', maar de check-constraint
-- stond die waarde niet toe. Puur permissiever (breekt geen bestaande rijen) + pipeline-view mapt
-- 'archived' → fase 'gearchiveerd' (anders 'overig').
alter table public.youtube_upload_queue drop constraint youtube_upload_queue_status_check;
alter table public.youtube_upload_queue add constraint youtube_upload_queue_status_check
  check (status = any (array[
    'queued','preparing','normalizing','uploading','uploaded','uploaded_pending_processing',
    'processing','verifying','verified_live','failed','retrying','manual_review_required',
    'cancelled','planned','unrecoverable','blocked','rework_required','archived'
  ]));

create or replace view public.v_ctl_upload_pipeline as
 select id, channel_id, coalesce(channel_name, '(onbekend)') as kanaal, status as ruwe_status,
    case
      when status = 'planned' then 'gepland'
      when status = any (array['queued','retrying','preparing','normalizing']) then 'in_wachtrij'
      when status = any (array['uploading','uploaded_pending_processing','processing','verifying']) then 'in_verwerking'
      when status = 'verified_live' then 'live'
      when status = 'failed' then 'mislukt'
      when status = 'manual_review_required' then 'aandacht_nodig'
      when status = 'unrecoverable' then 'afgeschreven'
      when status = 'cancelled' then 'geannuleerd'
      when status = 'archived' then 'gearchiveerd'
      else 'overig'
    end as fase,
    case
      when last_error ~~* '%unauthorized_client%' then 'oauth'
      when last_error ~~* '%input file not found%' then 'bronbestand_weg'
      when last_error ~~* '%quota%' then 'quota'
      when last_error ~~* '%ffmpeg%' then 'render'
      when last_error is null then null
      else 'overig'
    end as fout_type,
    last_error, scheduled_publish_at, created_at, updated_at
   from public.youtube_upload_queue q;
