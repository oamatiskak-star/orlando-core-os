# Build Tracker V2 — Roadmap OS Transformation (ONTWERP — niet bouwen)

> **Doel:** Build Tracker War Room transformeren van **graph-first** naar **roadmap-first** —
> en uiteindelijk naar een **CEO Operating System**. De Entity Graph blijft als ondersteunende
> "Knowledge Graph"-tab; de roadmap wordt leidend. Dit document = ontwerp (8 deliverables + CEO-OS-aanvulling).
> Geen implementatie in deze stap.

---

## NORTH STAR (leidend voor F1 t/m F6 — vervangt de PM-framing)

De Build Tracker mag **geen project-management-tool** worden. Het wordt een **CEO Operating System**.
Succes wordt **niet** gemeten in zichtbare projecten/milestones/Gantt-balken, maar in **bespaarde
managementtijd**.

**Primaire KPI — `CEO Minutes Per Day` < 20 min.** Als de gebruiker nog Render, YouTube Studio, logs,
GitHub of losse dashboards moet openen om de toestand te begrijpen, is de Roadmap **niet af**.

### GOVERNING RULE — Roadmap Success Criterion (de toetssteen voor élke fase)
De Roadmap is pas succesvol als deze **binnen 30 seconden, zonder een graaf te lezen en zonder een externe
tool te openen**, antwoord geeft op:
1. Werkt de Media Factory?
2. Werkt Aquier?
3. Wat verdient geld?
4. Wat blokkeert omzet?
5. Wat moet vandaag gebeuren?
6. Wat staat deze week gepland?
7. Wat is de volgende milestone?
8. Welke systemen vragen menselijke aandacht?
9. Welke systemen zijn volledig autonoom?
10. Waar zit momenteel de bottleneck?

Eindtoetssteen: *"Hoe ver zijn we van de volgende omzetmijlpaal en wat moet vandaag gebeuren om daar te
komen?"* — en voor de fabriek: *"Kan ik 7 dagen niets doen terwijl de fabriek blijft groeien, publiceren,
leren en optimaliseren?"*

### Gevolg: de Roadmap toont 3 lagen, niet 1
- **STRATEGIE** (projecten/milestones/roadmap) — het oorspronkelijke ontwerp hieronder.
- **OPERATIE** (operationele gezondheid: werkt het, uploads, winners, incidenten, bottleneck) — NIEUW.
- **AUTONOMIE** (wat draait zelf · wat vraagt mens · CEO-minuten · certificering) — NIEUW.

### Beslispunten A/B/C — BESLIST door Orlando (waren open, nu leidend voor F1)
- **A — Prioriteit:** **expliciete** `build_tracker.priority` (P0/P1/P2/P3) toevoegen. Backfill mag; het systeem
  mag voorstellen doen (`suggested_priority` + `source_reason`), maar de **mens beslist** de definitieve waarde.
  Niet puur algoritmisch afleiden.
- **B — Milestone-deadlines:** **echte** `target_date` toevoegen aan `holding_milestones` (commitments, bv.
  "Q3 Launch", "Membership Live", "Media Factory Certification"). Niet afleiden, niet ETA-only.
- **C — Gantt-datums:** **geen "undated lane".** `build_tracker.started_at/target_at` backfillen waar nodig;
  een roadmap zonder datums verliest zijn waarde. Onbekende datums = te vullen werk, geen geaccepteerde
  eindtoestand.

---

## 0. Data-grounding (live shaonum, 2026-06-11) — bepaalt haalbaarheid per sectie

| Bron | Stand | Gevolg voor ontwerp |
|---|---|---|
| `build_tracker` | 72 projecten · 11/72 met start+eind · **0 priority-kolom** · 1/72 omzet | Gantt + P0-P3 + revenue NIET direct uit build_tracker → normaliseren + additieve velden |
| `aquier_projects` | 43 modules · 42 start / 40 due · priority critical16/high20/medium7 | **Gantt- + prioriteit-klaar** → ankerbron voor de roadmap-demo |
| `planning_items` | bestaat (project_id, company_id, type, status, priority, titel, start_date, due_date, toegewezen, completed_at) | **Bron voor "Agenda Vandaag"** |
| `holding_milestones` | 24 · géén datum-kolom | "Komende Milestones" toont volgorde/status/progress; deadline = datagap (afleiden of veld toevoegen) |
| `hermes.businessplan_phases` | bestaat niet op prod | Fase-anker A/B/C niet beschikbaar → priority-lanes i.p.v. businessplan-fases |
| `v_build_*` views | nodes/edges/timeline/blockers/risks/revenue/entity_completion live | Hergebruiken; roadmap-views erbovenop |

**Operationele gezondheid (bestaat al — synthese-gap, geen datagap):**
| Domein | Bron (live) | Levert antwoord op |
|---|---|---|
| Upload-gezondheid | `youtube_upload_queue` (queued 1081 · planned 1327 · verified_live 877 · **manual_review_required 85** · unrecoverable 249 · failed 31) | "Wordt vandaag geüpload? Wat vraagt aandacht?" |
| Kanaalgroei / winners | `youtube_channel_health`, `winner_*`/`production_scores` | "Groeien kanalen? Nieuwe winners?" |
| Incident-keten | `infra_watchdog_incidents`→`hermes.repair_suggestions`→`hermes.autopilot_decisions`→`hermes.validation_runs`→`hermes.escalations` | detect→diagnose→heal→validate→escaleer |
| Autonomie | `hermes.autopilot_state`, `hermes.v_autopilot_recent`, `director_cycles`, `hermes.learning_events` | "Wat draait zelf? Verbetert strategie zich?" |
| Systeemstatus | `v_system_health`, `hermes.system_health`, `hermes.v_control_center`, `hermes.v_queue_health`, `hermes.v_failure_intelligence`, `v_ctl_oauth_health` | "Werkt het? Root cause? Impact?" |
| Alerts/escalatie | `executive_alerts`, `hermes_alerts`, `cfo_risk_alerts`, `hermes.escalations` | "Welke systemen vragen mens?" |

**Kernconclusie 1 (strategie):** de roadmap-laag vereist een **normalisatie-view** die `build_tracker` + `aquier_projects` samenvoegt tot één projectmodel met genormaliseerde status/priority/datums.

**Kernconclusie 2 (operatie):** de operationele keten is technisch aanwezig maar **niet gesynthetiseerd tot één antwoord per systeem** ("echt probleem? · auto-opgelost? · root cause? · impact? · mens nodig?"). De CEO-OS-laag = een **synthese-view per systeem** bovenop bestaande health-bronnen, niet nieuwe instrumentatie.

---

## 1. UX-AUDIT — huidige War Room

**Wat werkt (technisch correct):**
- Entity-scoping per werkmaatschappij (#173), correcte item/PR-attributie (#174), masterplan zichtbaar (#175), default-view vandaag (#176).
- 8 datalagen kloppen (nodes/edges/timeline/blockers/risks/revenue/completion/consolidation).

**Wat ontbreekt (UX — niet op Orlando Core OS-niveau):**
1. **Graph-first landing** — opent met een node-graaf; vergt interpretatie i.p.v. overzicht. Strategie/voortgang niet in één oogopslag.
2. **Geen "waar staan we"-anker** — completion zit verstopt in een strip boven de graaf; geen executive-overzicht.
3. **Geen tijd-as** — de dagre-graaf toont hiërarchie, geen planning/Gantt. "Wat komt hierna / wat is vandaag" onleesbaar.
4. **Prioriteit onzichtbaar** — geen P0-P3 focusbeeld.
5. **Geen dagsturing** — geen agenda/vandaag-laag.
6. **Milestones als losse nodes** — geen roadmap-volgorde met status.
7. **Blockers/risks/revenue** bestaan als tabs maar niet als executive-signaal op de landing.
8. **Activiteit** zit in een timeline-tab, niet als live feed op de hoofdpagina.

**Diagnose:** de informatie ís er (datalaag compleet), maar de **informatie-architectuur is graph-centrisch**. De fix is een nieuwe roadmap-gedreven landing die dezelfde data anders presenteert — niet nieuwe data.

---

## 2. NIEUWE INFORMATIE-ARCHITECTUUR

### Routestructuur
```
/dashboard/build-tracker/war-room            → Roadmap Command Center  (NIEUWE default)
/dashboard/build-tracker/war-room/timeline    → Timeline (bestaand)
/dashboard/build-tracker/war-room/dependencies→ Dependencies (bestaand, vereenvoudigd overzicht)
/dashboard/build-tracker/war-room/milestones  → Milestones (bestaand)
/dashboard/build-tracker/war-room/revenue      → Revenue (bestaand, + voorbereide laag)
/dashboard/build-tracker/war-room/blockers     → Blockers & Risks (bestaand)
/dashboard/build-tracker/war-room/graph        → Knowledge Graph  (= huidige Entity Graph, VERPLAATST)
/dashboard/build-tracker/war-room/consolidation→ Consolidation (bestaand)
```

### Tab-volgorde (Roadmap default, Knowledge Graph achteraan)
`Roadmap · Timeline · Dependencies · Milestones · Revenue · Blockers & Risks · Knowledge Graph · Consolidation`

### Hiërarchie die visueel zichtbaar wordt
`Holding → Entiteit → Programma → Project → Milestone → Build Item → PR → Resultaat → Omzet`
- Holding/Entiteit = executive-status + entiteit-selector (bestaand, #173).
- Programma/Project = Roadmap timeline-lanes.
- Milestone = Komende Milestones-kaart + markers op de timeline.
- Build Item/PR = Open Build Items + Activiteit-feed.
- Resultaat/Omzet = Revenue-kaart (voorbereid).

---

## 2A. OPERATIONELE GEZONDHEID & AUTONOMIE-LAAG (NIEUW — CEO-OS-kern)

Bovenop de strategielaag komt een **System Health Board**: per kernsysteem één rij met een gesynthetiseerd
oordeel — zodat geen externe tool meer geopend hoeft te worden.

**Kernsystemen (rijen):** Media Factory · Aquier · Hermes · Content Factory (CF2) · Scrapers/Acquisitie · Mail · Uploads-pipeline.

**Per systeem 6 gesynthetiseerde velden (NIEUWE view `v_ceo_system_health`):**
| Veld | Betekenis | Afgeleid uit |
|---|---|---|
| `status` | werkt / gedegradeerd / down | `v_system_health` + `infra_watchdog_check_status` |
| `autonomy` | autonoom / semi / handmatig | `hermes.autopilot_state` + `build_autonomy_score` (indien aanwezig) |
| `needs_human` | ja/nee + reden | open `hermes.escalations` + `manual_review_required`-count |
| `incident` | open/auto-resolved + root_cause + impact | `infra_watchdog_incidents` ⨝ `hermes.repair_suggestions`/`validation_runs` |
| `last_activity` | laatste echte actie | `hermes.logs` / `youtube_upload_queue` / `cron`-equiv |
| `bottleneck` | grootste knelpunt nu | hoogste `manual_review_required` / oudste open incident / stilste engine |

**Incident-lifecycle (gesloten keten, zichtbaar per incident):**
`detect (watchdog_incidents) → diagnose (repair_suggestions: root_cause+impact) → heal (autopilot_decisions/recovery) → validate (validation_runs) → escalate (escalations, alleen echte uitzonderingen)`.
Elke kaart toont: *is dit een echt probleem? · is het automatisch opgelost? · root cause · impact · mens nodig?*

**CEO Minutes/Day (primaire KPI):** geschatte dagelijkse handmatige interventietijd = som van openstaande
`needs_human`-items × gemiddelde afhandeltijd, getrend. Doel < 20 min. Toont of de keten écht gesloten is.

---

## 2B. MEDIA FACTORY AUTONOMY CERTIFICATION (expliciete roadmap-milestone)

Een **harde milestone** met status `NOT_CERTIFIED` / `CERTIFIED`. De fabriek is **niet** gereed omdat er
video's gemaakt/geüpload worden of dashboards bestaan. Pas gereed bij een **gesloten, zelfherstellende lus**.

**De 10 certificeringscriteria (elk meetbaar uit data; CERTIFIED = alle 10 groen, ≥7 dagen aaneengesloten):**
| # | Criterium | Meetbron |
|---|---|---|
| 1 | 7 dagen geen menselijke actie nodig | `hermes.escalations` = 0 manueel-vereist over 7d |
| 2 | Uploads blijven doorgaan | `youtube_upload_queue.verified_live` groeit dagelijks |
| 3 | Kanalen blijven groeien | `youtube_channel_health` views/subs ↑ |
| 4 | Winners blijven gevonden | `production_scores`/winner-detector levert nieuwe winners |
| 5 | Strategie blijft verbeteren | `director_cycles` + `hermes.learning_events` actief |
| 6 | Incidenten auto-gedetecteerd | `infra_watchdog_incidents` vult zonder mens |
| 7 | Incidenten auto-gediagnosticeerd | `hermes.repair_suggestions` per incident |
| 8 | Incidenten auto-hersteld | `hermes.autopilot_decisions` resolve-acties |
| 9 | Herstel auto-gevalideerd | `hermes.validation_runs` pass na herstel |
| 10 | Alleen echte uitzonderingen escaleren | escalatie-ratio laag; geen ruis |

**+ KPI CEO Minutes/Day < 20** als 11e harde gate. Certification-status verschijnt op de landing én als
milestone-marker op de roadmap-timeline. Dit is de operationele eindtoetssteen ("7 dagen niets doen").

```
┌─ Build Tracker War Room ────────────────  [entiteit: Modiwe Software ▼] ─┐
│ Tabs: ▣Roadmap  Timeline  Dependencies  Milestones  Revenue  Blockers  Knowledge Graph  Consolidation │
├──────────────────────────────────────────────────────────────────────────┤
│ ① EXECUTIVE STATUS BAR              CEO Minutes/Day: 34 ▼ (doel <20)        │
│  ┌────────┬──────────┬───────────┬──────────┬─────────┬───────────────┐   │
│  │ 11%    │ Actief 14│ Items 24  │ Block. 9 │ PR's 16 │ Milestones ▲3 │   │
│  │ 2/19   │          │           │          │         │               │   │
│  └────────┴──────────┴───────────┴──────────┴─────────┴───────────────┘   │
├──────────────────────────────────────────────────────────────────────────┤
│ ⓪ SYSTEM HEALTH BOARD  (CEO-OS kern — 30s-antwoord, geen externe tool)     │
│  systeem        │status │autonoom│mens?        │incident       │bottleneck │
│  Media Factory  │ 🟡degr│ semi   │ ja: 85 review│auto-resolved ✓│85 manual  │
│  Aquier         │ 🟢ok  │ auto   │ nee          │—              │—          │
│  Hermes         │ 🟢ok  │ auto   │ nee          │—              │—          │
│  Scrapers       │ 🔴stil│ semi   │ ja: idle 6u  │open · diag→   │scrapers   │
│  Uploads        │ 🟡    │ semi   │ 85 review    │31 failed auto │unrecov 249│
│  ▶ Media Factory Certification: NOT CERTIFIED  (7/10 groen · CEO-min >20)   │
├──────────────────────────────────────────────────────────────────────────┤
│ ② ROADMAP TIMELINE  (hero)        [ Dag Week Maand ▣Kwartaal Jaar ]        │
│        Jun ─────── Jul ─────── Aug ─────── Sep ──────►                     │
│  P0 ▕ CF2.7 Scene Intent ███████░░  ◆mvp        │ Finance Val ████░     │   │
│  P1 ▕ Hermes Engine ██████████░  ◆      │ Content Factory ███████░       │   │
│  P2 ▕ Affiliate ███░     │ Reporting ██░         │ Analytics ░           │   │
│  P3 ▕ (geen datum) → status-lane: Gepland 5 · In uitvoering 2            │   │
├───────────────────────────────────┬──────────────────────────────────────┤
│ ③ PROJECTEN PER STATUS            │ ④ PRIORITEITSVERDELING                │
│  ✅ Afgerond        2             │  P0 ████ 16   P1 █████ 20             │
│  🔵 In uitvoering   7             │  P2 ██ 7      P3 ░ 0                  │
│  ⚪ Gepland         5             │  (focus ligt op P0/P1)                │
│  🔴 Geblokkeerd     0             │                                       │
├───────────────────────────────────┼──────────────────────────────────────┤
│ ⑤ AGENDA VANDAAG                  │ ⑥ KOMENDE MILESTONES                  │
│  • 09:00 Build review CF2.7  hoog │  ◆ CF2 Release      P0  in_progress   │
│  • 14:00 Audit revenue-keten      │  ◆ Hermes MVP       P1  planned       │
│  • Deploy #176 (gereed)           │  ◆ Dashboard V2     P2  planned       │
├───────────────────────────────────┴──────────────────────────────────────┤
│ ⑦ OPEN BUILD ITEMS                          ⑧ LAATSTE ACTIVITEIT          │
│  item · prio · status · ETA                  • PR #176 merged   2u        │
│  C3 Shadow-run  P0  open                      • Item C4 afgerond 4u        │
│  C8 Tracking    P1  open                      • #175 merged     5u        │
├──────────────────────────────────────────────────────────────────────────┤
│ ⑨ DEPENDENCIES (overzicht, geen volledige graaf)                          │
│  Hermes Engine → API Gateway → Content Factory      [bekijk volledig →]    │
└──────────────────────────────────────────────────────────────────────────┘
```
Alles binnen 30s leesbaar; geen graaf én geen externe tool nodig om de 10 CEO-vragen te beantwoorden.

---

## 4. COMPONENTSTRUCTUUR

```
frontend/app/dashboard/build-tracker/war-room/
  layout.tsx                      (tabs aanpassen: Roadmap eerst, Knowledge Graph)
  page.tsx                        → Roadmap Command Center (server: fetch alle secties)
  graph/page.tsx                  ← VERPLAATST huidige Entity-Graph page.tsx (Knowledge Graph)
  (timeline|dependencies|milestones|revenue|blockers|consolidation)/page.tsx  (ongewijzigd)

frontend/components/build-war-room/roadmap/
  ExecutiveStatusBar.tsx          (① — server data, statisch)
  RoadmapTimeline.tsx             (② — client; CSS-grid lanes per priority, bars op datum-range, milestone-markers, zoom)
  StatusColumns.tsx               (③)
  PriorityDistribution.tsx        (④)
  TodayAgenda.tsx                 (⑤ — client, realtime op planning_items)
  UpcomingMilestones.tsx          (⑥)
  OpenBuildItems.tsx              (⑦)
  ActivityFeed.tsx                (⑧ — client, realtime op build_tracker/items + timeline)
  DependencyOverview.tsx          (⑨ — compacte lijst, link naar Dependencies-tab)
  RevenuePrep.tsx                 (omzet-laag placeholder: kolommen omzet/kosten/cashflow/waarde, leeg-state)

frontend/components/build-war-room/roadmap/health/   (CEO-OS operationele laag — NIEUW)
  SystemHealthBoard.tsx           (⓪ — client/realtime; per systeem status/autonomy/needs_human/incident/bottleneck)
  CeoMinutesGauge.tsx             (KPI CEO Minutes/Day, getrend, doel <20)
  CertificationCard.tsx          (Media Factory Autonomy Certification: 10 criteria + status NOT_CERTIFIED/CERTIFIED)
  IncidentLifecycle.tsx           (per incident: detect→diagnose→heal→validate→escalate + root_cause/impact)
```
**Gantt-keuze:** geen zware lib. Custom **CSS-grid timeline** (kolommen = tijdsbuckets, rijen = priority-lanes, bars positioned via `grid-column`). Hergebruik `statusColor`/`NODE_ACCENT` uit `lib/build-war-room/graph.ts`. Undated projecten → aparte "Zonder datum"-strook gegroepeerd op status (geen valse balken).

---

## 5. DATAMAPPING (sectie → echte bron + gap)

| # | Sectie | Bron | Gap / actie |
|---|---|---|---|
| ⓪ | System Health Board | **NIEUW** `v_ceo_system_health` (synthese over `v_system_health`, `infra_watchdog_*`, `hermes.autopilot_state`, `hermes.escalations`, `youtube_upload_queue`, `hermes.repair_suggestions`/`validation_runs`) | synthese-view per systeem; data bestaat |
| ⓪ | CEO Minutes/Day | **NIEUW** `v_ceo_minutes_daily` (open needs_human × afhandeltijd, getrend) | afhandeltijd-norm vastleggen |
| ⓪ | Certification | **NIEUW** `v_media_factory_certification` (10 criteria-checks + 7d-window) | milestone-koppeling |
| ① | Executive Status Bar | `v_build_entity_completion` + node-counts uit `v_build_war_room_nodes` + `v_build_blockers` | geen |
| ② | Roadmap Timeline | **NIEUW** `v_build_roadmap_projects` (normaliseert `build_tracker`+`aquier_projects`) | build_tracker mist datums(61)/priority → undated-lane + Fase-1 velden |
| ③ | Projecten per status | `v_build_entity_completion` (done/in_progress/queued/blocked) | geen |
| ④ | Prioriteitsverdeling | `aquier_projects.priority` + (nieuw) `build_tracker.priority` | build_tracker priority toevoegen (additief, nullable) of afleiden |
| ⑤ | Agenda Vandaag | `planning_items` waar today ∈ [start_date,due_date] of due_date=today, scoped op company_id | view `v_build_today_agenda` |
| ⑥ | Komende Milestones | `holding_milestones` (naam/status/progress/milestone_nr) | geen datum → ETA afleiden uit gekoppelde project-target_at of veld toevoegen (Fase-1 beslissing) |
| ⑦ | Open Build Items | `v_build_war_room_nodes` node_type=build_item (status/section/blocker_code/owner) | ETA-veld ontbreekt op items → tonen zonder ETA of afleiden |
| ⑧ | Laatste Activiteit | **NIEUW** `v_build_activity_feed` = `v_build_timeline` ∪ `build_agent_delivery` ∪ PR-events | realtime channel hergebruiken |
| ⑨ | Dependencies overzicht | `build_project_dependencies` + `v_build_blockers` | deps-tabel vrijwel leeg → toont blocker-ketens + lege-state CTA |
| — | Revenue-prep | `v_build_revenue_map` + `build_tracker.expected_revenue_amount` | 1/72 gevuld → UI voorbereiden, niet vullen |

### Normalisatie-view (kern, Fase-1)
`v_build_roadmap_projects` (read-only, geen nieuwe rijen):
- bron A = `build_tracker` (entity via companies.slug, status, progress_pct, started_at→start, target_at→end, expected_revenue_amount, program_id, priority indien toegevoegd)
- bron B = `aquier_projects` (entity='modiwe-software', status genormaliseerd planned/in_progress/completed→queued/in_progress/done, progress_pct, start_at→start, due_at→end, priority critical/high/medium→P0/P1/P2)
- uniforme kolommen: `id, source('build_tracker'|'aquier'), entity_slug, program, name, status_norm, priority_norm(P0-P3|null), progress, start_at, end_at, revenue, blocker_count, dep_count, confidence/source_reason`
- **status-normalisatie** tabel: live/completed→done · building/testing/deploying/in_progress→in_progress · planned→queued · paused/failed→blocked.
- **priority-normalisatie:** aquier critical→P0, high→P1, medium→P2; build_tracker.priority direct; ontbrekend→null (undated/unprioritised-lane).

---

## 6. PAGINA-INDELING (grid)

- 12-koloms responsive grid, dark theme (#070b14 / #0e1525), consistent met bestaande tokens.
- Rij 1: ① Executive Status Bar (volle breedte, 6 KPI-tegels).
- Rij 2: ② Roadmap Timeline (volle breedte, hero, min-h 320px, eigen zoom-control).
- Rij 3: ③ Status (4 kol) | ④ Prioriteit (4 kol) | ⑥ Milestones (4 kol).
- Rij 4: ⑤ Agenda Vandaag (6 kol) | ⑧ Activiteit-feed (6 kol).
- Rij 5: ⑦ Open Build Items (8 kol) | ⑨ Dependencies-overzicht (4 kol).
- Rij 6: Revenue-prep (volle breedte, ingeklapt/placeholder).
- Entiteit-selector + tab-balk blijven sticky (hergebruik layout.tsx).

---

## 7. IMPLEMENTATIEPLAN (per PR, additief, reversibel)

| Fase | PR | Inhoud | Risico |
|---|---|---|---|
| **F0** | — | Dit ontwerp (done) | geen |
| **F1** | data-laag | NIEUWE views `v_build_roadmap_projects`, `v_build_today_agenda`, `v_build_activity_feed`. **BESLIST:** additief `build_tracker.priority` (P0-P3, nullable) + `build_tracker.suggested_priority`/`source_reason`; additief `holding_milestones.target_date`; **backfill** Gantt-datums (started_at/target_at) + milestone-deadlines (mens-bevestigd). Geen "undated lane". | laag (additief) |
| **F1b** | CEO-OS data-laag | NIEUWE synthese-views `v_ceo_system_health`, `v_ceo_minutes_daily`, `v_media_factory_certification` over bestaande health-bronnen. Geen nieuwe instrumentatie. | laag (read-only) |
| **F2** | command-center top | `page.tsx` Roadmap + ⓪ SystemHealthBoard + CeoMinutesGauge + CertificationCard + ① ExecutiveStatusBar + ③ Status + ④ Prioriteit, **als nieuwe tab** (nog niet default) | laag |
| **F3** | roadmap timeline | ② `RoadmapTimeline` (CSS-grid Gantt + milestone-markers op echte `target_date`; **geen undated-lane** — datums zijn in F1 gebackfilld) | midden (UI-complexiteit) |
| **F4** | dagsturing + incident | ⑤ Agenda Vandaag · ⑥ Milestones · ⑦ Open Items · ⑧ Activiteit (realtime) · ⑨ Dependencies-overzicht · `IncidentLifecycle` | laag/midden |
| **F4b** | certificering | Media Factory Autonomy Certification live (10 criteria + 7d-window) + CEO Minutes/Day-trend op landing | midden |
| **F5** | nav-swap | Roadmap = default; Entity Graph → `graph/` "Knowledge Graph"; layout-tabs herordenen; `RevenuePrep` placeholder | laag (alleen route/label) |
| **F6** | omzet-laag (later) | Revenue/kosten/cashflow/waarde + "afstand tot volgende omzetmijlpaal" koppelen zodra `expected_revenue_amount`/Moneybird gevuld | apart traject |

Elke fase = eigen branch + PR + prod-validatie, zelfde discipline als #173-#176. Views read-only, geen datamutatie, geen schema-breaking. Rollback per fase = view/route terugdraaien.

---

## 8. GEFASEERDE MIGRATIESTRATEGIE (geen big-bang)

1. **Co-existentie:** Roadmap wordt eerst een **extra tab** (F2-F4) terwijl Entity Graph default blíjft → niets breekt, gebruiker test parallel.
2. **Cutover:** pas in **F5** wordt Roadmap default en Entity Graph → Knowledge Graph-tab. Eén kleine nav-commit, direct terugdraaibaar.
3. **Data-veiligheid:** alle nieuwe lagen = `create or replace view` (additief), géén migratie van bestaande data, géén wijziging aan `aquier_projects`/`build_tracker`-rijen. `build_tracker.priority` (indien gekozen) = nullable additieve kolom.
4. **Data-discipline (BESLIST):** prioriteit = expliciet (`priority` mens-bevestigd; `suggested_priority` = systeemvoorstel met `source_reason`); milestone-deadlines = echte `target_date`; Gantt-datums gebackfilld (geen undated-lane). Synthese-views (operatie) = read-only over bestaande health-bronnen.
5. **Acceptatie-gate per fase:** F2 "waar staan we / werkt het / wie vraagt aandacht"; F3 "wat komt hierna / kritiek / wanneer"; F4 "vandaag / milestones / activiteit / incidenten"; F4b "kan ik 7 dagen niets doen (certification)"; F5 = roadmap-first + CEO-OS live.

---

## ACCEPTATIE — Roadmap Success Criterion (≤30s, zonder graaf of externe tool)
| # | Vraag | Beantwoord door |
|---|---|---|
| 1 | Werkt de Media Factory? | ⓪ SystemHealthBoard (status) |
| 2 | Werkt Aquier? | ⓪ SystemHealthBoard (status) |
| 3 | Wat verdient geld? | Revenue-prep + ② revenue-markers (F6 echt) |
| 4 | Wat blokkeert omzet? | ⑨ blockers + ⓪ incident + ④ P0 |
| 5 | Wat moet vandaag gebeuren? | ⑤ Agenda Vandaag |
| 6 | Wat staat deze week gepland? | ② timeline (Week) + ⑤ |
| 7 | Wat is de volgende milestone? | ⑥ Komende Milestones (echte `target_date`) |
| 8 | Welke systemen vragen mens? | ⓪ `needs_human` + ⑧ escalaties |
| 9 | Welke systemen zijn autonoom? | ⓪ `autonomy` |
| 10 | Waar zit de bottleneck? | ⓪ `bottleneck` |
| + | Kan ik 7 dagen niets doen? | Certification-status + CEO Minutes/Day <20 |

## Beslispunten — BESLIST door Orlando (geen open vragen meer vóór F1)
- **A. Prioriteit:** expliciete `build_tracker.priority` (P0-P3), mens-bevestigd; systeem stelt voor via `suggested_priority`.
- **B. Milestones:** expliciete `holding_milestones.target_date` (echte commitments).
- **C. Gantt:** backfill datums; geen undated-lane.
- **Nieuw fundament:** CEO Operating System (CEO Minutes/Day <20) + 30s-toetssteen + Media Factory Autonomy Certification = leidend voor F1-F6.
