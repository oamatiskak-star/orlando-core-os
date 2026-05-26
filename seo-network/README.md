# M4 — Programmatic SEO Network

Milestone 4 van het Autonomous AI Media Holding Ecosystem. Genereert 1000+ niche-pagina's
gevoed door de bestaande finance-YouTube-kanalen (rule 10: bestaande assets benutten).

## Datamodel (migratie 097)

- `seo_niches` — 5 niches, elk gekoppeld aan een kanaal (VermogenTv/SpaarTv/VastgoedTv/CryptoVermogen/BeleggingsTv).
- `seo_keyword_clusters` — keyword-research per niche (intent + prioriteit). Nu 60 (12/niche).
- `seo_pages` — pagina-scaffolding, status-driven (`planned → generating → draft → published`).
  `body_md` is **NULL** tot de AI-worker echte content levert (no-mock).

## Workflow

1. **Scaffolding** (`scaffolding.sql`) — deterministisch: clusters × pagina-types → `seo_pages` rijen
   met slug/title/meta/h1. Geen AI, geen key nodig. Idempotent (ON CONFLICT). Nu: 240 pagina's.
2. **Content-generatie** (`generate-content.mjs`) — key-gated. Vult `body_md` voor `planned` pagina's
   via Anthropic, zet status op `draft`. Schrijft niets bij lege output (no-mock).
3. **Render-laag** — eigen Next.js niche-site (doeldomein TBD). Hergebruikt het Aquier
   `generateStaticParams`-patroon: leest `published` pagina's uit `seo_pages`.

## Draaien (content-generatie)

```bash
# Vereist in runtime-env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY
node seo-network/generate-content.mjs 10   # batch van 10
```

⚠️ **Key-gated:** zonder `ANTHROPIC_API_KEY` stopt de worker direct. Dat is dezelfde runtime-env-blocker
als Aquier P1 (Render/Vercel). Tot dan blijft alle content NULL — bewust geen placeholders.

## Schalen naar 1000+

Breid `seo_keyword_clusters` uit (research-agent of handmatig) en draai `scaffolding.sql` opnieuw.
Met 4 pagina-types: 250 clusters → 1000 pagina's.
