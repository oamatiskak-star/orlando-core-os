# Briefing: Aquier.com — Organisch Verkeer & Orlando Status
**Datum:** 2026-06-22  
**Van:** Claude (sessie real-profit-verification)  
**Voor:** Claude (uitvoerende sessie)  
**Repo:** oamatiskak-star/orlando-core-os  
**Branch:** werk op `claude/real-profit-verification-5uhxi9` of maak nieuwe feature branch

---

## Wat je moet weten over dit project

Orlando Core OS is een autonome media- en vastgoed-intelligence holding. Twee producten zijn relevant:

**1. Aquier.com** — AI vastgoed-intelligence platform  
- Doelgroep: beleggers, developers, family offices (NL primair, US/UK Q3-Q4 2026)  
- Revenue: memberships €199–€299/mnd + rapporten €97–€499 à la carte  
- Heeft 274 SEO-kennisbank-pagina's live in `/kennisbank` (dynamisch uit DB)  
- Probleem: **0 betalende leden ooit** — cashflow-blocker voor het hele bedrijf  

**2. YouTube-kanalen** — 11 kanalen, 377 uploads/week  
- Kanalen: LoopForge AI, BrickPulse Lab, AquierTv, SliceTheory etc.  
- Nog niet in YouTube Partner Program (YPP) — geen AdSense-inkomsten  
- De €468/mnd die het dashboard toont is een **schatting** (views × RPM), geen echt geld  

---

## Deel 1 — Orlando: Huidige status

### Draait goed ✅
- YouTube upload-engine: 377 uploads/week, 11 kanalen, OAuth hersteld
- Engine Scheduler (sync_engine_windows): live, elke minuut
- Watchdog: live, Telegram-alerts bij downtime
- Executive engine: HTTP 200 op Render
- Acquisition scrapers: Funda/Jaap/Zillow/Rightmove actief in tijdblokken
- Aquier kennisbank: 274 pagina's live, PostHog tracking

### Gebouwd maar staat uit 🟡
| Systeem | Reden uit | Fix |
|---|---|---|
| Content Factory 2.0 | `engine_schedule` disabled | Shadow-run draaien, dan enablen |
| Winner-DNA detector | `enabled=false` | Enablen in engine_schedule |
| Learning-loop (migr. 154) | Tabellen leeg, worker niet ingepland | Inplannen + eerste run |

### Kritieke blockers 🔴
| Blocker | Impact | Locatie |
|---|---|---|
| Anthropic credits = €0 | Quality-gate dood; 257 runs ongefilterd | `youtube_quality_scores` = 0 rijen |
| Director cycle 10 dagen stale | Geen dagelijkse sturing | `media:director-plan` engine; LLM-error |
| Revenue-feedback = 0 | CTR/RPM onbekend, optimization blind | `monetization_metrics` leeg |
| Aquier: 0 betalingen | MRR onzichtbaar, geen cashflow | Checkout-flow + Moneybird |

**Prioriteitsvolgorde (eigenaar heeft dit bevestigd):**
1. CF2 shadow-run draaien
2. Eerste echte Aquier-betaling E2E → unlock Moneybird
3. Anthropic credits herstellen → quality-gate terug
4. Director cycle debuggen

---

## Deel 2 — Aquier: SEO-opdrachten

Dit is waar jij nu mee aan de slag gaat. Drie concrete taken, in volgorde van impact.

---

### TAAK 1 — FAQ-schema op bestaande kennisbank (snelste win)

**Wat:** Voeg `FAQPage` JSON-LD structured data toe aan de kennisbank-pagina's.  
**Waarom:** Google toont rich results (uitklapbare vragen in SERP) → hogere CTR zonder nieuwe content.  
**Scope:** De kennisbank-component in `frontend/app/` — zoek de component die kennisbank-artikelen rendert.

Implementatie-richting:
- Voeg per artikel een `FAQPage` schema toe als de pagina Q&A-structuur heeft
- Voeg `Article` + `Person`/`Organization` author-schema toe op alle kennisbank-pagina's
- Gebruik JSON-LD in een `<script type="application/ld+json">` tag (Google's voorkeur)
- Doe dit generiek in de layout/template, niet per pagina handmatig

Verificeer na implementatie: Google's Rich Results Test accepteert de JSON-LD.

---

### TAAK 2 — Rendement Calculator pagina

**Wat:** Bouw een interactieve vastgoed rendement calculator op Aquier.  
**URL:** `/kennisbank/rendement-calculator` of `/tools/rendement-calculator`  
**Waarom:** "vastgoed rendement berekenen" is het meest gezochte beleggers-zoekwoord in NL. Calculators trekken structureel backlinks (Zillow, Bankrate, NerdWallet doen dit met succes).

**Vereiste inputs:**
- Aankoopprijs (€)
- Aankoopkosten % (default 6% — overdrachtsbelasting + notaris)
- Maandhuur (€)
- Maandelijkse kosten: VvE, onderhoud, verzekering (€)
- Hypotheekrente % (optioneel)
- Leegstandspercentage % (default 5%)

**Vereiste outputs:**
- Bruto rendement: `(jaarhuur / aankoopprijs) × 100`
- Netto rendement: `((jaarhuur - jaarkosten) / (aankoopprijs + aankoopkosten)) × 100`
- Cash-on-cash return (als hypotheek ingevuld): `(netto cashflow / eigen inbreng) × 100`
- Oordeel: "Goed (>5%)", "Matig (3–5%)", "Slecht (<3%)"

**CTA onder calculator:**
- "Wil je een professionele dealscan? → Premium Dealscan voor €297"
- "Benieuwd of deze woning de moeite waard is? → Gratis deal-analyse aanvragen"

**SEO-eisen:**
- `<title>` = "Vastgoed Rendement Calculator — Bruto & Netto (2026) | Aquier"
- `HowTo` schema JSON-LD (stap 1 t/m 5)
- H1: "Vastgoed Rendement Berekenen" 
- Minimaal 400 woorden uitleg onder de calculator (wat is bruto vs netto, wanneer is iets een goede belegging, etc.)

---

### TAAK 3 — Uitponden Pillar Article

**Wat:** Schrijf en publiceer een uitgebreid kennisbank-artikel over uitponden.  
**URL:** `/kennisbank/uitponden`  
**Waarom:** Dit is het trending vastgoedonderwerp van 2026. 75.000 woningen worden uitgepondt, NVM heeft hier publiciteit over gemaakt, media citeren dit onderwerp actief. Een autoritatief artikel nu gepubliceerd = backlinks vanuit nieuws-sites.

**Structuur (H2-niveau):**
1. Wat is uitponden? (definitie)
2. Waarom ponden beleggers massaal uit in 2026? (fiscale context: box 3, WWS)
3. Uitponden vs vasthouden — wanneer is wat slim? (keuzematrix)
4. Stappenplan: hoe pond je een woning uit?
5. Belastingaspecten van uitponden (overdrachtsbelasting, vermogenswinst)
6. Wat betekent uitponden voor kopers/starters?
7. Aquier's data: in welke steden wordt het meest uitgepondt? (gebruik eigen Funda/Kadaster data als die beschikbaar is)
8. FAQ (10 vragen — dit triggert ook FAQ-schema)

**SEO-eisen:**
- `<title>` = "Uitponden in 2026: Complete Gids voor Beleggers | Aquier"
- `Article` + `FAQPage` schema JSON-LD
- Intern linken naar: Rendement Calculator, Premium Dealscan, Kansenradar
- Minimaal 1.500 woorden
- Zoekwoorden verwerken: "uitponden", "uitponden 2026", "uitponden belasting", "uitponden stappenplan", "uitponden kansen beleggers"

---

## Zoekwoorden om te targeten (prioriteit)

### NL (nu):
| Zoekwoord | Type pagina |
|---|---|
| vastgoed rendement berekenen | Calculator (Taak 2) |
| uitponden 2026 | Pillar article (Taak 3) |
| WOZ-waarde opzoeken 2026 | Kennisbank-artikel |
| huurprijs vrije sector berekenen | Calculator (volgende sprint) |
| cash on cash return vastgoed | Kennisbank + Calculator |
| woningmarkt analyse Amsterdam 2026 | Lokale rapportpagina |
| off-market woning vinden | Gids → Kansenradar CTA |
| woningwaarde rapport kopen | Directe product-pagina |

### US (Q3/Q4 2026):
| Keyword | Page type |
|---|---|
| investment property analysis tool | Landing page |
| cap rate calculator [city] | Calculator |
| off-market property finder | Product page |
| real estate market report [neighborhood] | Local data page |

---

## Topic clusters voor de kennisbank

Reorganiseer de 274 bestaande artikelen rond 5 pillar-clusters. Maak voor elke cluster een overzichtspagina:

| Cluster | Pillar URL | Satelliet-count |
|---|---|---|
| Rendement & berekeningen | `/kennisbank/rendement` | bruto/netto/cap-rate/cash-on-cash/LTV/DSCR |
| Woningmarkt updates | `/kennisbank/woningmarkt` | kwartaalcijfers per stad, uitpond-tracker, prijsontwikkeling |
| Deal sourcing | `/kennisbank/deal-sourcing` | off-market, distressed, bouwvergunningen |
| Huur & regelgeving | `/kennisbank/huurrecht` | vrije sector, WWS-punten, uitponden, huurprijs |
| Investeer-gidsen | `/kennisbank/beleggen-vastgoed` | eerste belegging, portfolio-opbouw, exit |

---

## Technische SEO — direct uitvoerbaar

Voer dit uit vóór nieuwe content:

1. **FAQ-schema** op alle kennisbank-pagina's (Taak 1 — hoogste ROI)
2. **Article + Author schema** op kennisbank-template
3. **Interne links** van calculator → rapport-producten
4. **Sitemap** — controleer of alle 274 kennisbank-pagina's in de sitemap zitten
5. **Canonical tags** — zorg dat geen duplicaten in de DB dubbele URLs geven

---

## Wat je NIET hoeft te doen

- Geen nieuwe engines of workers bouwen — dit is puur frontend/content/SEO
- Geen wijzigingen aan de YouTube-engine
- Geen database-migraties voor de calculator (client-side berekening is voldoende)
- Geen PR aanmaken tenzij eigenaar dat vraagt — branch pushen is genoeg

---

## Handige bestandslocaties

```
frontend/app/dashboard/media-holding/          — Media-holding pages
frontend/app/api/media-holding/                — API routes
frontend/app/(public)/kennisbank/              — Kennisbank public pages (zoek hier)
supabase/migrations/                           — DB-schema (210+ migr.)
scripts/seo-index-tracker.mjs                  — SEO tracker referentie
scripts/COMMERCIAL_VALIDATION.md               — Aquier commercieel framework
```

De kennisbank-component zoek je op:
```bash
grep -r "kennisbank" frontend/app --include="*.tsx" -l
```

---

## Samenvatting prioriteiten voor deze sessie

1. **FAQ-schema implementeren** op kennisbank-template (1–2 uur, hoge impact)
2. **Rendement Calculator bouwen** (3–4 uur, backlink-magneet)
3. **Uitponden artikel schrijven** (2–3 uur, trending onderwerp)

Commit op branch `claude/aquier-seo-[slug]`, push, geen auto-merge.
