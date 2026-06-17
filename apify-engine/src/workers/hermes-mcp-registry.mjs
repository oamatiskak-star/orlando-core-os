/**
 * Cat 3 — Hermes MCP Registry
 * Parseert api-mega-list/mcp-servers-apis-131/README.md lokaal
 * en seeded hermes_mcp_registry met alle 131 MCP servers.
 * Genereert ook een Claude MCP-config snippet voor de Hermes config.
 *
 * Geen Apify-token nodig — puur lokale bestandsverwerking.
 */
import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { db, heartbeat } from '../lib/supabase.mjs'
import { REPO_ROOT } from '../config.mjs'

const ENGINE_KEY = 'apify:hermes-mcp'
const README_PATH = join(REPO_ROOT, 'api-mega-list', 'mcp-servers-apis-131', 'README.md')

// MCP servers die direct bruikbaar zijn voor Hermes
const HIGH_PRIORITY = new Set([
  'agentify/brave-search-mcp-server',
  'datascoutapi/google-search-mcp-server',
  'agentify/financial-datasets-mcp-server',
  'smacient/ga4-mcp-worker',
  'smacient/gsc-mcp-worker',
  'visita/rag-browser',
  'jiri.spilka/playwright-mcp-server',
  'crawlerbros/markdownify-mcp-server',
  'agentify/firecrawl-mcp-server',
  'agentify/tavily-mcp-server',
  'agentify/wikipedia-mcp-server',
  'agentify/deepl-mcp-server',
  'parseforge/slack-mcp',
  'coupaul/supabase-mcp-selfhosted',
  'anchor/hubspot-apify-mcp-server',
  'agentify/exa-mcp-server',
  'crawlerbros/reddit-mcp-scraper',
  'barudob/mcp-reddit',
  'dz_omar/youtube-transcript-metadata-extractor',
  'dz_omar/youtube-comments-scraper',
  'dz_omar/ai-lead-extractor',
  'abotapi/ai-search-mcp-server',
  'agentify/perplexity-sonar-mcp-server',
  'profesional_jostle/bistoreengine',
])

function parseReadme(content) {
  const entries = []
  const tableRowRe = /^\|\s*\[([^\]]+)\]\(([^)]+)\)\s*\|\s*(.+?)\s*\|$/

  for (const line of content.split('\n')) {
    const m = line.match(tableRowRe)
    if (!m) continue
    const name = m[1].replace(/[🎬🎵👥💬📨📱📹🔥🕵️🤖🧩🧾]/gu, '').trim()
    const url  = m[2].replace(/\?fpr=p2hrc6$/, '').trim()
    const desc = m[3].trim()
    const actorPath = url.replace('https://apify.com/', '')
    entries.push({ name, url, desc, actorPath })
  }
  return entries
}

function buildHermesConfig(entries) {
  const priorityEntries = entries.filter(e => HIGH_PRIORITY.has(e.actorPath))
  const mcpServers = {}
  for (const e of priorityEntries) {
    const key = e.actorPath.replace('/', '_').replace(/[^a-z0-9_]/gi, '_')
    mcpServers[key] = {
      type: 'sse',
      url: `https://mcp.apify.com/sse?token=\${APIFY_API_TOKEN}&actors=${encodeURIComponent(e.actorPath)}`,
      description: e.desc.slice(0, 100),
    }
  }
  return mcpServers
}

export async function run(log = console.log) {
  log('[hermes-mcp-registry] start')
  const started = Date.now()

  const content = readFileSync(README_PATH, 'utf8')
  const entries = parseReadme(content)
  log(`Geparst: ${entries.length} MCP servers`)

  // Upsert in registry
  const rows = entries.map(e => ({
    name: e.name,
    description: e.desc.slice(0, 500),
    apify_url: e.url,
    actor_path: e.actorPath,
    category: 'mcp',
    priority: HIGH_PRIORITY.has(e.actorPath) ? 'high' : 'normal',
    enabled: HIGH_PRIORITY.has(e.actorPath),
  }))

  const { error } = await db()
    .from('hermes_mcp_registry')
    .upsert(rows, { onConflict: 'actor_path' })

  if (error) log(`⚠️  Registry upsert: ${error.message}`)
  else log(`✓ ${rows.length} MCP servers in hermes_mcp_registry`)

  // Genereer Hermes config-snippet
  const hermesConfig = buildHermesConfig(entries)
  const configPath = join(REPO_ROOT, 'services', 'hermes', 'mcp-servers.generated.json')
  writeFileSync(configPath, JSON.stringify(hermesConfig, null, 2), 'utf8')
  log(`✓ Hermes MCP config → ${configPath} (${Object.keys(hermesConfig).length} servers)`)

  const ms = Date.now() - started
  await heartbeat(ENGINE_KEY, { total: entries.length, high_priority: Object.keys(hermesConfig).length, ms })
  log(`[hermes-mcp-registry] klaar in ${ms}ms`)
  return { total: entries.length, highPriority: Object.keys(hermesConfig).length }
}
