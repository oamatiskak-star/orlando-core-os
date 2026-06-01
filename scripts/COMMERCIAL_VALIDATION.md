# Hermes Commercial Validation Engine (Prioriteit 0A)

**Niet "werkt het" — maar "wil iemand BETALEN".** Hermes beoordeelt elke pagina als een
**kritische koper per doelgroep** ("glas azijn in de mond"): zoekt redenen om NIET te kopen.

> **KPI-REFRAME (belangrijk):** dit is **content-QA-diagnostiek**, geen demand-metric. `would_buy`
> meet een vijandige *mening* over de copy, geen koopgedrag, en blijft tegen een azijn-rechter per
> definitie laag — dus het is **NIET** de go/no-go. De **primaire conversie-/scale-gate is echt
> gedrag**: de Buyer-Intent-engine (`scripts/buyer-intent-gate.mjs` → `vastgoed_core.v_buyer_intent`).
> Gebruik deze validator om **copy te verbeteren**, niet om op te schalen.

## Run
```bash
SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… ANTHROPIC_API_KEY=… \
CV_COUNTRY=NL CV_DRY_RUN=1 node scripts/commercial-validator.mjs   # eerst dry-run
CV_COUNTRY=NL node scripts/commercial-validator.mjs                # wegschrijven
CV_COUNTRY=US AQUIER_URL_US=https://aquier.com/en node scripts/commercial-validator.mjs
```
Env: `CV_MODEL` (default claude-sonnet-4-6), `CV_PAGES` (JSON-override), `AQUIER_URL_NL/US`.
No-op zonder `ANTHROPIC_API_KEY`. Vereist migratie 111 toegepast.

## Per pagina × persona × land
**7 kernvragen:** begrijp <5s wat Aquier doet · <10s relevant · wat krijg ik · wat kost het ·
vertrouw (1-10) · **waarom NIET kopen** (lijst) · welke info mis ik (lijst). Plus `would_buy`,
onbeantwoorde bezwaren, ontbrekende CTA's, conversie-scores (trust/authority/clarity/urgency/
proof/conversion) en taalvalidatie (NL professioneel/jargon-vrij · US gelokaliseerd, niet vertaald).

**Persona's:** ontwikkelaar · financier/bankier · makelaar · investeerder · bemiddelaar · family office
— elk met eigen kritische vragen (zie `commercial-validator.mjs` PERSONAS).

## Copy-QA-diagnose (NIET de go/no-go)
`hermes.v_commercial_gate` — per persona of de **copy** ze overtuigt (laatste run).
`commercial_validation_runs.gate_open` vat samen of de copy élke vereiste persona overtuigt.
Dit is een **kwaliteitsdrempel voor de copy**, geen schaalbeslissing.

## Primaire conversie-/scale-gate = Buyer-Intent (echt gedrag)
```bash
SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… node scripts/buyer-intent-gate.mjs
```
Leest `vastgoed_core.v_buyer_intent` (eerstpartij intent-events via `aquier /api/track`): tier-verdeling
(Cold/Warm/Hot/Sales-Ready) + 7d-trend. **Verdict:** `OPEN — SCALE` (genoeg Sales-Ready + Hot+ aandeel +
niet-dalende trend) · `WAIT — OPTIMIZE` (te weinig gedrag) · `INSUFFICIENT DATA` (< drempel bezoekers →
blijf optimaliseren + verkeer sturen, gebruik Would_Buy als copy-diagnose). Drempels via env
`BI_MIN_VISITORS` (50) / `BI_MIN_SALES_READY` (5) / `BI_MIN_HOTPLUS_PCT` (10). AVG: anonieme visitor_id's,
geen PII. **Marketing schaalt op zodra deze gate `OPEN — SCALE` is**, niet op basis van Would_Buy.

## Output → actie
`commercial_validation.why_not_buy` + `missing_info` + `unanswered_objections` + `missing_cta` =
de exacte conversie-blockers. Deze worden dispatch-taken voor CLI-R (pagina/CTA/copy/social-proof/
taal) + de Marketing Agent (conversie-optimalisatie, koopintentie i.p.v. SEO). Itereer tot would_buy.

## Social proof / taal (vervolg)
Footer "Trusted by … across [landen]" alleen voor landen waar Aquier echt actief is/lanceert —
Hermes controleert geloofwaardigheid + juridische juistheid (geen misleidende claims). NL ≠ US:
lokaliseren, niet vertalen.
