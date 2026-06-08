import { readdir, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { tokenize, type SkillCandidate } from './shared.js'

export interface Playbook {
  slug: string
  title: string
  triggers: string[]
  incident: boolean
  match: string[]
  project?: string
  resolvesLocally: boolean
  body: string
}

let cache: Playbook[] | null = null

/** Kandidaat-mappen voor playbooks/ (repo-root, env, of cwd). Eerste die bestaat wint. */
function candidateDirs(): string[] {
  const here = dirname(fileURLToPath(import.meta.url)) // .../ai-os/router/dist/orchestrator (of src)
  const dirs = [
    process.env.HERMES_PLAYBOOKS_DIR,
    join(here, '../../../../playbooks'), // dist/orchestrator -> repo-root/playbooks
    join(here, '../../../playbooks'),
    join(process.cwd(), 'playbooks'),
    join(process.cwd(), '../../playbooks'),
  ]
  return dirs.filter((d): d is string => Boolean(d))
}

function parseFrontmatter(raw: string): Partial<Playbook> & { body: string } {
  const m = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/)
  if (!m) return { body: raw }
  const [, fm, body] = m
  const out: Record<string, unknown> = {}
  for (const line of (fm ?? '').split('\n')) {
    const kv = line.match(/^(\w+):\s*(.*)$/)
    if (!kv) continue
    const key = kv[1] as string
    let val: unknown = (kv[2] ?? '').trim()
    if (typeof val === 'string' && val.startsWith('[') && val.endsWith(']')) {
      val = val.slice(1, -1).split(',').map(s => s.trim()).filter(Boolean)
    } else if (val === 'true' || val === 'false') {
      val = val === 'true'
    }
    out[key] = val
  }
  const matchField = out['match']
  return {
    slug: String(out['slug'] ?? ''),
    title: String(out['title'] ?? ''),
    triggers: Array.isArray(out['triggers']) ? (out['triggers'] as string[]) : [],
    incident: out['incident'] === true,
    match: Array.isArray(matchField)
      ? (matchField as string[])
      : typeof matchField === 'string'
        ? matchField.split(/[, ]+/).filter(Boolean)
        : [],
    project: out['project'] ? String(out['project']) : undefined,
    resolvesLocally: out['resolves_locally'] === true,
    body: body ?? '',
  }
}

/** Laadt + cachet alle playbooks van de eerste bestaande map. */
export async function loadPlaybooks(): Promise<Playbook[]> {
  if (cache) return cache
  for (const dir of candidateDirs()) {
    try {
      const files = (await readdir(dir)).filter(f => f.endsWith('.md'))
      if (files.length === 0) continue
      const out: Playbook[] = []
      for (const f of files) {
        const raw = await readFile(join(dir, f), 'utf8')
        const p = parseFrontmatter(raw)
        if (p.slug) out.push(p as Playbook)
      }
      if (out.length) {
        cache = out
        return cache
      }
    } catch {
      /* probeer volgende kandidaat-map */
    }
  }
  cache = []
  return cache
}

/**
 * FASE 3 — kies de meest relevante playbook vóór model-escalatie.
 * Score = trigger-skill-overlap (zwaar) + match-keyword-overlap (licht).
 */
export async function matchPlaybook(message: string, skills: SkillCandidate[]): Promise<Playbook | null> {
  const books = await loadPlaybooks()
  if (books.length === 0) return null
  const skillNames = new Set(skills.map(s => s.name))
  const msgTokens = tokenize(message)
  const lowerMsg = message.toLowerCase()

  let best: Playbook | null = null
  let bestScore = 0
  for (const b of books) {
    let score = 0
    for (const t of b.triggers) if (skillNames.has(t)) score += 3
    for (const kw of b.match) {
      if (kw.includes(' ') ? lowerMsg.includes(kw) : msgTokens.has(kw)) score += 1
    }
    if (score > bestScore) {
      bestScore = score
      best = b
    }
  }
  return bestScore > 0 ? best : null
}
