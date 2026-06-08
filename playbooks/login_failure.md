---
slug: login_failure
title: Login werkt niet
triggers: [backend_review, frontend_review]
incident: true
match: login, inloggen, inlog, authenticatie, wachtwoord, sessie, supabase auth
project: Vastgoed Core OS
resolves_locally: true
---

# Playbook — Login werkt niet

## 1. Symptomen
- Gebruiker kan niet inloggen / sessie verloopt direct / 401 na login.

## 2. Deterministische checks (lokaal)
1. Supabase Auth bereikbaar? `SUPABASE_URL`/anon-key in frontend env correct (juiste project: orlando-core-os, niet legacy sterkbouww)?
2. Key-rotatie: is een service_role/anon-key geroteerd zonder env-update?
3. Cookies/redirect: callback-URL en site-URL correct in Supabase Auth-config?
4. RLS: blokkeert een policy de eerste read na login?
5. Klok/JWT: token `exp` correct (geen scheve servertijd)?

## 3. Fix-pad
- Env-keys harmoniseren naar het juiste Supabase-project.
- Auth redirect/site-URL herstellen.

## 4. Escalatiecriterium
- GPT als checks geen oorzaak geven; Claude bij auth-code/RLS-fix.
