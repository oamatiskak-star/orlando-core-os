-- 217_enable_winner_horizon_loop.sql
-- Optimalisatie: winner-DNA- + trend(horizon)-lus aanzetten. Additief, alleen data-update
-- op engine_schedule (geen schema-wijziging). Conform Engine-Planner: een engine draait in
-- zijn blok-venster; sync_engine_windows() (mig 093) zet enabled = engine_window_open().
--
-- Staat vooraf (live 16-6): horizon-planner block_key=null/enabled=false (stond uit);
-- winner-detector block_key=null/enabled=true (aan maar ongepland). Beide krijgen het
-- 'content'-blok (18:30-22:00) zodat de planner ze beheert. Met de herstelde meetlus
-- (CTR/retentie nu echt gevuld) heeft de winner-detector eindelijk signaal om
-- winner_extraction_jobs te produceren.

update public.engine_schedule
   set block_key = 'content', enabled = true, updated_at = now()
 where engine_key in ('content:horizon-planner', 'content:winner-detector');
