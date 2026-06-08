---
slug: seo_audit
title: SEO-audit / SEO-actieplan
triggers: [seo_audit, seo]
incident: false
match: seo, zoekmachine, ranking, keywords, vindbaarheid, meta, google, actieplan
project: Marketing
resolves_locally: true
---

# Playbook — SEO-audit / actieplan

Deterministische SEO-checklist. Lokaal af te handelen; cloud-model alleen voor creatieve keyword-uitbreiding.

## 1. Technische SEO (lokaal)
1. Indexering: `robots.txt`, `sitemap.xml` aanwezig en correct?
2. Meta: unieke `<title>` + `meta description` per pagina?
3. Structured data / schema.org aanwezig waar relevant?
4. Core Web Vitals: LCP/CLS/INP binnen norm (mobiel-first)?
5. Canonicals + geen duplicate content.

## 2. On-page (lokaal)
1. H1/H2-structuur per target-keyword.
2. Interne links naar belangrijke pagina's.
3. Alt-teksten op afbeeldingen.

## 3. Keyword-strategie
- Bestaande keywords + gaps. (Creatieve uitbreiding = optioneel GPT.)

## 4. Output
- Geprioriteerde actielijst (P1 technisch blokkerend → P3 nice-to-have).

## 5. Escalatiecriterium
- Lokaal model genereert het actieplan. GPT alleen voor brede keyword-brainstorm. Claude niet nodig (geen incident, geen code-fix).
