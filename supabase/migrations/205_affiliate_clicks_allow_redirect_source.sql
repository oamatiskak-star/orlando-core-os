-- 205_affiliate_clicks_allow_redirect_source.sql
-- FIX attributie-blokkade: de /r/<code> redirect-handler schrijft source_platform='redirect',
-- maar de check-constraint stond dat niet toe -> elke redirect-klik-insert faalde stil (try/catch)
-- -> 0 clicks gelogd. Geverifieerd via go-live-test (clicks bleven 0; na fix 2 clicks gelogd).
alter table public.affiliate_clicks drop constraint if exists affiliate_clicks_source_platform_check;
alter table public.affiliate_clicks add constraint affiliate_clicks_source_platform_check
  check (source_platform = any (array[
    'youtube','tiktok','instagram','facebook','snapchat','x','linkedin','reddit','other','redirect','pixel','api'
  ]));
