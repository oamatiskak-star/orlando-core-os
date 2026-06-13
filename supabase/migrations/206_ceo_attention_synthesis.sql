-- 206_ceo_attention_synthesis.sql
-- CEO-OS Aandachtspunten-synthese: per item dat menselijke aandacht vraagt → gesloten keten
-- (echt probleem? · root cause · impact · auto-opgelost? · mens nodig?). Read-only over echte bronnen.
create or replace view public.v_ceo_attention as
select 'uploads'::text as category, 'Upload-review'::text as label,
  coalesce(nullif(left(last_error,90),''),'(geen foutmelding)') as root_cause,
  count(*)::int as cnt,
  case when count(*) >= 20 then 'high' when count(*) >= 5 then 'medium' else 'low' end as impact,
  false as auto_resolved, true as human_needed, null::text as note
from public.youtube_upload_queue where status='manual_review_required'
group by last_error
union all
select 'check', display_name, coalesce(nullif(left(last_message,90),''),'—'), 1,
  case when severity in ('critical','high','error') then 'high' when severity='warning' then 'medium' else 'low' end,
  false, severity in ('critical','high','error'), 'watchdog-check faalt'
from public.infra_watchdog_check_status where enabled and not last_ok
union all
select 'incident', coalesce(service_name, incident_kind, 'incident'),
  coalesce(nullif(left(failure_summary,90),''),'—'), 1,
  case when failure_kind ilike '%lateness%' then 'medium' else 'high' end,
  false, true,
  case when proposed_actions is not null then 'auto-voorstel aanwezig' else 'geen auto-voorstel' end
from public.infra_watchdog_incidents where status='open';

grant select on public.v_ceo_attention to authenticated, anon;
