# Orlando Core OS — Multi-Channel Monetisatie & A/B-Strategie
**Vertrouwelijk · Media · 12 Kanalen naar Betaald**

Status: **LIVE** | Datum: 23 mei 2026 | Gegevens: Supabase (productie)

---

## Executive: De Kernstrategie

**Doel:** Alle 12 kanalen naar volledige monetisatie via gecontroleerde A/B-tests per cluster.

**Aanpak:** 
- Groepeer kanalen in 3 clusters met gelijke fundamentals
- Per cluster: isoleer 1 testvariabele, hou rest constant
- Draaien tegelijk, meet parallel → kenniswinsten rollen uit
- Gefaseerde opschaling om YouTube-risico (inauthentic content) te vermijden

---

## 1. Uitgangssituatie — De 12 Kanalen (Live Data)

| Kanaal | Subs | Views | Video's | Views/vid | Cluster | Status |
|--------|------|-------|---------|-----------|---------|--------|
| **LoopForge AI** | 3 | 7.434 | 19 | 391 | Shorts (US) | ✅ Winner |
| **BrickPulse Lab** | 1 | 4.056 | 21 | 193 | Shorts (US) | 📊 Testen |
| **SliceTheory** | 0 | 18 | 19 | 1 | Shorts (US) | 🔴 Diagnose |
| **VermogenTv** | 4 | 736 | 89 | 8 | NL long-form | 📊 CTR-test |
| **VastgoedTv** | 0 | 668 | 65 | 10 | NL long-form | 📊 CTR-test |
| **PropertyInvestorTv** | 0 | 509 | 62 | 8 | NL long-form | 📊 CTR-test |
| **CryptoVermogen** | 0 | 374 | 63 | 6 | NL long-form | 📊 CTR-test |
| **BeleggingsTv** | 1 | 276 | 65 | 4 | NL long-form | 📊 CTR-test |
| **SpaarTv** | 0 | 256 | 1 | 256 | NL long-form | ✅ Clean slate |
| **AquierTvEs** | 0 | 186 | 2 | 93 | Aquier (ES) | 🧪 Controle |
| **AquierTv** | 0 | 0 | 0 | — | Aquier (NL) | 🧪 Leeg |
| **[Intern staging]** | — | — | — | — | — | 🔧 Pijplijn |

### De Goudader Die Er Al Ligt

**LoopForge vs SliceTheory:** Identieke setup (zelfde dag aangemaakt, zelfde categorie, zelfde upload-target), maar **391 views/vid vs 1 view/vid** — een verschil van honderden keren. Dit is je schoonste A/B-test.

---

## 2. Monetisatiedoel per Kanaal

### Einddrempel

| Cluster | Drempel | Timeframe |
|---------|---------|-----------|
| **Shorts** | 1.000 subs + 10M Shorts-views | 90 dagen |
| **NL long-form** | 1.000 subs + 4.000 kijkuren | 12 maanden |
| **Aquier** | 1.000 subs + 4.000 kijkuren | 12 maanden |
| **Vroege instap (alle)** | 500 subs + 3 publieke vid's + 3.000 kijkuren (of 3M Shorts) | 90 dagen |

### What "Betaald Kanaal" Betekent

- **Drempel halen** ≠ €6.000/maand per kanaal
- Shorts-RPM is laag; waarde zit in format-proof + subscriber-funnel
- **NL/Aquier:** Finance/real estate = hoog RPM-potentieel, mits gevonden

---

## 3. Cluster A — Shorts (US): Hook-Test

### LoopForge AI — Winnaar, Exploiteren

**Sterkte:** 391 views/video = 111k/dag op 20 uploads — basis voor 10M/90d

**Test-Variabele A: "Impossible Reveal"**
- Toon in 1 sec het onmogelijke eindresultaat
- Bouw daarna pas op
- Hypothese: vooraf payoff ↑ retention

**Acties:**
- ✅ Behoud format
- ✅ Voeg subtiele, visuele subscribe-CTA toe op hoogtepunt (niet eind)
- ✅ Doel 30d: 3 → 150+ subs (conversie fixen op bestaand verkeer)

---

### BrickPulse Lab — Tweede Signaal, Opschalen

**Sterkte:** 193 views/video, sterk cinematic macro + industrieel geluid

**Test-Variabele B: "Process Tension"**
- Start midden mechanisch proces, spanning/geluid
- Reveal aan eind
- Hypothese: payoff-achteraf wint vs payoff-vooraf?

**Acties:**
- ✅ Hou cinematic + audio constant
- ✅ Varieer alleen hook (A vs B)
- ✅ Direct meten: A-B winnaar bepaalt strategie voor SliceTheory

---

### SliceTheory — Diagnose Vóór Opschalen

**Probleem:** 1 view/video bij identieke setup als LoopForge

**Niet opschalen — eerst repareren.**

**Mogelijke oorzaken:**
- Distributie-bug (Shorts niet als Short herkend?)
- Audio-rechtenproblemen op ASMR
- Thumbnail/metadata
- Channel-algomerk

**Actie:**
1. Handmatig 3-5 video's LoopForge vs SliceTheory analyseren
2. Concreet verschil vinden
3. Pas daarna hook-stijl C toetsen

---

## 4. Cluster B — NL Long-Form: CTR-Test

Per kanaal 1 titel/thumbnail-formule testen, meting over 2-3 weken.

| Kanaal | Test-Formule | Hypothese | Target |
|--------|--------------|-----------|--------|
| **VermogenTv** | "€500/mnd passief" (getal + belofte) | Concrete bedragen ↑ CTR finance | 8 → 25 views/vid |
| **VastgoedTv** | "Wat makelaars verzwijgen" (info-gap) | Insider-framing wint vastgoed | 10 → 30 views/vid |
| **PropertyInvestorTv** | "Hoe X 10 panden kocht" (casus) | Verhaalvorm = retention | 8 → 25 views/vid |
| **CryptoVermogen** | "Voordat de halving…" (urgentie) | Timing-hooks scoren crypto | 6 → 20 views/vid |
| **BeleggingsTv** | "3 beleggersfouten" (waarschuwing) | Loss-aversion ↑ clicks | 4 → 15 views/vid |
| **SpaarTv** | "Sparen vs beleggen 2026" (vergelijking) | Clean test, slechts 1 video tot nu | Baseline bepalen |

**Meetperiode:** 2-3 weken. Winnende formule rolt uit naar heel cluster.

---

## 5. Cluster C — Aquier: Controlegroep

**AquierTv** (leeg) en **AquierTvEs** (2 vid's) = ideale controle.

- Pas vanaf dag 1 de winnende formules van A + B toe
- Kijk of "goed beginnen" sneller groei geeft dan de anderen
- **AquierTvEs:** Internationale test (Spaans) — schaalbaarheid buiten EN/NL?
- Beiden koppelen aan Aquier.com-platform = lead generation, niet puur ad-revenue

---

## 6. Opdracht aan Analytics & Project Manager Agent

### 6 Kern-Taken

1. **Daily Sync & Log**
   - Per kanaal: views, retention, CTR, swipe-away, subs/video, traffic source
   - In Supabase opslaan (tabel: `channel_daily_metrics`)

2. **Per-Cluster Test-Isolatie**
   - Wekelijks rapporteren welke variant wint (hook A/B/C; titel-formule)
   - Confidence-level en p-value noteren

3. **Auto-Uitrol Winnende Formules**
   - Zodra cluster-winnaar bekend: flag voor uitrol naar rest cluster
   - Voorkomen: blind verder publiceren op onderpresteerders

4. **Onderpresteerders Flaggen**
   - SliceTheory-achtige signalen (1 view/vid) vóór opschaling
   - Stuur diagnose-aanbeveling, blokkeer extra upload

5. **Monetisatie-Voortgang**
   - Per kanaal: hoeveel subs + views/uren tot drempel
   - Geprojecteerde datum drempel-haling

6. **Health-Bewaking**
   - Upload-tempo vs "inauthentic content"-risico
   - Wanneer fasering naar volgende golf moet schuiven

---

## 7. Gefaseerde Ramp-Up (Cruciaal)

**Waarom niet alles morgen vol gas:** 12 kanalen vol met AI-content, meteen na pijplijn-herstel = YouTube-rood flaggen (inauthentic, mass-produced). De-monetisatie-risico.

### Fasering

| Golf | Moment | Wat | Kanalen | Doel |
|------|--------|-----|---------|------|
| **1** | **Nu** | Pijplijn herstellen + tractie opschalen + hook-test starten | LoopForge, BrickPulse | LoopForge: 150+ subs / BrickPulse: hook-winnaar bepalen |
| **1b** | **Nu** | Diagnose, NIET opschalen | SliceTheory | Root cause vinden, fix definiëren |
| **2** | **+1-2 wk** | content_language fixen + CTR-test starten op bestaande voorraad | 6 NL long-form | Winnende CTR-formule bepalen |
| **3** | **+3-4 wk** | Winnende formules toepassen als controlegroep | AquierTv, AquierTvEs | Baseline groei vs geoptimaliseerde start |
| **Scaling** | **+2-3 mnd** | Proven formats vol gas (upload ↑) | Winners per cluster | Drempel nadert |

---

## 8. Tijdlijn naar Monetisatie

| Horizon | Mijlpaal | Target |
|---------|----------|--------|
| **2-4 weken** | Pijplijn hersteld; golf-1 publiceert; hook-test loopt. Eerste cluster-winnaars bekend (hook A vs B). Conversie-CTA's live op alle actieve kanalen. | LoopForge: 150+ subs; BrickPulse: hook-winnaar; SliceTheory: diagnose af |
| **1-3 maanden** | Sterkste Shorts-kanaal nadert 1.000 subs + 10M views/90d. NL-kanalen: winnende CTR-formule uitgerold, views/video stijgen. | Shorts-cluster: 1.000 subs; NL: CTR +50% |
| **3-6 maanden** | Meerdere kanalen door de drempel. Geleerde formules toegepast op Aquier-funnel. Focus verschuift naar hoger-betaalde long-form niches (echt RPM). | 2+ kanalen gemonetiseerd; Aquier: leads ↑ |

---

## 9. Directe Openstaande Acties (Prioriteit)

### Infrastructuur (Blokkeert alles)

- [ ] **Pijplijn herstellen** (Golf 1)
  - Workers op Mac Mini 1 & 2 opnieuw live
  - OAuth-fix aanbrengen
  - /tmp-bug diagnosticeren en fixen
  - **Eigenaar:** DevOps/Claude lokaal

### A/B-Setup

- [ ] **Hook-test formaliseren**
  - LoopForge (A) vs BrickPulse (B) testvariabelen lockdown
  - CTA-plaatsing gelijktrekken
  - **Eigenaar:** Marketing Agent

- [ ] **SliceTheory diagnose**
  - 3-5 video's handmatig analyseren tegen LoopForge
  - Root cause rapport
  - **Eigenaar:** Analytics Agent

### Data-Integriteit

- [ ] **content_language verificatie**
  - NL-kanalen checken: is taal juist ingesteld?
  - Waarschijnlijk naar 'nl' corrigeren
  - **Eigenaar:** Analytics Agent

### Agent-Uitbreidingen

- [ ] **Analytics Agent upgrade**
  - 6 taken uit hoofdstuk 6 implementeren
  - Daily sync naar `channel_daily_metrics`
  - Wekelijkse cluster-winnaars rapportage
  - **Eigenaar:** Claude (deze sessie)

- [ ] **Project Manager Agent**
  - Dagelijks standup met Analyst + Marketing
  - Gefaseerde roll-out orchestreren
  - Milestone-tracking
  - **Eigenaar:** Claude (deze sessie)

### Orchest-Voorbereiding

- [ ] **Vier herstel-tasks** klaarzetten in orchestrator_tasks
  - Golf 1 pijplijn: worker-reset
  - Golf 1 CTA-toepassing
  - Golf 2 taal-fix
  - Golf 3 controlegroep-start
  - **Eigenaar:** Claude (deze sessie)

---

## 10. Projectstructuur in Dashboard

```
Orlando Core OS / Media
├─ Project: 12-Channel Monetization (A/B)
│  ├─ Lead: Project Manager Agent
│  ├─ Clusters:
│  │  ├─ Cluster A: Shorts (US) — Hook Test
│  │  │  ├─ LoopForge AI (Winner)
│  │  │  ├─ BrickPulse Lab (Variant B)
│  │  │  └─ SliceTheory (Diagnose)
│  │  ├─ Cluster B: NL Long-Form — CTR Test
│  │  │  ├─ VermogenTv
│  │  │  ├─ VastgoedTv
│  │  │  ├─ PropertyInvestorTv
│  │  │  ├─ CryptoVermogen
│  │  │  ├─ BeleggingsTv
│  │  │  └─ SpaarTv
│  │  └─ Cluster C: Aquier — Controle
│  │     ├─ AquierTv (NL)
│  │     └─ AquierTvEs (ES)
│  ├─ Phases:
│  │  ├─ Golf 1: Pijplijn herstellen + Hook-test (nu)
│  │  ├─ Golf 2: CTR-test + taalfix (+1-2 wk)
│  │  ├─ Golf 3: Controlegroep (-3-4 wk)
│  │  └─ Scaling: Proven formats vol (+2-3 mnd)
│  └─ Reports:
│     ├─ Daily: KPI-sync (Analytics)
│     ├─ Weekly: Cluster-winners (Analytics)
│     ├─ Daily Standup: Project lead (Project Manager)
│     └─ Monthly: Monetization progress (Project Manager)
```

---

## 11. Rapportageflow

### Dagelijks (07:00 UTC)

**Project Manager Agent → Standup**
```
📊 Standup: Orlando 12-Channel Monetization

🏆 Highlights:
  • LoopForge: 156 subs (+3% in 24h)
  • BrickPulse Hook-B: 2.1k views/day (+8%)
  • VermogenTv CTR-test: 3.2% ↑ vs baseline 2.1%

⚠️  Alerts:
  • SliceTheory: Still 1 view/video — diagnose stalled, blocked from scaling
  • SpaarTv: 0 uploads in 48h — check channel

📈 Progress:
  • Shorts-cluster: 240 subs / 1.000 target (24%)
  • NL-cluster: CTR-formulas 40% complete
  • Aquier: Staging pijplijn check scheduled

→ Next: Hook-test results (Thu), CTR-winners (Fri)
```

### Wekelijks (Maandag 10:00 UTC)

**Analytics Agent → Cluster-Winners Report**
```
📊 Weekly: Cluster A/B Test Results

CLUSTER A (Shorts — Hook Test):
  Hook A (Impossible Reveal, LoopForge): 391 views/vid
  Hook B (Process Tension, BrickPulse): 193 views/vid
  → WINNER: Hook A (2x better retention)
  → ROLLOUT: Apply Hook A to SliceTheory after diagnosis

CLUSTER B (NL Long-Form — CTR Test):
  VermogenTv (Getal + belofte): 3.2% CTR ✅
  VastgoedTv (Info-gap): 2.8% CTR
  CryptoVermogen (Urgentie): 2.5% CTR
  → WINNER: VermogenTv getal-formula
  → ROLLOUT: Apply to PropertyInvestor, Beleggings, Spaar

CLUSTER C (Aquier — Controle):
  Baseline waiting on formule rollout...
```

### Maandelijks (1e van maand, 14:00 UTC)

**Project Manager Agent → Monetization Progress**
```
📈 Monthly: Orlando Monetization Tracker

SHORTS CLUSTER:
  LoopForge: 250 subs / 1.000 target (25%)
             Projected drempel: +60 dagen
  BrickPulse: 80 subs / 1.000 (8%)
              Projected drempel: +110 dagen
  SliceTheory: [Diagnostic fix applied] — restart tracking

NL LONG-FORM CLUSTER:
  VermogenTv: 25 subs / 1.000 (2.5%)
               Projected drempel: +390 dagen (needs acceleration)
  [Others tracking...]

AQUIER CLUSTER:
  Both: Baseline established, formulas rolling in week 2...

PHASE READINESS:
  ✅ Golf 1: Complete (pijplijn, hooks testing)
  📅 Golf 2: Start +1-2 weeks (CTR-test complete, formulas rolling)
  🔮 Golf 3: Ready for +3-4 weeks (staging pijplijn confirmed)
```

---

## 12. Kanttekening: Lokale Uitvoering

De pijplijn-herstel (workers, OAuth, /tmp-bug) draait op Mac Mini 1 & 2 en vereist lokale toegang. Dit document levert de exacte stappen; voering is lokaal (of je voert de Claude Code sessie lokaal uit).

Eenmaal workers live: alle overige taken (A/B-setup, monitoring, uitrol) zijn geautomatiseerd via agents.

---

**Project Status:** 🟡 READY FOR GOLF 1 | Pijplijn-herstel in progress
**Last Updated:** 23 mei 2026 · Claude Code
