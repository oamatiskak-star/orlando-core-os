# Autonomous AI Media Holding Ecosystem — Master Roadmap

**Aangemaakt:** 2026-05-26
**Niveau:** Holding (overkoepelt alle BV's)
**Status-bron:** dit document = blueprint. Live status per milestone hoort uiteindelijk in Supabase (`shaunumewswpxhmgbtvv`) net als `media_holding_phases`/`media_holding_modules`.

> **Prioriteit blijft:** Aquier live launchen voor alle Tier 1 + 2 landen (P1). Deze roadmap loopt **parallel/erna**, niet ervoor. Zie `Desktop/MODIWÉ BV/Aquier/PROJECT_STATUS.md`.

---

## Missie

Volledig autonome AI-gedreven holding die meerdere inkomstenstromen combineert in één schaalbaar ecosysteem. Van media-organisatie → autonome holding company.

## Harde regels (leidend bij elke milestone)

1. Altijd eerst GRATIS oplossingen vóór betaald.
2. OPEN SOURCE waar mogelijk.
3. LOKALE infra indien goedkoper/efficiënter.
4. **Niets opnieuw bouwen wat al bestaat.**
5. Automatiseer alles wat herhaalbaar is.
6. Elke milestone moet zelfstandig winstgevend kunnen draaien.
7. Elke milestone geeft leads/verkeer door aan andere milestones.
8. Prioriteit: cashflow → automatisering → recurring revenue → schaalbaarheid → lage opex.
9. AI-agents voor: content, sales, support, leadgen, research, development.
10. Bestaande assets benutten: 11 YouTube-kanalen, audience, content, infra.

## Waardeketen

```
MEDIA → TRAFFIC → LEADS → SERVICES → AUTOMATION → SOFTWARE → RECURRING REVENUE → ACQUISITIONS → HOLDING COMPANY → OSIL
```

**OSIL = apex / eindbestemming.** OSIL is Orlando's persoonlijke financieel-adviseur-laag (loon, beleggingen, investeringen, vermogen). Alle **netto** omzet van de hele organisatie stroomt hier naartoe **ná belasting**. Koppelt aan Modiwerijo Financial Management. Wordt geïmplementeerd als **dashboard-module "Persoonlijke Finance / OSIL"** in Orlando Core OS — niet als losse projectmap. Voedt M23 Investment Engine.

## Infra-strategie (gratis/open source eerst)

n8n · Ollama · Supabase · PostgreSQL · Docker · Coolify · LangChain · Flowise · OpenWebUI · Qdrant · Whisper · FFmpeg · LocalAI · ComfyUI · Stable Diffusion · LibreChat · Typebot · Mautic · Matomo · Plausible · Directus · Appwrite

**Betaald alleen wanneer:** ROI direct positief · schaal vereist · snelheid > kosten.

---

## Milestones — status t.o.v. bestaande assets

Legenda: ✅ bestaat al · 🔄 deels aanwezig · ⏳ nieuw te bouwen

| # | Milestone | Verdienmodel | Status | Bestaand fundament / koppeling |
|---|-----------|--------------|--------|-------------------------------|
| 1 | Organisatie OS | indirect | ✅ | Orlando Core OS: Supabase, Docker/n8n, agent orchestration, central DB |
| 2 | AI Content Engine | Adsense + monetization | ✅ | Media Holding OS (6 fases, 23 modules live) + Fase 7 Executive Layer + viral/audio/trend-crons |
| 3 | Affiliate Engine | commissies | 🔄 | `affiliate-engine` module live in Media Holding OS — niches/automation uitbreiden |
| 4 | Programmatic SEO Network | SEO + ads + affiliate | 🔄 | Aquier 78 SEO-pages (pattern bewezen) → generaliseren naar niche-netwerk |
| 5 | Lead Generation System | leads verkopen | ⏳ | scraping + outreach + booking + CRM (n8n/Typebot) |
| 6 | Website Agency | websites + retainers | ⏳ | Next.js/WP/Framer/Webflow + AI templates |
| 7 | AI Automation Agency | high-ticket retainers | 🔄 | bestaande agents (mail/finance/CRM) → externaliseren als dienst |
| 8 | Appointment Setting | per afspraak | ⏳ | outbound: email/LinkedIn/IG/WhatsApp + CRM-sync |
| 9 | Digital Products | downloads | ⏳ | prompts/templates/SOPs → Gumroad/Lemon Squeezy |
| 10 | Community Ecosystem | memberships | 🔄 | Aquier Premium Investor Community (Q3) als eerste cohort → Skool/Discord |
| 11 | Online Education | cursussen | ⏳ | AI lesson creation + support assistant |
| 12 | White Label SaaS | subscriptions | 🔄 | open-source GHL-alternatief; leunt op bestaande SaaS-infra |
| 13 | AI Agent Marketplace | subs + usage | 🔄 | 80+ agents bestaan al → productiseren als marketplace |
| 14 | SaaS Product Development | MRR | ✅🔄 | Aquier (P1) + SterkCalc live; nieuwe products op interne problemen |
| 15 | Media Buying System | performance mktg | ⏳ | Meta/Google/TikTok Ads + AI creatives/optimization |
| 16 | E-commerce Automation | product sales | ⏳ | POD + digital commerce + AI stores |
| 17 | Newsletter Media Network | sponsors + subs | 🔄 | Beehiiv/Substack; content-repurposing pipeline bestaat |
| 18 | Data & Analytics Services | dashboards + retainers | 🔄 | Metabase/Superset/Matomo bovenop bestaande DB |
| 19 | Micro-SaaS Acquisitions | cashflow | ⏳ | Acquire.com/Flippa |
| 20 | Website Acquisitions | SEO + affiliate + ads | ⏳ | bestaande traffic-assets kopen |
| 21 | YouTube Channel Acquisitions | media scaling | ⏳ | faceless channels kopen + automatiseren (sluit aan op M2) |
| 22 | Holding Company System | overkoepelend | 🔄 | BV-structuur bestaat → divisies formaliseren (media/SaaS/AI/acq/investment) |
| 23 | Investment Engine | kapitaalgroei | ⏳ | startups/SaaS/media/AI-infra |
| 24 | Full Autonomous Organization | zelfsturend | 🔄 | Executive Intelligence Layer (Fase 7) = eerste laag AI-management |

---

## Aanbevolen bouwvolgorde (cashflow-first, leunend op bestaand)

Niet 1→24 lineair. Logische cashflow-volgorde die bestaande assets hergebruikt:

1. **Nu / P1:** Aquier launch afmaken (Tier 1+2). Genereert recurring + bewijst SEO/community-patterns.
2. **Quick cashflow op bestaande traffic:** M3 Affiliate + M17 Newsletter + M4 Programmatic SEO (hergebruik Aquier-SEO-pattern op de 11 kanalen-niches).
3. **Services-laag (high-ticket, weinig nieuwbouw):** M7 Automation Agency + M5 Leadgen + M8 Appointment Setting — verkoopt wat er al draait.
4. **Productiseren:** M13 Agent Marketplace + M9 Digital Products + M11 Education + M12 White Label.
5. **Schaal & kapitaal:** M15 Media Buying, M19-21 Acquisitions, M23 Investment Engine.
6. **Overkoepeling:** M22 Holding-divisies + M24 Autonomous Org (bouwt door op Executive Layer).

---

## Beslissingen 2026-05-26

- **OSIL = apex** (zie waardeketen). Geïmplementeerd als dashboard-module "Persoonlijke Finance" gekoppeld aan Modiwerijo Financial Management. Netto-na-belasting cashflow uit alle BV's stroomt hierheen.
- **Parallel-spoor naast Aquier (P1):** (#2) `holding_milestones` Supabase-tracking + dashboard-tracker bouwen, én (#3) eerstvolgende quick-cashflow milestone op bestaande traffic starten (M3 Affiliate / M4 SEO / M17 Newsletter).
- **Aquier-launch blijft P1** en gaat vóór alles.

## Actief parallel-spoor

1. ⏳ Milestone-tracking: `holding_milestones` tabel (patroon = `media_holding_modules`) + `/dashboard` build-tracker view.
2. ⏳ OSIL / Persoonlijke Finance dashboard-module (apex cashflow-sink).
3. ⏳ Quick-cashflow milestone selecteren + eerste concrete build (M3/M4/M17).

---

## Koppelingen

- Holding-codebase/engines: `Documents/orlando-core-os/` (dit document)
- Master build plan media: `MASTER_BUILD_PLAN.md`
- Ecosystem-architectuur: `ECOSYSTEM_ARCHITECTURE.md`
- Aquier (P1): `Desktop/MODIWÉ BV/Aquier/` ↔ `Modiwe Software BV/Projecten/Aquier` (symlink)
