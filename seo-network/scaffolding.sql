-- M4 Programmatic SEO Network — pagina-scaffolding (deterministisch, geen AI, idempotent).
-- Genereert seo_pages uit seo_keyword_clusters × pagina-types.
-- Draai opnieuw na het toevoegen van clusters om nieuwe pagina's te scaffolden.

with kw as (
  select c.id cluster_id, c.niche_id, c.primary_keyword kw,
         trim(both '-' from regexp_replace(lower(c.primary_keyword), '[^a-z0-9]+', '-', 'g')) kwslug
  from public.seo_keyword_clusters c
),
types(suffix, titletpl, intro) as (values
  ('',              '%s — Complete Gids (2026)',         'gids'),
  ('voor-beginners','%s voor Beginners',                 'beginners'),
  ('stappenplan',   '%s: Stappenplan',                   'stappenplan'),
  ('fouten',        '%s: Veelgemaakte Fouten Vermijden', 'fouten')
)
insert into public.seo_pages (niche_id, cluster_id, slug, title, meta_description, h1, status)
select kw.niche_id, kw.cluster_id,
       case when t.suffix='' then kw.kwslug else kw.kwslug||'-'||t.suffix end,
       format(t.titletpl, initcap(kw.kw)),
       left(format('Alles over %s. Praktische %s met concrete stappen en voorbeelden.', kw.kw, t.intro), 160),
       initcap(kw.kw),
       'planned'
from kw cross join types t
on conflict (niche_id, slug) do nothing;
