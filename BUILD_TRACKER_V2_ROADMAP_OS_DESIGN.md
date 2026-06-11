# Build Tracker V2 — Roadmap OS Transformation (ONTWERP — niet bouwen)

> **Doel:** Build Tracker War Room transformeren van **graph-first** naar **roadmap-first**.
> De Entity Graph blijft bestaan als ondersteunende "Knowledge Graph"-tab; de roadmap wordt leidend.
> Dit document = ontwerp (8 deliverables). Geen implementatie in deze stap.

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

**Kernconclusie:** de roadmap-laag vereist een **normalisatie-view** die `build_tracker` + `aquier_projects` samenvoegt tot één projectmodel met genormaliseerde status/priority/datums. Zonder dat blijft de roadmap halfleeg.

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

## 3. WIREFRAME — Roadmap Command Center (landing)

```
┌─ Build Tracker War Room ────────────────  [entiteit: Modiwe Software ▼] ─┐
│ Tabs: ▣Roadmap  Timeline  Dependencies  Milestones  Revenue  Blockers  Knowledge Graph  Consolidation │
├──────────────────────────────────────────────────────────────────────────┤
│ ① EXECUTIVE STATUS BAR                                                     │
│  ┌────────┬──────────┬───────────┬──────────┬─────────┬───────────────┐   │
│  │ 11%    │ Actief 14│ Items 24  │ Block. 9 │ PR's 16 │ Milestones ▲3 │   │
│  │ 2/19   │          │           │          │         │               │   │
│  └────────┴──────────┴───────────┴──────────┴─────────┴───────────────┘   │
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
Alles binnen 10s leesbaar; geen graaf nodig om de 8 acceptatievragen te beantwoorden.

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
```
**Gantt-keuze:** geen zware lib. Custom **CSS-grid timeline** (kolommen = tijdsbuckets, rijen = priority-lanes, bars positioned via `grid-column`). Hergebruik `statusColor`/`NODE_ACCENT` uit `lib/build-war-room/graph.ts`. Undated projecten → aparte "Zonder datum"-strook gegroepeerd op status (geen valse balken).

---

## 5. DATAMAPPING (sectie → echte bron + gap)

| # | Sectie | Bron | Gap / actie |
|---|---|---|---|
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
| **F1** | data-laag | NIEUWE views `v_build_roadmap_projects`, `v_build_today_agenda`, `v_build_activity_feed`; optioneel additief `build_tracker.priority` (nullable) + status/priority-normalisatie. Geen breaking. | laag (additief) |
| **F2** | command-center top | `page.tsx` Roadmap + ① ExecutiveStatusBar + ③ Status + ④ Prioriteit, **als nieuwe tab** (nog niet default) | laag |
| **F3** | roadmap timeline | ② `RoadmapTimeline` (CSS-grid Gantt + markers + undated-lane) | midden (UI-complexiteit) |
| **F4** | dagsturing | ⑤ Agenda Vandaag · ⑥ Milestones · ⑦ Open Items · ⑧ Activiteit (realtime) · ⑨ Dependencies-overzicht | laag/midden |
| **F5** | nav-swap | Roadmap = default; Entity Graph → `graph/` "Knowledge Graph"; layout-tabs herordenen; `RevenuePrep` placeholder | laag (alleen route/label) |
| **F6** | omzet-laag (later) | Revenue/kosten/cashflow/waarde echt koppelen zodra `expected_revenue_amount`/Moneybird gevuld | apart traject |

Elke fase = eigen branch + PR + prod-validatie, zelfde discipline als #173-#176. Views read-only, geen datamutatie, geen schema-breaking. Rollback per fase = view/route terugdraaien.

---

## 8. GEFASEERDE MIGRATIESTRATEGIE (geen big-bang)

1. **Co-existentie:** Roadmap wordt eerst een **extra tab** (F2-F4) terwijl Entity Graph default blíjft → niets breekt, gebruiker test parallel.
2. **Cutover:** pas in **F5** wordt Roadmap default en Entity Graph → Knowledge Graph-tab. Eén kleine nav-commit, direct terugdraaibaar.
3. **Data-veiligheid:** alle nieuwe lagen = `create or replace view` (additief), géén migratie van bestaande data, géén wijziging aan `aquier_projects`/`build_tracker`-rijen. `build_tracker.priority` (indien gekozen) = nullable additieve kolom.
4. **Datagap-mitigatie (transparant, conform data-integriteitsregel):** undated/unprioritised projecten verschijnen in een aparte strook met badge i.p.v. valse balken; milestone-deadlines afgeleid → `source_reason`-tag.
5. **Acceptatie-gate per fase:** F2 beantwoordt "waar staan we / af / bezig"; F3 "wat komt hierna / kritiek"; F4 "vandaag / milestones / activiteit"; F5 = roadmap-first live.

---

## Acceptatiecriteria-dekking (≤10s, zonder graaf)
1. Waar staan we? → ① completion + ③ status
2. Wat is af? → ③ Afgerond
3. Wat is bezig? → ③ In uitvoering + ② actieve bars
4. Wat komt hierna? → ② toekomstige bars + ⑥ milestones
5. Wat is kritiek? → ④ P0 + ⑨ blockers/⑧
6. Wat levert omzet op? → Revenue-prep + ② revenue-markering (F6 echt)
7. Wat staat vandaag gepland? → ⑤ Agenda Vandaag
8. Welke milestones komen eraan? → ⑥ Komende Milestones

## Belangrijkste beslispunten vóór F1 (vereisen Orlando-go)
- **A.** `build_tracker.priority` additief toevoegen+backfillen, óf priority afleiden (revenue+blocker+status-heuristiek met `source_reason`)?
- **B.** Milestone-deadlines: datum-kolom toevoegen aan `holding_milestones`, óf ETA afleiden uit gekoppelde project-`target_at`?
- **C.** Gantt-datums voor non-Aquier projecten: backfill `build_tracker.started_at/target_at` (handmatig/planning_items), óf undated-lane accepteren tot data groeit?
