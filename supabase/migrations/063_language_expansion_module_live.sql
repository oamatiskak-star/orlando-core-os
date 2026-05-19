-- 063_language_expansion_module_live.sql
-- Phase 11: language-expansion module live zetten + route corrigeren

update public.media_holding_modules
   set route   = '/dashboard/media-holding/language-expansion',
       status  = 'live',
       live_at = coalesce(live_at, now()),
       updated_at = now()
 where module_key = 'language-expansion';
