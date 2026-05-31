# Hermes Commercial Validation Engine (Prioriteit 0A)

**Niet "werkt het" — maar "wil iemand BETALEN".** Hermes beoordeelt elke pagina als een
**kritische koper per doelgroep** ("glas azijn in de mond"): zoekt redenen om NIET te kopen.
Dit is de go-live conversiegate.

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

## Go-live conversiegate
`hermes.v_commercial_gate` — per persona of ze "zouden kopen" (laatste run). **Marketing schaalt
pas op als élke vereiste persona `buys_somewhere=true`.** `commercial_validation_runs.gate_open`
vat dit samen.

## Output → actie
`commercial_validation.why_not_buy` + `missing_info` + `unanswered_objections` + `missing_cta` =
de exacte conversie-blockers. Deze worden dispatch-taken voor CLI-R (pagina/CTA/copy/social-proof/
taal) + de Marketing Agent (conversie-optimalisatie, koopintentie i.p.v. SEO). Itereer tot would_buy.

## Social proof / taal (vervolg)
Footer "Trusted by … across [landen]" alleen voor landen waar Aquier echt actief is/lanceert —
Hermes controleert geloofwaardigheid + juridische juistheid (geen misleidende claims). NL ≠ US:
lokaliseren, niet vertalen.
