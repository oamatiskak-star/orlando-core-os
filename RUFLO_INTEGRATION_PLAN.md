# Ruflo × Orlando Core OS — Integratieplan

**Datum**: 2026-06-17  
**Branch**: `claude/pull-ruflo-repo-rgg6ln`  
**Doel**: Ruflo (multi-agent AI orchestratie) als brein achter de Orlando-engines draaien.

---

## Wat er nu staat

| Component | Status |
|-----------|--------|
| `ruflo/` gecloned (v3.11.0) | ✅ aanwezig |
| `.claude/settings.json` met MCP-server | ✅ aangemaakt |
| Engine Planner (DB-cron, migratie 092/093) | ✅ actief |
| Local-agent workers (PM2) | ✅ draait |
| Ruflo node_modules | ❌ nog niet geïnstalleerd |

---

## Fase 1 — Fundament (nu)

### 1.1 MCP-server activeren
`.claude/settings.json` registreert `claude-flow` als MCP-server:
```
npx ruflo@latest mcp start
```
Geeft 300+ tools beschikbaar in elke Claude Code-sessie via `mcp__claude-flow__*`.

### 1.2 Ruflo lokaal installeren
```bash
cd ruflo && npm install --legacy-peer-deps
```
Daarna werkt ook: `node ruflo/bin/cli.js <commando>`

### 1.3 AgentDB initialiseren
```bash
npx ruflo@latest memory init
npx ruflo@latest memory store --key "orlando:context" --value "Orlando Core OS — YouTube engine, mail, planning. Engine Planner = single source of truth."
```
Ruflo onthoudt context over sessies.

---

## Fase 2 — Engine-agents mappen (volgende sprint)

Elke bestaande local-agent worker krijgt een ruflo-agentrol:

| Orlando worker | Ruflo agent-type | engine_key (Planner) |
|----------------|-----------------|----------------------|
| `cf2-producer.ts` | `agent-coder` | `yt:cf2-producer` |
| `quality-assess.ts` | `agent-reviewer` | `yt:quality-assess` |
| `learning-loop-worker.ts` | `agent-researcher` | `ai:learning-loop` |
| `seo-optimizer.ts` | `agent-coder` | `seo:optimizer` |
| `affiliate-discovery.ts` | `agent-researcher` | `aff:discovery` |
| `mail-engine` | `agent-coder` | `mail:processor` |
| `planning-engine` | `agent-planner` | `plan:scheduler` |

**Vuistregel**: Elke nieuwe ruflo-agent die als achtergrond-job draait krijgt een rij in `engine_schedule`. Ruflo's swarm-coördinator checkt `engine_window_open()` vóór dispatch.

### Supabase-migratie (Engine Planner uitbreiding)
```sql
-- migratie 220_ruflo_agent_schedule.sql
INSERT INTO public.engine_schedule (engine_key, grp, label, block_key)
VALUES
  ('ai:ruflo-swarm',   'ai',   'Ruflo Swarm Coördinator', 'ai-block'),
  ('ai:agentdb',       'ai',   'AgentDB Memory Sync',     'ai-block'),
  ('ai:learning-loop', 'ai',   'Ruflo Learning Loop',     'ai-block');
```

---

## Fase 3 — Swarm-topologie (na fase 2)

Ruflo orchestreert de engines als een **hiërarchische swarm**:

```
Queen Agent (hiërarchisch coördinator)
├── YouTube Swarm
│   ├── cf2-producer     (content genereren)
│   ├── quality-assess   (kwaliteitscheck)
│   └── seo-optimizer    (SEO-verbetering)
├── Acquisition Swarm
│   ├── affiliate-discovery
│   └── competitor-intel
└── Memory Worker
    └── learning-loop    (AgentDB updates)
```

Start via:
```bash
npx ruflo@latest swarm start \
  --topology hierarchical \
  --agents "cf2-producer,quality-assess,seo-optimizer" \
  --strategy specialized
```

---

## Fase 4 — ReasoningBank (lerende loop)

Ruflo slaat elke taak-uitkomst op als patroon:
- **Trajectory**: wat werkte (video-idee → hoge CTR)
- **Verdict**: succes/faal + waarom
- **Replay**: volgende keer soortgelijke taak → snellere aanpak

Koppeling met de bestaande `learning-loop-worker.ts`:
```typescript
// In learning-loop-worker.ts uitbreiden:
await fetch('http://localhost:3001/mcp', {
  method: 'POST',
  body: JSON.stringify({
    tool: 'mcp__claude-flow__memory_store',
    params: { key: `orlando:verdict:${taskId}`, value: outcome }
  })
});
```

---

## Fase 5 — Hooks activeren (optioneel)

Ruflo's 27 lifecycle-hooks activeren automatisch leergedrag:
- **pre-task**: haalt soortgelijke patronen op uit AgentDB
- **post-task**: slaat nieuw patroon op
- **post-edit**: na elke bestandswijziging — kwaliteitscheck

In `.claude/settings.json` al geconfigureerd: `hooks.PostToolUse` roept `ruflo hooks post-edit` aan na elke Write/Edit.

---

## Direct uitvoerbaar (nu)

```bash
# 1. Installeer ruflo
cd /home/user/orlando-core-os/ruflo && npm install --legacy-peer-deps

# 2. Verifieer MCP-server
npx ruflo@latest mcp start --test 2>/dev/null || npx ruflo@latest status

# 3. Init memory
npx ruflo@latest memory init

# 4. Commit alles
git add ruflo/ .claude/settings.json RUFLO_INTEGRATION_PLAN.md
git commit -m "feat(ruflo): voeg ruflo multi-agent framework toe + MCP-config"
git push -u origin claude/pull-ruflo-repo-rgg6ln
```

---

## Wat je ermee wint

| Zonder ruflo | Met ruflo |
|---|---|
| Workers draaien los, geen geheugen | Swarm coördineert, deelt context |
| Geen leergedrag over sessies | ReasoningBank onthoudt wat werkt |
| Handmatige dispatch in PM2 | Ruflo-swarm dispatcht intelligent |
| 1 agent tegelijk per Claude-sessie | 100+ agents parallel |
| MCP-tools per server apart | 300+ tools via 1 claude-flow MCP |
