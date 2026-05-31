# Orlando Core OS — projectregels

Lees ook `PROJECT_STATUS.md` (huidige focus + herstelpunt) en `MASTER_BUILD_PLAN.md`.

## Stack & locaties
- Frontend (Next.js 16 / Vercel): `frontend/` — `next build` doet type-check, TS-fouten breken de build.
- Render-engines: `youtube-engine/`, `planning-engine/`, `mail-engine/`.
- DB-migraties (Supabase): `supabase/migrations/` — oplopend nummer.

## VUISTREGEL — Engine Planner (verplicht)
**Elke nieuwe scraper, engine, AI-motor of worker moet ALTIJD ingepland worden in de Engine Planner.** Nooit een nieuwe achtergrond-job ongepland of in een eigen los interval laten draaien — dat veroorzaakt gelijktijdige load en storingen.

Bij het bouwen van een nieuwe engine:
1. Voeg een rij toe aan `public.engine_schedule` (`engine_key = '<grp>:<naam>'`, `grp`, `label`, `block_key`).
2. Kies/maak een tijdblok in `public.engine_schedule_blocks` dat **niet overlapt** met andere blokken (lichte engines mogen een blok delen; zware batches krijgen een eigen slot).
3. Handhaving loopt automatisch: `sync_engine_windows()` (minuut-cron, migratie 093) zet de bron-flag (`enabled`/`is_active`/`status`) gelijk aan `engine_window_open(engine_key)`. Een nieuwe dispatcher kan ook direct `engine_window_open()` checken.
4. Controleer in `/dashboard/planner` (24u-tijdlijn) dat er geen overlap is.

Planner = single source of truth voor wanneer wat draait. Schema in migratie 092, handhaving in 093.

## Engineeringregels (Orlando)
- Geen placeholders/mockups/testpagina's — alleen productieklare, volledige bestanden.
- Frontend mag backend niet breken en omgekeerd. project_id komt altijd uit backend.
- Branch vóór commit; niet auto-mergen naar productie zonder expliciete OK.
- Commit-stijl: `feat(scope): NL beschrijving`, korte zinnen.
