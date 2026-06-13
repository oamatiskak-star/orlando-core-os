-- 204_affiliate_go_live_trigger.sql — AFFILIATE GO-LIVE automatisering
-- Zodra een programma op account_status='active' wordt gezet, voert Hermes automatisch
-- de hele activatieketen uit: approval -> voorbereide links activeren -> rank -> recommendations.
-- Column-specifieke trigger op account_status -> geen recursie (rank()/link-update raken
-- account_status niet). Minimale trigger op bestaande functies; geen nieuwe modules.
alter table public.affiliate_programs add column if not exists approval_status text;

create or replace function public.affiliate_go_live()
returns trigger language plpgsql as $$
begin
  if NEW.account_status = 'active' and (OLD.account_status is distinct from 'active') then
    update public.affiliate_programs
       set approval_status = 'approved'
     where id = NEW.id and (approval_status is distinct from 'approved');

    update public.affiliate_links
       set affiliate_id = coalesce(nullif(NEW.referral_code,''), affiliate_id),
           url          = coalesce(nullif(NEW.affiliate_link,''), url),
           active       = true,
           updated_at   = now()
     where network = NEW.name;

    perform public.rank_affiliate_programs();
    perform public.generate_affiliate_recommendations(3);
  end if;
  return NEW;
end; $$;

drop trigger if exists trg_affiliate_go_live on public.affiliate_programs;
create trigger trg_affiliate_go_live
  after update of account_status on public.affiliate_programs
  for each row execute function public.affiliate_go_live();

comment on function public.affiliate_go_live() is
  'AFFILIATE GO-LIVE: bij account_status->active automatisch approval + links activeren + rank + recommendations.';
