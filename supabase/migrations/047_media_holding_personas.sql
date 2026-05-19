-- 047_media_holding_personas.sql
-- Drie nieuwe specialist personas voor Media Holding OS workflows.
-- Nova (business / youtube media supervisor) blijft eindverantwoordelijk.

insert into public.agent_personas (name, persona_type, role, authority, description, icon, capabilities) values
  ('Vortex',  'specialist', 'viral intelligence',  'operator', 'Scant continu YouTube, TikTok, Reels, Reddit en Google Trends voor viral kansen. Output naar viral_opportunities en automatisch door naar OSIL kansenradar.', 'Radar',     array['scan','viral','trends','realtime']),
  ('Forge',   'specialist', 'content factory',     'operator', 'Bouwt content op basis van viral patterns: shorts, reels, loops, ASMR, AI-visuals. Voert renders, scheduling en batch-upload uit.',                          'Hammer',    array['render','content','batch','generation']),
  ('Atlas',   'specialist', 'cross-platform distribution', 'operator', 'Distribueert content naar YouTube Shorts, TikTok, Instagram Reels, Facebook Reels en Snapchat Spotlight. Bewaakt upload status per platform.',         'Globe2',    array['distribute','upload','cross-platform'])
on conflict (name) do nothing;

-- Capabilities update voor Nova zodat ze coördinator van Media Holding wordt
update public.agent_personas
   set capabilities = (
     select array_agg(distinct cap)
       from unnest(capabilities || array['media-holding','channels','monetization']::text[]) cap
   ),
       description = 'YouTube ecosysteem (5 kanalen) en content distributie. Coordinator van Media Holding OS: Vortex (viral intelligence) → Forge (content factory) → Atlas (distribution).',
       updated_at = now()
 where name = 'Nova';
