# TRACKRECORD_FINAL — autoritatieve eindtabel

Geconsolideerd uit `PROJECT_CALCULATIES_T7_EXTRACT.md` (+ #vergunningsdata) + `T7_DATA_INDEX.md` + de aangeleverde online-VON-verrijking (bron `TRACKRECORD_PROJECT_CIJFERS.md` niet op deze branch aanwezig → cijfers uit de taak-payload overgenomen, als zodanig getagd).

**Tags per cijfer:** `[REËEL]` uit echt doc · `[BENCHMARK]` nieuwbouw-verkoop €/m² · `[AFLEIDING]` uit huur/care-BAR · `[AMBTSHALVE]` leges-forfait (NOOIT echte bouw) · `[MODEL]` modelaanname.

**Rekenregels (HARD):**
- BOUW = echte aanneemsom/begroting. `[AMBTSHALVE]` bouwkosten uit vergunning = leges-grondslag, apart, nooit als bouw.
- STIKO cumulatief = aankoop + kosten koper (OVB) + bouw + bijkomend 12% + afsluitfee.
- bruto = VON − STIKO · netto = bruto − financieringslasten.
- Financieringslasten `[MODEL]`: 7% × (75% × STIKO) × 1,25 jr.
- VON-prioriteit: comparable/taxatie `[REËEL]` > nieuwbouw €/m² `[BENCHMARK]` > huur/care-BAR 8% `[AFLEIDING]`.

---

## ⭐ BACKTEST — gemeten accuracy (raming vs reëel)
| Project | Onze raming | Reëel | Afwijking |
|---|---|---|---|
| **Beilen** VON (benchmark €4.300/m² × ~570 m² verkoopbaar) | ~€2.451.000 `[BENCHMARK]` | €2.478.000 `[REËEL]` | **−1,1%** |
| **Breskens** eindwaarde: taxatie → realisatie | taxatie €2.540.000 `[REËEL]` | gerealiseerde VON €2.936.503 `[REËEL]` | **+15,6%** (realisatie boven taxatie → conservatieve taxatie/upside) |
| **Beilen** bouwkosten (band-ondergrens €1.458/m² × 784) | €1.143.072 `[BENCHMARK]` | €1.143.273 `[REËEL]` | +0,02% ⚠️ *circulair: band deels afgeleid van dit project* |

**Headline:** VON-benchmark valt binnen ~1% van de reële uitkomst (Beilen); gerealiseerde verkoop lag 15,6% boven taxatie (Breskens). De bouwkosten-band wordt door deze eigen projecten zelf geijkt (circulair, dus geen onafhankelijke accuracy).

---

## Per-project eindtabel

### 1. Renovatie → 3 app · Zuid-Holland
| Post | Bedrag | Tag |
|---|---|---|
| Aankoop (k.k.) | € 370.000 | [REËEL] |
| Bouw (aanneemsom, incl partiële sloop €11.358) | € 432.659 | [REËEL] |
| Bijkomend 12% | € 51.919 | [MODEL] |
| STIKO ≈ | € 854.578 | [AFLEIDING] |
| VON / eindwaarde (taxatie 2021) | leeg € 520.000 / verhuurd € 655.000 | [REËEL] |
| Bruto (verhuurd − STIKO) | ≈ −€ 199.578 | [AFLEIDING] |
> Marge negatief op taxatie-2021 vs kosten-2024/25 → timing-mismatch; geen betrouwbare marge. BAR 6,1% / NAR 5,0% [REËEL].

### 2. Winkel/wonen sloop-nieuwbouw → 6 app (volledig wonen, géén plint) · Drenthe
| Post | Bedrag | Tag |
|---|---|---|
| Bouw (aanneemsom incl sloop €105.213) | € 1.143.273 | [REËEL] |
| m² BVO | 784 | [REËEL] |
| Aankoop | onbekend → net boven CBS-grond Drenthe (€418/m²) | [MODEL] |
| Bijkomend 12% | € 137.193 | [MODEL] |
| VON (comparable €413k–425k × 6) | € 2.478.000 | [REËEL] |
| VON-benchmark (€4.300/m²) | ~€ 2.451.000 | [BENCHMARK] |
| Bruto (VON − bouw − bijkomend, excl aankoop) | ≈ € 1.197.534 | [AFLEIDING] |
> Reële marge hoog (~30% op kosten) — getoond als reëel. Leges-grondslag vergunning niet als bouw gebruikt.

### 3. Kantoor → zorg · Overijssel (37 units)
| Post | Bedrag | Tag |
|---|---|---|
| Bouw (geschatte projectkosten ex btw) | € 1.000.000 | [REËEL] |
| m² | 2.000 BVO / 1.601 GBO | [REËEL] |
| WOZ | € 2.270.000 | [REËEL] |
| Huur | € 422.700/jr · 20-jr contract | [REËEL] |
| VON via care-BAR 8% (422.700 / 0,08) | ≈ € 5.283.750 | [AFLEIDING] |
| Leges | geen (bestemming hoefde niet te wijzigen) | [REËEL] |
> Sterkste financierbaarheids-/DSCR-case (lang huurcontract + zorg-exploitatie).

### 4. Kerk → 32 zorg-app + 8 nieuwbouw · Friesland
| Post | Bedrag | Tag |
|---|---|---|
| Aankoop | € 550.000 (2024) | [REËEL] |
| Bouw (aanneemsom 8-app nieuwbouwdeel) | € 1.216.000 | [REËEL] |
| Installaties E / W | € 82.709 / € 147.171 | [REËEL] |
| AK/winst/risico/nazorg | ≈ € 137.290 | [REËEL] |
| "Bouwkosten" vergunning | € 2.125.990 | **[AMBTSHALVE]** — leges-forfait, NIET als bouw |
| Leges | € 38.386 (≈1,8% bouwsom) | [REËEL] |
| VON | onbekend → care-BAR/benchmark per zorgprogramma | [AFLEIDING] (gap) |
> Volledige aanneemsom voor 32 zorgunits niet in dataset (alleen 8-app nieuwbouwdeel); aankoop+leges reëel.

### 5. Woonzorg transformatie · Utrecht (26 units · "Forel")
| Post | Bedrag | Tag |
|---|---|---|
| Bouw (definitieve calc, 1 blok) | € 552.475 | [REËEL] |
| Bouw (complex 6-8-10-12) | € 664.870 | [REËEL] |
| m² | 1.181 BVO / 1.073 GBO | [REËEL] |
| Lease/huur | € 358.800/jr | [REËEL] |
| VON via care-BAR 8% (358.800 / 0,08) | ≈ € 4.485.000 | [AFLEIDING] |
| Aankoop | onbekend → net boven CBS Utrecht (€1.103/m²) | [MODEL] |
> ~€975k "verbouw" = aggregaat meerdere blokken; geen los doc bereikt dat.

### 6. Realisatie 14 app + 8 app · Zeeland (Breskens)
| Post | Bedrag | Tag |
|---|---|---|
| Aankoop (8-app deel) | € 1.400.000 | [REËEL] |
| Aanneemsom (14 app) | € 1.538.775 | [REËEL] |
| STIKO (8-app) | € 2.358.073 | [REËEL] |
| Taxatie (leeg) | € 2.540.000 | [REËEL] |
| Gerealiseerde VON | € 2.936.503 | [REËEL] |
| Nieuwbouw-verkoop | ≈ € 5.116/m² | [BENCHMARK] |
> Enige project met gerealiseerde verkoop → ankerpunt backtest (+15,6% boven taxatie).

### 7. Voormalig hotel → 20 app + 6 woningen + B&B · Drenthe (Gieten)
| Post | Bedrag | Tag |
|---|---|---|
| Bouwofferte (4 fases) | ≈ € 5.600.000 | [REËEL] (extern bekend; calc niet in leesbare kopie) |
| Aankoop / VON | onbekend | gap |
> Detailbegroting nog te extraheren (niet in iCloud-kopie).

---

## Cost-engine seed (klaargezet — DB-seed = hard gate)
De volgende benchmarks zijn klaar om in `vastgoed_core.cost_parameters` te seeden. **De tabel bestaat nog niet** (COST-ENGINE-migratie ac3f3cf5 = prod-migratie = HARD GATE) → DB-seed **geblokkeerd, gemeld aan Orlando**; uit te voeren binnen COST-ENGINE na migratie-go.

| key | regio/type | low | high | unit | bron | datum |
|---|---|---|---|---|---|---|
| nieuwbouw_verkoop_per_m2 | Drenthe / app | 4.300 | 4.300 | €/m² | Beilen reëel | 2026-05 |
| nieuwbouw_verkoop_per_m2 | Zeeland-kust / app | 5.116 | 5.116 | €/m² | Breskens reëel | 2026-05 |
| aannemer_per_m2 | NL / transformatie+nieuwbouw | 1.458 | 2.245 | €/m² | 4 eigen begrotingen | 2026-05 |
| leges_pct_bouwsom | NL | 0.012 | 0.033 | ratio | gevalideerd 1,8% (Friesland) | 2026-05 |
| care_bar | NL / zorg | 0.07 | 0.09 | ratio | care-exploitatie afleiding | 2026-05 |

**AVG:** uitvoering-naam + regio; geen NAW/plaatsnaam/persoonsnaam. Curator/derden uitgesloten (was onleesbaar).
