# T7_DATA_INDEX

Geanonimiseerde catalogus van alle **Aquier-bruikbare** data in de leesbare T7-dataset (gehydrateerd via iCloud `Aquier datamachinelearning`). Per item: categorie · type/regio · kerncijfers · bron-bestandstype · **REUSE-flag** · confidence. Voedt track record + cost-engine + waarheidskosten.

**REUSE-legenda (harde derden-grens):**
- 🟢 **eigen** = Orlando's eigen project-/aannemersdata (STRKBOUW/BOUWPROFFS/STRKBEHEER/Modiwe) → bruikbaar, geanonimiseerd (type + regio, geen NAW/plaatsnaam/persoons-/klantnaam).
- 🔴 **derden** = curator/faillissement/klant-specifiek → **vertrouwelijk, niet repurposen**; hooguit generieke structuur, geen herleidbare cijfers/namen.

**AVG:** geen NAW/plaatsnaam/persoonsnaam/klantnaam in output. Bij twijfel eigen-vs-derden → als derden behandeld. Detailcijfers staan in `PROJECT_CALCULATIES_T7_EXTRACT.md` (projectfinancials + vergunningsdata).

---

## 1. Projectfinancials — track record  🟢 eigen
Bron: officiële calculaties/begrotingen (zie PROJECT_CALCULATIES_T7_EXTRACT.md). 4 projecten met harde bouwcijfers + 6 met vergunningsdata.

| Type (regio) | Units | Bouwkosten ex btw | Aankoop / eindwaarde | Conf. |
|---|---|---|---|---|
| Woonzorg transformatie (Utrecht) | 24 | € 552k/blok (complex €665k) | — | hoog |
| Kerk → zorgapp. (Friesland) | 8–32* | € 1.216.000 | aankoop ~€550k (extern) | hoog |
| Winkel/wonen sloop-nieuwbouw (Drenthe) | 6 | € 1.143.273 (incl sloop €105k) | — | hoog |
| Renovatie → app. (Zuid-Holland) | 3 | € 432.659 | aankoop €370k · taxatie €520k/655k | hoog |
| Kantoor → zorg (Overijssel) | 37 | € 1.000.000 | WOZ €2,27 mln | hoog |
| Studentenhuisvesting (Friesland) | 42 | bouwsom € 2.700.000 | — | hoog |

*8 = nieuwbouw-appartementdeel begroting; 32 = totaal zorgunits per vergunning.

## 2. Taxatiedata — validatie  🟢 eigen
| Type (regio) | Marktwaarde | Huur / rendement | Bron · conf. |
|---|---|---|---|
| Renovatie → app. (Zuid-Holland) | leeg €520k / verhuurd €655k | €40.200/jr · BAR 6,1% / NAR 5,0% | taxatierapport 2021 · midden |
| Kantoor → zorg (Overijssel) | WOZ €2,27 mln (2023) | huur €422.700/jr, 20-jr contract | WOZ + investeringsmemo · midden |

## 3. Kostenbenchmarks — waarheidskosten + cost-engine  🟢 eigen  (hoogste waarde)
- **Per-post aannemersprijzen** uit 4 echte begrotingen (STABU-achtige breakdown: ruwbouw/metsel/prefab/kozijnen/tegelwerk/installaties E+W/dak/hout/lift/sloop). Directe input voor de cost-engine. Conf. hoog. (Bedragen per post in PROJECT_CALCULATIES_T7_EXTRACT.md.)
- **Afgeleide bouwkosten/m² (reëel, eigen projecten):** Friesland kerk € 1.216.000 / 542 m² BVO ≈ **€ 2.245/m²**; Drenthe € 1.143.273 / 784 m² ≈ **€ 1.458/m²**; Zuid-Holland renovatie € 432.659 / 247 m² GBO ≈ **€ 1.752/m²**. → reële €/m²-band per strategie (transformatie/sloop-nieuwbouw/renovatie), kruisvalideert de COST-ENGINE-seed.
- **Materiaal-/elementenlijst** (STABU-gecodeerd: 51 riolering, 53 sanitair, 60 verwarming, 61 ventilatie) met hoeveelheden per wooneenheid + productspecs (o.a. tegel 600×600×20 mm). Bron: materialenlijst-PDF. Conf. hoog (specs/hoeveelheden), midden (eenheidsprijzen deels via stelposten).
- **Installatiekosten-split** (E vs W) uit kerk-begroting: E € 82.709 / W € 147.171. Conf. hoog.
- **Sloopkosten als begrotingsregel:** Drenthe € 105.213 / Zuid-Holland € 11.358. Conf. hoog/midden.

## 4. Financiering / exploitatie
- 🟢 **Zorg-exploitatie (Overijssel):** huur € 422.700/jr · 20-jr contract · bouw € 1,0 mln · WOZ € 2,27 mln → sterkste financierbaarheids-/DSCR-case. Conf. hoog/midden.
- 🟢 **Financieringsaannames** (bank-beoordeeld Stiko-model, reeds in CRED-DATA): rente 8,5–12%, LTV 75–92%, looptijd 9 mnd. Conf. hoog.
- 🟢 *(intern/gevoelig)* Eigen-bedrijf cashflow-prognose 2025/2026 + werkkapitaal-memo: aanwezig in de set. Dit is **interne eigen-bedrijfsdata**, geen markt-benchmark → categorie geïndexeerd, **specifieke cijfers NIET in output** (niet Aquier-productrelevant + gevoelig).

## 5. Markt / regio
- Grondprijs per provincie (CBS) + leges-band 1,2–3,3% bouwsom: al in COST-ENGINE-seed; **gevalideerd** door reële leges ≈ 1,8% bouwsom (Friesland kerk, € 38.386 op ~€ 2,1 mln).
- Regio-spreiding eigen track record: Utrecht · Friesland · Drenthe · Zuid-Holland · Overijssel · Limburg · Groningen → landelijke dekking aantoonbaar met echte projecten.
- Anterieure/kostenverhaal-overeenkomsten: vrijwel altijd zonder publiek bedrag → bron-afhankelijk flaggen, niet als vast bedrag modelleren.

---

## Derden / vertrouwelijk — NIET gebruiken  🔴
- **`T7 O.S.M. Amatiskak`-volume:** niet aanwezig/leesbaar in de gehydrateerde kopie (0 items). Per beleid behandeld als derden/curator → **uitgesloten**, geen cijfers. Bij latere hydratie: eerst eigen-vs-curator classificeren; **curator-/faillissementsdossiers van derden blijven volledig uitgesloten** (alleen generieke structuur, nooit herleidbare cijfers/namen).
- **Klant-/opdrachtgever-identiteiten** in eigen aannemersdossiers (o.a. een vastgoed-opdrachtgever bij twee projecten): **niet overgenomen**. Alleen Orlando's eigen aannemersprijzen/-structuur is gebruikt, geanonimiseerd. De cijfers blijven eigen contractor-data; de klantidentiteit is geschrapt.
- Geen curator-/faillissementsdata in de leesbare set aangetroffen.

## Verificatie
- ✅ Index met 5 categorieën + REUSE-flags.
- ✅ Derden/curator expliciet als vertrouwelijk geflagd; geen herleidbare derden-cijfers in bruikbare data.
- ✅ Geen NAW/plaatsnaam/persoons-/klantnaam in output; type + regio + geaggregeerde cijfers.
- ✅ Targeting toegepast: tekst-PDF/spreadsheet op naam/inhoud; >5MB media, tekeningen, renders en beeld-PDF's (pdftotext ~0 tekens) overgeslagen.
