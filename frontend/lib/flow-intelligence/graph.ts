// Build graph of routes + outgoing references.
// Nodes = routes, edges = link uit deze route naar target.

import { scanRoutes, type RouteNode } from './scanRoutes'
import { parseLinks, type OutgoingRef } from './parseLinks'
import fs from 'node:fs/promises'
import path from 'node:path'

export interface Edge {
  from: string
  to:   string
  kind: OutgoingRef['kind']
}

export interface FlowGraph {
  appDir:  string
  nodes:   RouteNode[]
  edges:   Edge[]
  outgoing: Map<string, Edge[]>
  incoming: Map<string, Edge[]>
}

/**
 * Verzamel alle .tsx/.ts bestanden onder een route's folder
 * (inclusief co-located components) zodat we hun outgoing links zien.
 */
async function fileSiblings(pageFile: string): Promise<string[]> {
  const dir = path.dirname(pageFile)
  const out: string[] = []
  async function walk(d: string, depth: number): Promise<void> {
    if (depth > 3) return
    let entries
    try { entries = await fs.readdir(d, { withFileTypes: true }) } catch { return }
    for (const e of entries) {
      const p = path.join(d, e.name)
      if (e.isDirectory()) {
        if (e.name === 'node_modules' || e.name.startsWith('.')) continue
        // Schrijf-actie: geen recursie in geneste route-segments (die hebben eigen page.tsx)
        const hasOwnPage = await fs.stat(path.join(p, 'page.tsx')).then(() => true).catch(() => false)
        if (hasOwnPage) continue
        await walk(p, depth + 1)
      } else if (/\.(tsx|ts|jsx|js)$/.test(e.name)) {
        out.push(p)
      }
    }
  }
  await walk(dir, 0)
  return out
}

function normalizeTarget(href: string, knownRoutes: Set<string>): string {
  // Strip query/hash
  let h = href.split('#')[0].split('?')[0]
  if (h.length > 1 && h.endsWith('/')) h = h.slice(0, -1)

  if (knownRoutes.has(h)) return h

  // Probeer dynamic segment match: /foo/123 → /foo/[id]
  for (const r of knownRoutes) {
    if (!r.includes('[')) continue
    const re = new RegExp('^' + r.replace(/\[[^\]]+\]/g, '[^/]+') + '$')
    if (re.test(h)) return r
  }
  return h // onbekende route — laat staan
}

export async function buildGraph(appDir: string): Promise<FlowGraph> {
  const nodes = await scanRoutes(appDir)
  const known = new Set(nodes.map((n) => n.route))
  const edges: Edge[] = []

  for (const node of nodes) {
    const siblings = await fileSiblings(node.file)
    const all = [node.file, ...siblings]
    for (const f of all) {
      const refs = await parseLinks(f)
      for (const ref of refs) {
        const to = normalizeTarget(ref.href, known)
        edges.push({ from: node.route, to, kind: ref.kind })
      }
    }
  }

  const outgoing = new Map<string, Edge[]>()
  const incoming = new Map<string, Edge[]>()
  for (const e of edges) {
    if (!outgoing.has(e.from)) outgoing.set(e.from, [])
    if (!incoming.has(e.to))   incoming.set(e.to,   [])
    outgoing.get(e.from)!.push(e)
    incoming.get(e.to)!.push(e)
  }

  return { appDir, nodes, edges, outgoing, incoming }
}
