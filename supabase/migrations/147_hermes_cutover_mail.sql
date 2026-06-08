-- ============================================================================
-- Migration 147: Gefaseerde cutover — Mail Engine als Hermes-producer
-- ============================================================================
-- De mail-engine is een continue poller (geen Vercel-cron). Cutover via een
-- AFTER INSERT-trigger op mail_messages: alléén ACTIE-vereisende, niet-spam mail
-- meldt zich aan bij Hermes (source='mail-engine'). De engine zelf is ONGEWIJZIGD.
-- Trigger is exception-guarded → een Hermes-fout breekt NOOIT een mail-insert.
--
-- Gate (forward-only, vuurt enkel op nieuwe rijen):
--   - categorie factuur/advocaat/leverancier/privé, OF priority=urgent
--     (urgente 'automatisering'/'support'-ruis wordt uitgesloten)
--   - nooit spam (categorie/priority/spam_score)
--
-- ROLLBACK: drop trigger + function (onderaan).
-- ============================================================================

create or replace function hermes.mail_to_hermes()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_company uuid;
  v_incident boolean;
  v_msg text;
begin
  -- spam-uitsluiting
  if coalesce(new.spam_score, 0) >= 0.5
     or coalesce(new.category,'') = 'spam'
     or coalesce(new.priority,'') = 'spam' then
    return new;
  end if;

  -- actie-gate: actionable categorie OF schone urgentie
  if not (
        coalesce(new.category,'') in ('factuur','advocaat','leverancier','privé')
        or (coalesce(new.priority,'') = 'urgent' and coalesce(new.category,'') not in ('automatisering','support'))
     ) then
    return new;
  end if;

  v_company  := coalesce(new.company_id, '4679cb71-dab5-4e80-aae1-59db58dfe6c5'::uuid); -- Modiwerijo fallback
  v_incident := (coalesce(new.priority,'') = 'urgent');
  v_msg := format('Mail-actie (%s/%s): %s',
                  coalesce(new.category,'mail'), coalesce(new.priority,'normal'),
                  left(coalesce(new.ai_action_suggestion, new.subject, 'inkomende mail vereist actie'), 200));

  begin
    perform hermes.submit_routing_request(v_company, v_msg, 'mail-engine', v_incident);
  exception when others then
    insert into hermes.logs(level, event, message, context)
    values ('warn', 'mail_to_hermes_failed', sqlerrm,
            jsonb_build_object('mail_id', new.id, 'source', 'mail-engine'));
  end;
  return new;
end $$;

drop trigger if exists trg_mail_to_hermes on public.mail_messages;
create trigger trg_mail_to_hermes
  after insert on public.mail_messages
  for each row execute function hermes.mail_to_hermes();

-- ============================================================================
-- ROLLBACK:
--   drop trigger if exists trg_mail_to_hermes on public.mail_messages;
--   drop function if exists hermes.mail_to_hermes();
-- ============================================================================
