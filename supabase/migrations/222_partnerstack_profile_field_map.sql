-- 222_partnerstack_profile_field_map.sql
-- Field-map voor het PartnerStack PARTNER PROFILE (netwerk-niveau, gedeeld door
-- ClickUp + SurferSEO). De browser-registration-runner (local-agent) vult dit
-- ingelogde formulier zelf in.
--
-- ACHTER LOGIN: het profiel zit achter dash.partnerstack.com login. De runner
-- start een HEADED Chromium en pauzeert bij GATED velden. Daarom is het EERSTE
-- veld (company) gated: na navigeren pauzeert de runner direct → Orlando logt in
-- datzelfde Chrome-venster in → keurt de actie goed → runner hervat en vult de
-- rest. De submit-knop is altijd gated (extra review vóór 'Save').
--
-- Alle waarden zijn 'literal:' zodat de field-map zelfvoorzienend is (geen
-- afhankelijkheid van business_profiles). Selectors zijn best-effort (case-
-- insensitive attribute-match); niet-gevonden velden slaat de runner over en
-- markeert hij voor handmatige afronding — nooit verzonnen data.
--
-- LinkedIn is bewust NIET in de map: dat veld is verplicht en persoonlijk →
-- Orlando vult het zelf in tijdens de login-pauze.

insert into public.account_setup_field_maps (program_id, signup_url, fields, success_patterns, submit_selectors, source)
select ap.id,
  'https://dash.partnerstack.com/team/stck_fCXbGGSCpaivyU/profile',
  '[
     {"field":"company","source":"literal:Modiwerijo Financial Management BV","selectors":["input[name*=\"company\" i]","input[name*=\"business\" i]","input[placeholder*=\"company\" i]","input[aria-label*=\"company\" i]","input[name*=\"organization\" i]"],"strategy":"fill","gated":true},
     {"field":"website","source":"literal:https://aquier.com","selectors":["input[name*=\"website\" i]","input[name*=\"url\" i]","input[type=url]","input[placeholder*=\"website\" i]","input[aria-label*=\"website\" i]"],"strategy":"fill","gated":false},
     {"field":"country","source":"literal:Netherlands","selectors":["select[name*=\"country\" i]","select[aria-label*=\"country\" i]"],"strategy":"select","gated":false},
     {"field":"describe_business","source":"literal:Aquier (aquier.com) is a growing online knowledge base covering personal finance, investing, real estate, and small-business marketing and SEO. We publish in-depth, research-backed articles that help readers make better money, property, and business decisions. The site currently hosts roughly 300 articles in English and Dutch (Dutch-first) and is actively expanding into additional countries and languages. We are an early-stage but established and steadily growing publisher, operated under Modiwerijo Financial Management BV (Netherlands).","selectors":["textarea[name*=\"describe\" i]","textarea[name*=\"about\" i]","textarea[name*=\"business\" i]","textarea[placeholder*=\"describe\" i]","textarea[placeholder*=\"about\" i]","textarea[aria-label*=\"describe\" i]"],"strategy":"fill","gated":false},
     {"field":"audience","source":"literal:Our audience is self-directed individuals and small-business owners interested in personal finance, investing, real estate, and growing a business online. Readers come to Aquier to research tools, compare options, and learn practical, actionable strategies, which makes them a high-intent audience for finance, productivity, SaaS, marketing, and SEO products. The audience is primarily Dutch and English-speaking, with international reach expanding as we add more country-specific content.","selectors":["textarea[name*=\"audience\" i]","textarea[name*=\"sell\" i]","textarea[placeholder*=\"audience\" i]","textarea[placeholder*=\"who\" i]","textarea[aria-label*=\"audience\" i]"],"strategy":"fill","gated":false},
     {"field":"promotion","source":"literal:We promote exclusively through content and SEO. This includes long-form blog articles, product reviews, comparison and round-up content, and an email newsletter, all built around organic search and genuine editorial recommendations. We embed partner links contextually within relevant, helpful content. We do not bid on brand keywords in paid search, do not use incentivized, coupon-spam, or pop-under traffic, and do not engage in any form of misleading or non-compliant promotion. Every placement is editorial and disclosed.","selectors":["textarea[name*=\"promote\" i]","textarea[name*=\"promotion\" i]","textarea[name*=\"market\" i]","textarea[placeholder*=\"promote\" i]","textarea[placeholder*=\"how\" i]","textarea[aria-label*=\"promote\" i]"],"strategy":"fill","gated":false}
   ]'::jsonb,
  '["saved","success","updated","profile"]'::jsonb,
  '["button:has-text(\"Save\")","button:has-text(\"Save changes\")","button:has-text(\"Update\")","button:has-text(\"Submit\")","button[type=submit]"]'::jsonb,
  'seed'
from public.affiliate_programs ap
where ap.name in ('ClickUp', 'SurferSEO Affiliate')
on conflict (program_id) do nothing;
