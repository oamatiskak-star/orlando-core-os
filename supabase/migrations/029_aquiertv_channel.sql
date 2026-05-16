-- Migration 029: AquierTv kanaal aanmaken
-- Nieuw kanaal voor het Aquier product — vastgoedacquisitie NL

INSERT INTO public.youtube_channels (
  id,
  name,
  language,
  voice,
  bg_color,
  style,
  status,
  oauth_status,
  created_at,
  updated_at
) VALUES (
  '0b924f5b-f23f-4e5a-bb00-fe3d5911c925',
  'AquierTv',
  'nl',
  'nl-NL-MaartenNeural',
  '#0d3347',
  'zakelijk, strategisch, gericht op vastgoedacquisitie en dealflow',
  'disconnected',
  'disconnected',
  now(),
  now()
)
ON CONFLICT (id) DO NOTHING;
