-- 202_affiliate_category_expansion.sql
-- Verbreed affiliate_programs.category voor market-expansion (additief).
alter table public.affiliate_programs drop constraint if exists affiliate_programs_category_check;
alter table public.affiliate_programs add constraint affiliate_programs_category_check
  check (category = any (array[
    'saas_ai','finance_crypto','vastgoed_data','affiliate_network','other',
    'maker_hardware','marketplace','ai_video','automation','creator_tools','productivity'
  ]));
