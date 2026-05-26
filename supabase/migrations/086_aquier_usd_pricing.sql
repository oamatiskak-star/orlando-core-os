-- ─────────────────────────────────────────────────────────────────────────
-- Migration 086 — Aquier USD pricing (USA launch)
-- ─────────────────────────────────────────────────────────────────────────
-- Schema: vastgoed_core (Aquier productie — gedeeld Supabase project)
--
-- Voegt USD prijskolommen toe aan membership_tiers voor de USA launch.
-- US PPF = 1.30 → Scout $279/mo, Developer $419/mo (bevestigd door Orlando 2026-05-25).
-- Yearly bij dezelfde discount-ratio als EU tiers (Scout ~20%, Developer ~17%).
--
-- BELANGRIJK: stripe_*_price_id_usd blijven NULL tot Orlando de USD Price
-- objects in Stripe Dashboard (LIVE) aanmaakt. Daarna een UPDATE met de
-- echte price ids (zie onderaan, stap 2).
--
-- Additief + idempotent — raakt geen bestaande EUR kolommen/data aan.

-- ── Stap 1: kolommen + USD bedragen ──────────────────────────────────────
alter table vastgoed_core.membership_tiers
  add column if not exists monthly_price_usd       numeric,
  add column if not exists annual_price_usd        numeric,
  add column if not exists stripe_monthly_price_id_usd text,
  add column if not exists stripe_annual_price_id_usd  text;

-- Scout (explorer): $279/mo · $2,679/yr (20% jaarkorting)
update vastgoed_core.membership_tiers
set monthly_price_usd = 279.00,
    annual_price_usd  = 2679.00
where id = 'explorer';

-- Developer: $419/mo · $4,190/yr (~17% jaarkorting, gelijk aan EU ratio)
update vastgoed_core.membership_tiers
set monthly_price_usd = 419.00,
    annual_price_usd  = 4190.00
where id = 'developer';

-- ── Stap 2 (NA Stripe Dashboard): vul USD price ids ──────────────────────
-- Orlando maakt in Stripe (LIVE) USD Price objects aan op de Scout + Developer
-- Products, en vervangt onderstaande placeholders. Tot dan blijven ze NULL en
-- mag de checkout-code NIET naar USD price ids grijpen (val terug op contact/
-- of toon "coming soon" voor US tot dit gevuld is).
--
-- update vastgoed_core.membership_tiers
--   set stripe_monthly_price_id_usd = 'price_XXXXXXXXXXXX',
--       stripe_annual_price_id_usd  = 'price_YYYYYYYYYYYY'
-- where id = 'explorer';
--
-- update vastgoed_core.membership_tiers
--   set stripe_monthly_price_id_usd = 'price_ZZZZZZZZZZZZ',
--       stripe_annual_price_id_usd  = 'price_WWWWWWWWWWWW'
-- where id = 'developer';

-- ── Verificatie ──────────────────────────────────────────────────────────
-- select id, name, monthly_price_eur, monthly_price_usd, annual_price_usd,
--        stripe_monthly_price_id_usd is not null as has_usd_price
-- from vastgoed_core.membership_tiers where id in ('explorer','developer');
