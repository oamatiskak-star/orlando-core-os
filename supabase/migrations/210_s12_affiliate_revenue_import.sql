-- 210_s12_affiliate_revenue_import.sql
-- €60K INHAALSPRINT — Sprint D: Revenue-import laag voor netwerken ZONDER server-postback
-- (Amazon PA-API, Temu, marketplace-rapporten). Eén generieke importer landt rapport-/API-
-- rijen in affiliate_conversions (status='confirmed') -> bestaande trigger
-- trg_sync_affiliate_to_monetization -> monetization_streams -> director (S5). Idempotent op
-- network_transaction_id. Credit-vrij. De PA-API/rapport-FETCH zelf vereist externe
-- credentials (Amazon PA-API keys) -> dat is de enige externe blokkade; de import-laag is af.

create table if not exists public.affiliate_import_runs (
  id            uuid primary key default gen_random_uuid(),
  network       text not null,
  source        text,
  rows_received int  default 0,
  rows_imported int  default 0,
  rows_skipped  int  default 0,
  ran_at        timestamptz not null default now(),
  detail        jsonb
);
comment on table public.affiliate_import_runs is
  'Sprint D: audittrail van revenue-imports per netwerk (Amazon/Temu/rapport).';

-- Generieke importer: rijen = jsonb-array van
--   {transaction_id, value_eur, commission_eur, currency, occurred_at, channel_id?, content_item_id?}
create or replace function public.import_affiliate_conversions(
  p_network text,
  p_rows    jsonb,
  p_source  text default 'report'
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_recv int := 0; v_imp int := 0; v_skip int := 0;
  rec jsonb;
  v_txn text; v_row_chan uuid; v_link uuid; v_link_chan uuid; v_chan uuid;
  v_comm numeric; v_val numeric;
begin
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    return jsonb_build_object('error', 'p_rows must be a json array');
  end if;

  for rec in select * from jsonb_array_elements(p_rows) loop
    v_recv := v_recv + 1;
    v_txn := nullif(rec->>'transaction_id', '');
    if v_txn is null then v_txn := p_network || ':' || md5(rec::text); end if;

    if exists (select 1 from public.affiliate_conversions where network_transaction_id = v_txn) then
      v_skip := v_skip + 1; continue;
    end if;

    v_row_chan := nullif(rec->>'channel_id', '')::uuid;

    -- koppel aan een actieve link van dit netwerk (voorkeur: matchend kanaal)
    select id, channel_id into v_link, v_link_chan
    from public.affiliate_links
    where network = p_network and coalesce(active, true)
      and (v_row_chan is null or channel_id = v_row_chan)
    order by (channel_id = v_row_chan) desc nulls last, last_used_at desc nulls last
    limit 1;

    v_chan := coalesce(v_link_chan, v_row_chan);

    -- geen click-link aanwezig (bv. Amazon vóór go-live): provisioneer een import-link
    -- zodat rapport-omzet toch attribueerbaar is naar monetization.
    if v_link is null then
      insert into public.affiliate_links (affiliate_id, network, product, url, channel_id, active, notes)
      values ('import:' || p_network, p_network, '(revenue-import)', '', v_chan, true,
              'auto-provisioned door import_affiliate_conversions')
      returning id into v_link;
    end if;

    v_comm := coalesce((rec->>'commission_eur')::numeric, 0);
    v_val  := coalesce((rec->>'value_eur')::numeric, v_comm);

    insert into public.affiliate_conversions
      (link_id, channel_id, content_item_id, value_eur, commission_eur, currency,
       status, network_transaction_id, occurred_at)
    values
      (v_link, v_chan, nullif(rec->>'content_item_id', '')::uuid, v_val, v_comm,
       coalesce(rec->>'currency', 'EUR'), 'confirmed', v_txn,
       coalesce((rec->>'occurred_at')::timestamptz, now()));
    v_imp := v_imp + 1;
  end loop;

  insert into public.affiliate_import_runs (network, source, rows_received, rows_imported, rows_skipped)
  values (p_network, p_source, v_recv, v_imp, v_skip);

  return jsonb_build_object('network', p_network, 'received', v_recv, 'imported', v_imp, 'skipped', v_skip);
end $$;

comment on function public.import_affiliate_conversions(text, jsonb, text) is
  'Sprint D: importeert revenue-rapportrijen -> affiliate_conversions (confirmed) -> monetization (trigger). Idempotent; werkt voor Amazon/Temu/elk postback-loos netwerk.';

grant execute on function public.import_affiliate_conversions(text, jsonb, text) to authenticated, service_role;

-- Engine Planner: revenue-import worker registreren (VUISTREGEL). De FETCH (PA-API/rapport)
-- draait via de Vercel-cron route; bij ontbrekende credentials is het een no-op (extern geblokkeerd).
insert into public.engine_schedule (engine_key, grp, label, block_key, enabled) values
  ('media:affiliate-revenue-import', 'media', 'Sprint D Affiliate revenue-import (Amazon/rapport -> conversions -> monetization)', 'youtube', true)
on conflict (engine_key) do update set enabled = true, updated_at = now();
