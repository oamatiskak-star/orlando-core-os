import { readdir, readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { hermesDb, type AgentCandidate, type SkillCandidate } from './shared.js'

// ── .claude/agents registry (read frontmatter once, cache) ───────────────────
let claudeAgentsCache: Set<string> | null = null

async function loadClaudeAgents(): Promise<Set<string>> {
  if (claudeAgentsCache) return claudeAgentsCache
  const names = new Set<string>()
  try {
    const dir = join(homedir(), '.claude', 'agents')
    const files = await readdir(dir)
    for (const f of files) {
      if (!f.endsWith('.md')) continue
      try {
        const head = (await readFile(join(dir, f), 'utf8')).slice(0, 400)
        const m = head.match(/^name:\s*(.+)$/m)
        if (m && m[1]) names.add(m[1].trim())
        else names.add(f.replace(/\.md$/, ''))
      } catch {
        /* skip unreadable file */
      }
    }
  } catch {
    /* .claude/agents not present on this host — degrade gracefully */
  }
  claudeAgentsCache = names
  return names
}

/**
 * LAAG 4 — derive candidate_agents[] from the selected skills' agent hints,
 * cross-referenced with hermes.subagents (runtime status) and the .claude/agents
 * registry (existence). Union, de-duplicated.
 */
export async function matchAgents(skills: SkillCandidate[]): Promise<AgentCandidate[]> {
  const wanted = new Map<string, string>() // agent name -> matched skill
  for (const s of skills) {
    for (const a of s.agents) if (!wanted.has(a)) wanted.set(a, s.name)
  }
  if (wanted.size === 0) return []

  // Runtime subagents (live agents with state).
  const subagentStatus = new Map<string, string>()
  try {
    const { data } = await hermesDb().from('subagents').select('name, enabled')
    for (const row of (data ?? []) as Array<{ name: string; enabled: boolean }>) {
      subagentStatus.set(row.name, row.enabled ? 'enabled' : 'disabled')
    }
  } catch {
    /* subagents optional */
  }

  const claudeAgents = await loadClaudeAgents()

  const out: AgentCandidate[] = []
  for (const [name, matchedSkill] of wanted) {
    let source: AgentCandidate['source'] = 'skill'
    let status: string | undefined
    if (subagentStatus.has(name)) {
      source = 'subagent'
      status = subagentStatus.get(name)
    } else if (claudeAgents.has(name)) {
      source = 'claude-agent'
    }
    out.push({ name, source, matched_skill: matchedSkill, status })
  }
  return out
}
