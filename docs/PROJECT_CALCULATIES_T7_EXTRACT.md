# PROJECT_CALCULATIES_T7_EXTRACT

Geanonimiseerde extractie van **officiële projectcalculaties** (eigen projecten STRKBOUW/BOUWPROFFS) voor het cumulatieve Aquier-track record. Bron: T7-data, gehydrateerd via iCloud (`Aquier datamachinelearning`). Uitgelezen met `pdftotext -layout`.

**AVG / no-mock:**
- Alleen eigen projecten. Top-volume `T7 O.S.M. Amatiskak` + alle curator-/persoons-/VSO-bestanden volledig overgeslagen.
- Geen NAW in dit document: geen namen, adressen, straat, postcode, plaats, bedrijfsnaam, KVK, IBAN, telefoon, e-mail. Alleen **type + provincie + opaque ordernummer**.
- Uitsluitend cijfers die letterlijk in de documenten staan. Ontbrekend = `null` + confidence laag. Niets verzonnen.
- Bedragen in euro's, ex btw tenzij anders vermeld.

Bron: dispatch-taak `66aa7749` (T7-EXTRACT). Aanvullende eigen projecten in dezelfde dataset (Sliedrecht, Groningen 8 woningen, Enschede, Leeuwarden Polaris/Voorstreek, Tuinbouwdwarsstraat Groningen) staan klaar voor de T7 FULL SWEEP. Lokaal-bekend (CLI-L-stream, niet hier): Breskens (Zeeland).

---

## 1. Transformatie woonzorg — Utrecht  (ref O.2024-10-184)
| Veld | Waarde | Bron / confidence |
|---|---|---|
| Strategie | transformatie (verbouwing → wooneenheden/zorg) | hoog |
| Units | 24 (Capex; calc rekent met 26 stuks sanitair/binnendeuren) | midden |
| m² BVO / GBO / perceel | 1.181 / 1.073 / 1.220 | Capex-overzicht — hoog |
| Bouwkosten/aanneemsom ex btw | **€ 552.475** (1 blok) · volledig complex 6-8-10-12 = **€ 664.870** · variant aangepast = € 576.594 | definitieve calculatie — hoog |
| 10-jaars onderhouds-CapEx (los van verbouwing) | € 326.795 | Capex — hoog |
| Aankoop / VON / taxatie / rendement | null | niet in docs — laag |

Breakdown (ex btw, blok): tegelwerk €107.507, technische installaties €107.846, kozijnen €77.144, binneninrichting €56.749, stukadoor €45.391, ventilatie €34.581, schilderwerk €32.533, verwarming €24.863, plafonds/wanden €21.541, dekvloeren €10.654, hout €9.884, stut/sloop €6.648, overig (bouwplaats/natuursteen/timmer/riolering/elektra/CAR) ~€11.000.
> Scope-flag: de bekende ~€975k verbouw is een **aggregaat van meerdere blokken/fases**, geen enkel los document bereikt dat.

## 2. Kerk → appartementen/zorg transformatie — Friesland
| Veld | Waarde | Bron / confidence |
|---|---|---|
| Strategie | transformatie (kerk → nieuwbouw appartementen) | hoog |
| Units | 8 (nieuwbouw-appartementdeel) | aannemersbegroting — hoog |
| m² BVO | 541,53 | aannemersbegroting — hoog |
| Aanneemsom ex btw (peildatum 2022) | **€ 1.216.000** | aannemersbegroting — hoog |
| AK 7% / winst 2% / risico 3% / nazorg 0,4% (≈ onvoorzien/AK/W&R) | ≈ € 137.290 | aannemersbegroting — midden |
| Installaties E / W (nevenaannemer) | € 82.709 / € 147.171 (totaal € 229.880) | aannemersbegroting — hoog |
| Aankoop / VON / taxatie / BAR-NAR | null (extern bekend: aankoop ~€550k, 2024 — niet in deze docs) | laag |

Breakdown: directe kosten €857.414, ABK €137.503, netto stelpost €25.172, nadere uitwerking 2% €17.737, coördinatie installaties 5% €11.494. RCE-kostenbegroting = image-only (geen OCR).

## 3. Winkelpand sloop-nieuwbouw, commerciële plint + appartementen — Drenthe  (ref O.2025-01-217)
| Veld | Waarde | Bron / confidence |
|---|---|---|
| Strategie | sloop-nieuwbouw | hoog |
| Units | 6 appartementen + commerciële plint | open begroting + BENG/MPG — hoog |
| m² BVO | 784 | MPG-rapport — hoog |
| Aanneemsom ex btw (incl. sloop) | **€ 1.143.273** | open begroting/aanneemofferte — hoog |
| Sloopwerk (begrotingsregel) | € 105.213 | open begroting — midden |
| Aankoop / VON / taxatie / Stiko | null | niet in mappen — laag |

Breakdown: metselwerk €281.123, prefab beton €217.964, kozijnen €199.716, tegelwerk €94.876, elektra €75.243, dakbedekking €38.508, verwarming €37.237, hout €28.562, lift €20.000, heiwerk €16.692.

## 4. Transformatie/renovatie bestaand pand → appartementen — Zuid-Holland  (ref O.2025-01-202)
*(meest complete case: aankoop + bouw + taxatie)*
| Veld | Waarde | Bron / confidence |
|---|---|---|
| Strategie | transformatie/renovatie (gecorrigeerd: GEEN sloop-nieuwbouw) | technische omschrijving/splitsingsakte — hoog |
| Units | 3 appartementen (gecorrigeerd: niet 6) | splitsingsakte + VvE-begroting — hoog |
| m² GBO / perceel | 247 / 181 | taxatie + splitsingsakte — hoog |
| Aankoop (k.k.) | **€ 370.000** | concept koopovereenkomst — hoog |
| Aanneemsom ex btw (incl. partiële sloop € 11.358) | **€ 432.659** | aannemersofferte/open begroting — hoog |
| Marktwaarde leeg (na renovatie, peildatum 2021) | € 520.000 | taxatierapport — midden |
| Marktwaarde verhuurd (na renovatie, 2021) | € 655.000 | taxatierapport — midden |
| Markthuur / BAR / NAR | € 40.200/jr · 6,1% · 5,0% | taxatierapport — midden |
| Bruto marge | null | niet betrouwbaar af te leiden (taxatie 2021 vs kosten 2024–25, k.k./bijkomend niet uitgesplitst) — laag |

Breakdown: hout €103.417, tegelwerk €70.939, elektra €62.986, keuken €48.159, behang/vloer €26.604, verwarming €25.972, kozijnen €22.179, schilderwerk €20.961, sloop €11.358.

---

## Status & gaps
- ✅ Geëxtraheerd (echt, geanonimiseerd): 4 projecten (Utrecht woonzorg, Friesland kerk, Drenthe winkelpand, Zuid-Holland renovatie).
- ⏳ **Gieten Brink 9 (Drenthe, mixed-use voormalig hotel)** — niet in de iCloud-kopie aangetroffen; nog te leveren (staat alleen op T7/OneDrive). Bekend extern: bouwofferte ~€5,6 mln ex btw in 4 fases.
- Veelvoorkomende ontbrekende posten: aankoop, VON/eindwaarde en BAR/NAR ontbreken in de meeste aannemersdossiers (die bevatten de bouwkant). Voor volledige stichtingskostenopzet + rendement zijn de aankoop-/taxatiedocumenten per project nodig.

---

# Vergunningsdata (OMGEVINGSVERGUNNING DEEP-SCAN — taak 282e219f)

Gerichte extractie uit omgevingsvergunning-dossiers (alleen tekst-PDF's < 5MB; tekeningen/beeld-PDF's overgeslagen). Bevestigt/vult de gemodelleerde cijfers met **echte vergunningsdata**. Geanonimiseerd: type + regio, geen plaatsnaam/adres/NAW. Alle waarden REËEL uit het vergunningsdoc.

| # | Type (regio) | Units | m² | Exploitatie / leges / kostenverhaal | Bron-confidence |
|---|---|---|---|---|---|
| V1 | Transformatie kerk → zorgappartementen (Friesland) | **32** (24 kerk+pastorie + 8 solitair) | nieuwbouwdeel 288 BVO / 382 GBO; kerk 1.017→1.142 BVO | **Leges € 38.386** (bouwen €28.717 + welstand €3.256 + buitenplanse afwijking €6.806); ambtshalve bouwkosten **€ 2.125.990** (opgegeven €1.600.000 = enkel verbouwing kerk+pastorie) | hoog |
| V2 | Sloop-nieuwbouw → 6 appartementen (Drenthe) | **6** | 784 BVO; 90–100 m² netto/unit | Bestaande functie horeca/centrum → **volledig wonen** (géén commerciële plint — corrigeert de aanname). Anterieure + planschadeverhaal-overeenkomst gesloten (geen bedrag in stuk). Bouwkosten €1.143.273 (uit begroting) | hoog |
| V3 | Herontwikkeling → 4 luxe appartementen (Limburg) | **4** (2 levensloopbestendig) | perceel ~580; ~80 GBO/app | Bestemming Wonen via buitenplanse omgevingsplanactiviteit; volledig voor rekening/risico initiatiefnemer; anterieure overeenkomst aangekondigd (geen bedrag); leges separaat (geen bedrag) | hoog |
| V4 | Herbestemming kantoor → zorg (Overijssel) | **37** zorg-units (Wlz VV5/VV6, 24-uurszorg) | ~2.000 BVO / 1.601 GBO / 1.333 perceel; 35 m²/unit | **Bouwkosten € 1.000.000 ex btw**; WOZ **€ 2.270.000** (peildatum 2023); **huur € 422.700/jr**, 20-jr contract. Geen kostenverhaal (bestemming hoefde niet te wijzigen) | hoog/midden |
| V5 | Transformatie garage → woning (Groningen) | **1** | n.v.t. (klein) | Geen leges/exploitatie in besluit | hoog |
| V6 | Transformatie → 42 studentenwooneenheden (Friesland) | **42** (43 nrs − 1 techn. ruimte) | ~30 BVO / ~26 GBO per type | **Bouwsom € 2.700.000 ex btw**; parkeerovereenkomst aanwezig (bedrag in gescand stuk, niet leesbaar); leges separaat gefactureerd | hoog/midden |

**Observaties voor het model:**
- Leges schalen met bouwsom: V1 ≈ €38k leges op ~€2,1 mln ambtshalve bouwkosten (≈1,8%) — bevestigt de leges-band 1,2–3,3% bouwsom uit COST-ENGINE-seed.
- Kostenverhaal/anterieure bijdragen worden vrijwel altijd via overeenkomst geregeld; bedragen staan zelden in het publieke vergunningsdoc (→ flag "bron-afhankelijk", niet modelleren als vast bedrag).
- Zorg-transformatie levert de hardste exploitatiecijfers (V4: huur/jr + WOZ + bouwkosten + 20-jr contract) — sterkste case voor financierbaarheid/DSCR-onderbouwing.
- AVG: alle 6 outputs region-only geverifieerd; geen NAW/plaatsnaam/adres. Beeld-PDF's en >5MB overgeslagen per targeting-regel.
